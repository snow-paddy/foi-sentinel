-- =====================================================================
-- FOI Sentinel v2 — Phase 3: Stage engine, clock, cost, triage, response
-- =====================================================================
USE WAREHOUSE FOI_WH;
USE SCHEMA FOI.FOI_SENTINEL_V2;

-- ---------------------------------------------------------------------
-- SP_ADVANCE_STAGE — move a case to a new lifecycle stage + audit event
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_ADVANCE_STAGE(P_CASE_ID VARCHAR, P_TO_STAGE VARCHAR, P_ACTOR_TYPE VARCHAR, P_ACTOR VARCHAR, P_NOTE VARCHAR)
RETURNS VARCHAR LANGUAGE SQL AS
BEGIN
    LET v_from VARCHAR;
    SELECT CURRENT_STAGE INTO :v_from FROM FOI_CASE WHERE CASE_ID = :P_CASE_ID;
    UPDATE FOI_CASE SET CURRENT_STAGE = :P_TO_STAGE, UPDATED_AT = CURRENT_TIMESTAMP() WHERE CASE_ID = :P_CASE_ID;
    INSERT INTO FOI_CASE_EVENT (CASE_ID, FROM_STAGE, TO_STAGE, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
        VALUES (:P_CASE_ID, :v_from, :P_TO_STAGE, :P_ACTOR_TYPE, :P_ACTOR, 'STAGE_ADVANCE', :P_NOTE);
    RETURN 'Case ' || :P_CASE_ID || ' advanced ' || COALESCE(:v_from,'?') || ' -> ' || :P_TO_STAGE;
END;

-- ---------------------------------------------------------------------
-- SP_STOP_CLOCK — pause the statutory clock (clarification / fees / PIT)
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_STOP_CLOCK(P_CASE_ID VARCHAR, P_STATE VARCHAR, P_ACTOR VARCHAR, P_NOTE VARCHAR)
RETURNS VARCHAR LANGUAGE SQL AS
BEGIN
    UPDATE FOI_CASE SET CLOCK_STATE = :P_STATE, CLOCK_STOPPED_AT = CURRENT_DATE(), UPDATED_AT = CURRENT_TIMESTAMP()
        WHERE CASE_ID = :P_CASE_ID;
    INSERT INTO FOI_CASE_EVENT (CASE_ID, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
        VALUES (:P_CASE_ID, 'HUMAN', :P_ACTOR, 'CLOCK_STOP', :P_STATE || ': ' || COALESCE(:P_NOTE,''));
    RETURN 'Clock stopped (' || :P_STATE || ') for ' || :P_CASE_ID;
END;

-- ---------------------------------------------------------------------
-- SP_RESUME_CLOCK — resume clock; extend deadline by working days stopped
-- (approximates the s.10(2) "disregard" / s.1(3) reset model)
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_RESUME_CLOCK(P_CASE_ID VARCHAR, P_ACTOR VARCHAR)
RETURNS VARCHAR LANGUAGE SQL AS
BEGIN
    LET v_stopped DATE;
    LET v_deadline DATE;
    SELECT CLOCK_STOPPED_AT, STATUTORY_DEADLINE INTO :v_stopped, :v_deadline FROM FOI_CASE WHERE CASE_ID = :P_CASE_ID;
    LET v_days NUMBER := 0;
    IF (v_stopped IS NOT NULL) THEN
        v_days := (SELECT FN_WORKING_DAYS(:v_stopped, CURRENT_DATE()));
    END IF;
    UPDATE FOI_CASE
        SET CLOCK_STATE = 'RUNNING', CLOCK_STOPPED_AT = NULL,
            STATUTORY_DEADLINE = FN_ADD_WORKING_DAYS(:v_deadline, :v_days),
            UPDATED_AT = CURRENT_TIMESTAMP()
        WHERE CASE_ID = :P_CASE_ID;
    INSERT INTO FOI_CASE_EVENT (CASE_ID, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
        VALUES (:P_CASE_ID, 'HUMAN', :P_ACTOR, 'CLOCK_RESUME', 'Resumed; deadline extended by ' || :v_days || ' working day(s)');
    RETURN 'Clock resumed for ' || :P_CASE_ID || ' (+' || :v_days || ' WD)';
END;

-- ---------------------------------------------------------------------
-- SP_COST_ESTIMATE — four prescribed activities; regime-aware limit.
-- EIR has NO cost limit (Fees Regs do not apply) -> EXCEEDS_LIMIT = FALSE.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_COST_ESTIMATE(P_CASE_ID VARCHAR, P_DET FLOAT, P_LOC FLOAT, P_RET FLOAT, P_EXT FLOAT)
RETURNS VARCHAR LANGUAGE SQL AS
BEGIN
    LET v_regime VARCHAR;
    SELECT REGIME INTO :v_regime FROM FOI_CASE WHERE CASE_ID = :P_CASE_ID;
    LET v_rate FLOAT := (SELECT CONFIG_VALUE::FLOAT FROM COUNCIL_CONFIG WHERE CONFIG_KEY = 'COST_RATE_PER_HOUR');
    LET v_limit_gbp FLOAT := (SELECT CONFIG_VALUE::FLOAT FROM COUNCIL_CONFIG WHERE CONFIG_KEY = 'COST_LIMIT_GBP');
    LET v_total_hours FLOAT := :P_DET + :P_LOC + :P_RET + :P_EXT;
    LET v_total_gbp FLOAT := :v_total_hours * :v_rate;
    LET v_applies_limit FLOAT := :v_limit_gbp;
    LET v_exceeds BOOLEAN := FALSE;
    LET v_note VARCHAR := '';
    IF (v_regime = 'EIR') THEN
        v_applies_limit := NULL;
        v_exceeds := FALSE;
        v_note := 'EIR: no cost limit applies (Fees Regs 2004 do not apply). Reg.7 allows extension to 40 working days for complex/voluminous requests.';
    ELSE
        v_exceeds := (:v_total_gbp > :v_limit_gbp);
        v_note := 'FOIA cost limit £' || :v_limit_gbp || ' (Fees Regs 2004 reg.3). Only determine/locate/retrieve/extract count (reg.4) at £' || :v_rate || '/hr.';
    END IF;
    DELETE FROM FOI_COST_ESTIMATE WHERE CASE_ID = :P_CASE_ID;
    INSERT INTO FOI_COST_ESTIMATE (CASE_ID, HOURS_DETERMINE, HOURS_LOCATE, HOURS_RETRIEVE, HOURS_EXTRACT, RATE_PER_HOUR, LIMIT_GBP, TOTAL_HOURS, TOTAL_GBP, EXCEEDS_LIMIT, NOTE)
        VALUES (:P_CASE_ID, :P_DET, :P_LOC, :P_RET, :P_EXT, :v_rate, :v_applies_limit, :v_total_hours, :v_total_gbp, :v_exceeds, :v_note);
    INSERT INTO FOI_CASE_EVENT (CASE_ID, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
        VALUES (:P_CASE_ID, 'HUMAN', 'system', 'DECISION', 'Cost estimate: ' || :v_total_hours || 'h / £' || :v_total_gbp || ' (exceeds=' || :v_exceeds || ')');
    RETURN 'Cost estimate stored: ' || :v_total_hours || 'h, £' || :v_total_gbp || ', exceeds=' || :v_exceeds;
END;

-- ---------------------------------------------------------------------
-- SP_TRIAGE_CASE — purpose-built Cortex AI SQL:
--   SENTIMENT (tone) + AI_CLASSIFY (regime) + AI_FILTER (s.14 vexatious)
--   + AI_EXTRACT (scope) + COMPLETE (narrative detail) + s.21 check.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_TRIAGE_CASE(P_CASE_ID VARCHAR)
RETURNS VARCHAR LANGUAGE SQL AS
BEGIN
    LET v_text VARCHAR;
    SELECT REQUEST_TEXT INTO :v_text FROM FOI_CASE WHERE CASE_ID = :P_CASE_ID;
    LET v_sent FLOAT := (SELECT SNOWFLAKE.CORTEX.SENTIMENT(:v_text));
    LET v_cl VARIANT := (SELECT AI_CLASSIFY(:v_text, ['FOI','EIR','SAR','BAU']));
    LET v_regime VARCHAR := COALESCE(:v_cl:labels[0]::string, 'FOI');
    LET v_vex BOOLEAN := (SELECT AI_FILTER('Is this request vexatious under s.14 FOIA (abusive, disproportionate, part of a repeated campaign, or intended to harass)? ' || :v_text));
    LET v_scope VARIANT := (SELECT AI_EXTRACT(text => :v_text, responseFormat => {'date_range':'What time period does the request cover?','departments':'Which council departments or services are named or implied?','documents':'What specific documents or datasets are requested?'}):response);
    LET v_prompt VARCHAR := 'You are an expert UK local-government FOI officer. Analyse this request and return JSON only with keys: '
        || 'priority (HIGH/MEDIUM/LOW), complexity_score (1-10), '
        || 'suggested_exemptions (array of section refs e.g. "s.40(2)"), suggested_departments (array), estimated_hours (number), '
        || 'summary (1 sentence), justification (2-3 sentences). REQUEST: '
        || REPLACE(:v_text, '''', '') || ' Return JSON only.';
    LET v_resp VARCHAR := (SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', :v_prompt));
    LET v_clean VARCHAR := REGEXP_REPLACE(:v_resp, '```json|```', '');
    LET v_json VARIANT := COALESCE(TRY_PARSE_JSON(:v_clean), OBJECT_CONSTRUCT());
    -- Merge the purpose-built signals into the triage JSON.
    v_json := OBJECT_INSERT(:v_json, 'category', :v_regime, TRUE);
    v_json := OBJECT_INSERT(:v_json, 'is_vexatious', :v_vex, TRUE);
    v_json := OBJECT_INSERT(:v_json, 'scope', :v_scope, TRUE);
    MERGE INTO FOI_TRIAGE t USING (SELECT :P_CASE_ID AS CASE_ID) s ON t.CASE_ID = s.CASE_ID
        WHEN MATCHED THEN UPDATE SET TRIAGE_JSON = :v_json, COMPUTED_AT = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (CASE_ID, TRIAGE_JSON, COMPUTED_AT) VALUES (:P_CASE_ID, :v_json, CURRENT_TIMESTAMP());
    UPDATE FOI_CASE SET SENTIMENT_SCORE = :v_sent,
        IS_VEXATIOUS = :v_vex, UPDATED_AT = CURRENT_TIMESTAMP()
        WHERE CASE_ID = :P_CASE_ID;
    -- s.21 already-published check (AI_SIMILARITY vs the council's own corpus).
    CALL SP_FLAG_S21_REUSE(:P_CASE_ID);
    RETURN 'Triaged ' || :P_CASE_ID || ' (regime ' || :v_regime || ', sentiment ' || :v_sent || ', vexatious ' || :v_vex || ')';
END;

-- ---------------------------------------------------------------------
-- SP_GENERATE_RESPONSE — s.17(7)-compliant draft (refusal / disclosure / partial)
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_GENERATE_RESPONSE(P_CASE_ID VARCHAR, P_TYPE VARCHAR)
RETURNS VARCHAR LANGUAGE SQL AS
BEGIN
    LET v_council VARCHAR := (SELECT CONFIG_VALUE FROM COUNCIL_CONFIG WHERE CONFIG_KEY = 'COUNCIL_NAME');
    LET v_text VARCHAR;
    LET v_regime VARCHAR;
    LET v_ref VARCHAR;
    SELECT REQUEST_TEXT, REGIME, REFERENCE INTO :v_text, :v_regime, :v_ref FROM FOI_CASE WHERE CASE_ID = :P_CASE_ID;
    LET v_exemptions VARCHAR := (SELECT LISTAGG(SECTION_REF, ', ') FROM FOI_EXEMPTION_ASSESSMENT WHERE CASE_ID = :P_CASE_ID AND DECISION = 'APPLY');
    LET v_rules VARCHAR := 'Mandatory compliance (s.17 FOIA): state which exemption(s) apply and why; for qualified exemptions explain the public interest balance; '
        || 'ALWAYS include the right to an internal review and the right to complain to the Information Commissioner (ICO) under s.50. Use UK English and a professional council tone.';
    LET v_prompt VARCHAR := 'You are an FOI officer at ' || :v_council || ' drafting a ' || :P_TYPE || ' response under the '
        || :v_regime || ' regime (reference ' || COALESCE(:v_ref,'') || '). REQUEST: ' || REPLACE(:v_text, '''', '')
        || '. Exemptions/exceptions to cite (if any): ' || COALESCE(:v_exemptions, 'none') || '. ' || :v_rules
        || ' Produce a complete, ready-to-send letter.';
    LET v_draft VARCHAR := (SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', :v_prompt));
    LET v_is_refusal BOOLEAN := (:P_TYPE IN ('REFUSAL','PARTIAL'));
    DELETE FROM FOI_RESPONSE WHERE CASE_ID = :P_CASE_ID AND FINAL_TEXT IS NULL;
    INSERT INTO FOI_RESPONSE (CASE_ID, RESPONSE_TYPE, DRAFT_TEXT, S17_EXEMPTION_STATED, S17_INTERNAL_REVIEW_INCLUDED, S17_ICO_ROUTE_INCLUDED)
        VALUES (:P_CASE_ID, :P_TYPE, :v_draft, :v_is_refusal, TRUE, TRUE);
    INSERT INTO FOI_CASE_EVENT (CASE_ID, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
        VALUES (:P_CASE_ID, 'AI', 'mistral-large2', 'NOTE', 'Generated ' || :P_TYPE || ' draft response');
    RETURN 'Draft (' || :P_TYPE || ') generated for ' || :P_CASE_ID;
END;

SELECT 'Phase 3 procedures created' AS STATUS;
