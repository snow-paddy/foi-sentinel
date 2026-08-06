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

-- Persist the match SCORE, not just the reference. The app renders it as a
-- "% match" chip beside the s.21 flag, and it is the basis for element-level
-- partial-s.21 coverage (see docs/roadmap/04-partial-s21-percentage-match.md).
ALTER TABLE FOI_TRIAGE ADD COLUMN IF NOT EXISTS S21_SIMILARITY_PCT NUMBER(5,2);

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
  AND c.OUTCOME IN ('GRANTED_FULL','GRANTED_PARTIAL','GRANTED_PARTIAL_S21')
  AND c.REQUEST_TEXT IS NOT NULL;

-- Flag a single case if its closest own-published match clears the threshold.
-- Body is $$-quoted so the file can be executed as a whole (snow sql -f splits on
-- semicolons, which would otherwise shred a BEGIN...END block).
CREATE OR REPLACE PROCEDURE SP_FLAG_S21_REUSE(P_CASE_ID VARCHAR)
RETURNS VARCHAR LANGUAGE SQL AS
$$
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
    -- Score the request against the own-published corpus ONCE and keep the best
    -- match. A TEMPORARY table cannot be used: Snowflake Native Apps do not support
    -- them, and this procedure has to survive being packaged. A CTE cannot span
    -- statements either, so the reference and its score come back together from a
    -- single scalar subquery. That matters beyond tidiness: AI_SIMILARITY is a
    -- billed AI call, so scoring the corpus twice would double the cost of every
    -- intake, which is exactly what the previous temp-table read pattern hid.
    LET v_best VARIANT := (
        SELECT OBJECT_CONSTRUCT('ref', REF, 'sim', SIM)
        FROM (
            SELECT REF, AI_SIMILARITY(:v_text, REQUEST_TEXT) AS SIM
            FROM V_S21_CORPUS
            WHERE REQUEST_TEXT IS NOT NULL
              AND REF <> (SELECT REFERENCE FROM FOI_CASE WHERE CASE_ID = :P_CASE_ID)
            ORDER BY SIM DESC, REF ASC
            LIMIT 1
        )
    );
    -- An empty corpus yields NULL rather than an error, so default the score to 0.
    LET v_sim FLOAT       := COALESCE(:v_best:sim::FLOAT, 0);
    LET v_ref VARCHAR     := :v_best:ref::VARCHAR;
    LET v_pct NUMBER(5,2) := ROUND(100 * :v_sim, 2);
    IF (v_sim >= :v_threshold) THEN
        MERGE INTO FOI_TRIAGE t USING (SELECT :P_CASE_ID AS CASE_ID) s ON t.CASE_ID = s.CASE_ID
            WHEN MATCHED THEN UPDATE SET S21_MATCH_REF = :v_ref, S21_SIMILARITY_PCT = :v_pct, COMPUTED_AT = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT (CASE_ID, S21_MATCH_REF, S21_SIMILARITY_PCT, COMPUTED_AT)
                VALUES (:P_CASE_ID, :v_ref, :v_pct, CURRENT_TIMESTAMP());
        INSERT INTO FOI_CASE_EVENT (CASE_ID, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
            VALUES (:P_CASE_ID, 'AI', 'AI_SIMILARITY', 'DECISION',
                    's.21 reuse candidate: matches ' || :v_ref || ' at ' || :v_pct || '% (already published)');
        RETURN 's.21 match for ' || :P_CASE_ID || ': ' || :v_ref || ' (' || :v_pct || '%)';
    ELSE
        UPDATE FOI_TRIAGE SET S21_MATCH_REF = NULL, S21_SIMILARITY_PCT = NULL
            WHERE CASE_ID = :P_CASE_ID AND S21_MATCH_REF IS NOT NULL;
        RETURN 'No s.21 match for ' || :P_CASE_ID || ' (closest ' || :v_pct || '%)';
    END IF;
END;
$$;

-- Working table for the sweep. Deliberately PERMANENT rather than TEMPORARY:
-- Native Apps do not support temporary tables, and the sweep reads its scored set
-- four times (the merge, the stale-flag clear, and two counts for the return
-- message) across separate statements, which a CTE cannot span. Materialising it
-- once also holds the sweep to a single AI_SIMILARITY pass -- re-deriving the set
-- per statement would multiply the AI cost by four. It doubles as an audit of the
-- most recent scoring pass, including the near-misses that did not clear the bar.
CREATE TABLE IF NOT EXISTS S21_SWEEP_SCRATCH (
    CASE_ID  VARCHAR,
    REF      VARCHAR,
    SIM      FLOAT,
    SIM_PCT  NUMBER(5,2),
    SWEPT_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
) COMMENT = 'Best s.21 match per open FOI case from the last SP_REFRESH_S21_FLAGS sweep. Truncated and repopulated each run.';

-- Sweep all open FOI cases (call after intake / on demand). Set-based.
CREATE OR REPLACE PROCEDURE SP_REFRESH_S21_FLAGS()
RETURNS STRING LANGUAGE SQL AS
$$
BEGIN
    LET v_threshold FLOAT := (SELECT COALESCE(MAX(CONFIG_VALUE::FLOAT), 0.85)
                              FROM COUNCIL_CONFIG WHERE CONFIG_KEY = 'S21_SIMILARITY_THRESHOLD');
    TRUNCATE TABLE S21_SWEEP_SCRATCH;
    INSERT INTO S21_SWEEP_SCRATCH (CASE_ID, REF, SIM, SIM_PCT)
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
        SELECT CASE_ID, REF, SIM, ROUND(100 * SIM, 2) AS SIM_PCT FROM scored
        QUALIFY ROW_NUMBER() OVER (PARTITION BY CASE_ID ORDER BY SIM DESC, REF ASC) = 1;
    -- Apply matches at/above threshold, persisting the score alongside the ref.
    MERGE INTO FOI_TRIAGE t
        USING (SELECT CASE_ID, REF, SIM_PCT FROM S21_SWEEP_SCRATCH WHERE SIM >= :v_threshold) s
        ON t.CASE_ID = s.CASE_ID
        WHEN MATCHED THEN UPDATE SET S21_MATCH_REF = s.REF, S21_SIMILARITY_PCT = s.SIM_PCT, COMPUTED_AT = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (CASE_ID, S21_MATCH_REF, S21_SIMILARITY_PCT, COMPUTED_AT)
            VALUES (s.CASE_ID, s.REF, s.SIM_PCT, CURRENT_TIMESTAMP());
    -- Clear stale flags (and their scores) that no longer clear the threshold.
    UPDATE FOI_TRIAGE SET S21_MATCH_REF = NULL, S21_SIMILARITY_PCT = NULL
        WHERE S21_MATCH_REF IS NOT NULL
          AND CASE_ID NOT IN (SELECT CASE_ID FROM S21_SWEEP_SCRATCH WHERE SIM >= :v_threshold);
    RETURN 'Refreshed s.21 flags; matched '
        || (SELECT COUNT(*) FROM S21_SWEEP_SCRATCH WHERE SIM >= :v_threshold)
        || ' of ' || (SELECT COUNT(*) FROM S21_SWEEP_SCRATCH) || ' open FOI cases.';
END;
$$;

-- Populate flags after cases + disclosure log are seeded (run post-seed).
CALL SP_REFRESH_S21_FLAGS();
