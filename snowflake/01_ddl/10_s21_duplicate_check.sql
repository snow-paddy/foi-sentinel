-- =====================================================================
-- FOI Sentinel v2 - s.21 duplicate / "reasonably accessible" auto-flag
-- s.21 FOIA exempts information already reasonably accessible to the
-- applicant, including information THIS authority has already published.
-- We detect it with AI_SIMILARITY between the new request and the
-- council's own already-published / cleanly-answered corpus. When the
-- closest match is at or above S21_SIMILARITY_THRESHOLD we write the
-- matched reference into FOI_TRIAGE.S21_MATCH_REF, which the app renders
-- as "Already published; matches FOI-XXXX" and pre-selects an S21_REUSE
-- response. FOI only (s.21 is a FOIA provision; EIR uses reg.6 separately).
-- =====================================================================
USE WAREHOUSE FOI_WH; USE SCHEMA FOI.FOI_SENTINEL_V2;

-- Configurable match threshold (0-1). Higher = fewer false positives.
MERGE INTO COUNCIL_CONFIG t
USING (SELECT 'S21_SIMILARITY_THRESHOLD' AS CONFIG_KEY) s ON t.CONFIG_KEY = s.CONFIG_KEY
WHEN NOT MATCHED THEN INSERT (CONFIG_KEY, CONFIG_VALUE, DESCRIPTION)
    VALUES ('S21_SIMILARITY_THRESHOLD', '0.85',
            'AI_SIMILARITY floor to auto-flag an s.21 duplicate against the council''s own published corpus');

-- Two extra published precedents so the demo s.21 quick-wins match a real
-- prior disclosure (potholes reported/repaired; children in care).
INSERT INTO FOI_SYNTH_PRECEDENT (REF, TITLE, THEME, REGIME, REQUEST_TEXT, RESPONSE_TEXT, CLEAN_OUTCOME)
SELECT x.REF, x.TITLE, x.THEME, x.REGIME, x.REQUEST_TEXT, x.RESPONSE_TEXT, x.CLEAN_OUTCOME FROM (
  SELECT 'FOI-2024-0390' AS REF,'Potholes reported and repaired 2023/24' AS TITLE,'highways' AS THEME,'FOI' AS REGIME,
         'How many potholes were reported and repaired in the last 12 months across the city?' AS REQUEST_TEXT,
         'In the 12 months to March 2024 the council logged 8,742 pothole reports and completed 8,180 repairs, with a monthly breakdown and average repair time attached. The figures are published in the council''s annual highways performance report. No information was withheld.' AS RESPONSE_TEXT,
         'Granted in full - no complaint or review' AS CLEAN_OUTCOME
  UNION ALL
  SELECT 'FOI-2024-0375','Children in care - headcount 2023/24','social care','FOI',
         'What is the current number of children in care in the borough?',
         'As at 31 March 2024 there were 486 children looked after by the council, with a breakdown by placement type attached. The figure is published quarterly in the council''s children''s services performance dashboard. No information was withheld.',
         'Granted in full - no complaint or review'
) x
WHERE NOT EXISTS (SELECT 1 FROM FOI_SYNTH_PRECEDENT p WHERE p.REF = x.REF);

-- The s.21 corpus: information THIS authority has already published or
-- answered cleanly (own responses only; other authorities do not make a
-- request reasonably accessible to the applicant for s.21 purposes).
CREATE OR REPLACE VIEW V_S21_CORPUS AS
SELECT REF, TITLE, REQUEST_TEXT, RESPONSE_TEXT, 'Council disclosure (published)' AS WHERE_TO_FIND
FROM FOI_SYNTH_PRECEDENT
WHERE REQUEST_TEXT IS NOT NULL
UNION ALL
SELECT REFERENCE_NUMBER, TOPIC, SUMMARY, SUMMARY, 'Council disclosure log (s.19)'
FROM FOI_DISCLOSURE_PUBLICATION
WHERE SUMMARY IS NOT NULL
UNION ALL
SELECT c.REFERENCE, c.SUBJECT, c.REQUEST_TEXT, NULL, 'Previously answered by this council'
FROM FOI_CASE c
WHERE c.STATUS = 'CLOSED'
  AND c.REGIME = 'FOI'
  AND c.OUTCOME IN ('GRANTED_FULL','GRANTED_PARTIAL')
  AND c.REQUEST_TEXT IS NOT NULL;

-- Flag a single case if its closest own-published match clears the threshold.
CREATE OR REPLACE PROCEDURE SP_FLAG_S21_REUSE(P_CASE_ID VARCHAR)
RETURNS VARCHAR LANGUAGE SQL AS
BEGIN
    LET v_text VARCHAR;
    LET v_regime VARCHAR;
    SELECT REQUEST_TEXT, REGIME INTO :v_text, :v_regime FROM FOI_CASE WHERE CASE_ID = :P_CASE_ID;
    IF (v_text IS NULL) THEN
        RETURN 'No request text for ' || :P_CASE_ID;
    END IF;
    -- s.21 is a FOIA provision; skip EIR/SAR.
    IF (v_regime <> 'FOI') THEN
        RETURN 's.21 applies to FOI only (' || :P_CASE_ID || ' is ' || COALESCE(:v_regime,'?') || ')';
    END IF;
    -- s.21 reuse is caught at triage, before retrieval work begins.
    LET v_stage VARCHAR;
    SELECT CURRENT_STAGE INTO :v_stage FROM FOI_CASE WHERE CASE_ID = :P_CASE_ID;
    IF (v_stage NOT IN ('RECEIPT','VALIDITY','CLASSIFY','SAR_REDIRECT','DUPLICATE','CLARIFICATION','ALLOCATION')) THEN
        RETURN 's.21 check skipped for ' || :P_CASE_ID || ' (past triage: ' || COALESCE(:v_stage,'?') || ')';
    END IF;
    LET v_threshold FLOAT := (SELECT COALESCE(MAX(CONFIG_VALUE::FLOAT), 0.85)
                              FROM COUNCIL_CONFIG WHERE CONFIG_KEY = 'S21_SIMILARITY_THRESHOLD');
    -- Score the request against the own-published corpus once (exclude self).
    CREATE OR REPLACE TEMPORARY TABLE _s21_scored AS
        SELECT REF, WHERE_TO_FIND, AI_SIMILARITY(:v_text, REQUEST_TEXT) AS SIM
        FROM V_S21_CORPUS
        WHERE REF <> (SELECT REFERENCE FROM FOI_CASE WHERE CASE_ID = :P_CASE_ID);
    LET v_sim FLOAT := (SELECT COALESCE(MAX(SIM), 0) FROM _s21_scored);
    LET v_ref VARCHAR := (SELECT REF FROM _s21_scored ORDER BY SIM DESC, REF ASC LIMIT 1);
    IF (v_sim >= :v_threshold) THEN
        MERGE INTO FOI_TRIAGE t USING (SELECT :P_CASE_ID AS CASE_ID) s ON t.CASE_ID = s.CASE_ID
            WHEN MATCHED THEN UPDATE SET S21_MATCH_REF = :v_ref, COMPUTED_AT = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT (CASE_ID, S21_MATCH_REF, COMPUTED_AT)
                VALUES (:P_CASE_ID, :v_ref, CURRENT_TIMESTAMP());
        INSERT INTO FOI_CASE_EVENT (CASE_ID, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
            VALUES (:P_CASE_ID, 'AI', 'AI_SIMILARITY', 'DECISION',
                    's.21 reuse candidate: matches ' || :v_ref || ' at ' || ROUND(100 * :v_sim) || '% (already published)');
        RETURN 's.21 match for ' || :P_CASE_ID || ': ' || :v_ref || ' (' || ROUND(100 * :v_sim) || '%)';
    ELSE
        UPDATE FOI_TRIAGE SET S21_MATCH_REF = NULL
            WHERE CASE_ID = :P_CASE_ID AND S21_MATCH_REF IS NOT NULL;
        RETURN 'No s.21 match for ' || :P_CASE_ID || ' (closest ' || ROUND(100 * COALESCE(:v_sim, 0)) || '%)';
    END IF;
END;

-- Sweep all open FOI cases (call after intake / on demand). Set-based.
CREATE OR REPLACE PROCEDURE SP_REFRESH_S21_FLAGS()
RETURNS STRING LANGUAGE SQL AS
BEGIN
    LET v_threshold FLOAT := (SELECT COALESCE(MAX(CONFIG_VALUE::FLOAT), 0.85)
                              FROM COUNCIL_CONFIG WHERE CONFIG_KEY = 'S21_SIMILARITY_THRESHOLD');
    CREATE OR REPLACE TEMPORARY TABLE _s21_best AS
        WITH oc AS (
            SELECT CASE_ID, REFERENCE, REQUEST_TEXT
            FROM FOI_CASE WHERE STATUS = 'OPEN' AND REGIME = 'FOI' AND REQUEST_TEXT IS NOT NULL
              AND CURRENT_STAGE IN ('RECEIPT','VALIDITY','CLASSIFY','SAR_REDIRECT','DUPLICATE','CLARIFICATION','ALLOCATION')
        ),
        scored AS (
            SELECT oc.CASE_ID, oc.REFERENCE, cor.REF,
                   AI_SIMILARITY(oc.REQUEST_TEXT, cor.REQUEST_TEXT) AS SIM
            FROM oc JOIN V_S21_CORPUS cor
              ON cor.REF <> oc.REFERENCE AND cor.REQUEST_TEXT IS NOT NULL
        )
        SELECT CASE_ID, REF, SIM FROM scored
        QUALIFY ROW_NUMBER() OVER (PARTITION BY CASE_ID ORDER BY SIM DESC, REF ASC) = 1;
    -- Apply matches at/above threshold.
    MERGE INTO FOI_TRIAGE t
        USING (SELECT CASE_ID, REF FROM _s21_best WHERE SIM >= :v_threshold) s
        ON t.CASE_ID = s.CASE_ID
        WHEN MATCHED THEN UPDATE SET S21_MATCH_REF = s.REF, COMPUTED_AT = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (CASE_ID, S21_MATCH_REF, COMPUTED_AT)
            VALUES (s.CASE_ID, s.REF, CURRENT_TIMESTAMP());
    -- Clear stale flags that no longer clear the threshold.
    UPDATE FOI_TRIAGE SET S21_MATCH_REF = NULL
        WHERE S21_MATCH_REF IS NOT NULL
          AND CASE_ID NOT IN (SELECT CASE_ID FROM _s21_best WHERE SIM >= :v_threshold);
    RETURN 'Refreshed s.21 flags; matched '
        || (SELECT COUNT(*) FROM _s21_best WHERE SIM >= :v_threshold)
        || ' of ' || (SELECT COUNT(*) FROM _s21_best) || ' open FOI cases.';
END;

-- Populate flags after cases + disclosure log are seeded (run post-seed).
CALL SP_REFRESH_S21_FLAGS();
