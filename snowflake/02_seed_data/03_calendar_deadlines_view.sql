-- =====================================================================
-- FOI Sentinel v2 — Phase 4b: Calendar, set-based deadlines, view, artefacts
-- NOTE: deadlines are computed set-based via CALENDAR (the FN_ADD_WORKING_DAYS
-- UDF contains a subquery and cannot be used in correlated multi-row INSERTs).
-- The scalar UDFs remain for single-row use inside stored procedures.
-- =====================================================================
USE WAREHOUSE FOI_WH; USE SCHEMA FOI.FOI_SENTINEL_V2;

-- Working-day calendar with cumulative working-day index (2024-2028)
CREATE OR REPLACE TABLE CALENDAR AS
SELECT CAL_DATE,
       (DAYOFWEEKISO(CAL_DATE) < 6 AND CAL_DATE NOT IN (SELECT HOLIDAY_DATE FROM UK_BANK_HOLIDAYS)) AS IS_WORKING_DAY
FROM (SELECT DATEADD('day', SEQ4(), '2024-01-01'::DATE) AS CAL_DATE FROM TABLE(GENERATOR(ROWCOUNT => 1827)));
CREATE OR REPLACE TABLE CALENDAR AS
SELECT CAL_DATE, IS_WORKING_DAY,
       SUM(IFF(IS_WORKING_DAY,1,0)) OVER (ORDER BY CAL_DATE ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS WD_INDEX
FROM CALENDAR;

-- Statutory deadlines (20 WD; 40 WD for EIR complex stages; SAR = 1 calendar month)
UPDATE FOI_CASE c SET STATUTORY_DEADLINE = sub.DL
FROM (
  SELECT ca.CASE_ID, cal2.CAL_DATE AS DL
  FROM FOI_CASE ca
  JOIN CALENDAR rcv  ON rcv.CAL_DATE = ca.RECEIVED_DATE
  JOIN CALENDAR cal2 ON cal2.IS_WORKING_DAY
       AND cal2.WD_INDEX = rcv.WD_INDEX + (CASE WHEN ca.REGIME='EIR' AND ca.CURRENT_STAGE IN ('COST','EXEMPTIONS','PIT') THEN 40 ELSE 20 END)
  WHERE ca.REGIME <> 'SAR'
) sub WHERE c.CASE_ID = sub.CASE_ID;
UPDATE FOI_CASE SET STATUTORY_DEADLINE = DATEADD('day',30,RECEIVED_DATE) WHERE REGIME='SAR';
UPDATE FOI_CASE SET ANSWERED_IN_TIME = (CLOSED_DATE <= STATUTORY_DEADLINE) WHERE STATUS='CLOSED';
UPDATE FOI_CASE SET CLOCK_STOPPED_AT = DATEADD('day',-2,CURRENT_DATE()) WHERE CLOCK_STATE='STOPPED_CLARIFICATION';
UPDATE FOI_CASE c SET WORKING_DAYS_USED = GREATEST(0, endc.WD_INDEX - rcv.WD_INDEX)
FROM FOI_CASE ca
JOIN CALENDAR rcv  ON rcv.CAL_DATE = ca.RECEIVED_DATE
JOIN CALENDAR endc ON endc.CAL_DATE = COALESCE(ca.CLOSED_DATE, CURRENT_DATE())
WHERE c.CASE_ID = ca.CASE_ID;

-- Case view used by the app (working-days remaining + RAG + live priority).
-- PRIORITY_SCORE/PRIORITY_BAND are computed LIVE from the triage signals stored
-- on FOI_CASE (COMPLEXITY_RANK, SENTIMENT_SCORE, IS_VEXATIOUS) + deadline
-- pressure, so email-intake cases score without any backfill. Transparent and
-- tunable: weights are visible here, not hidden in app code.
--   priority = 0.45*complexity  +  2.5*max(0,-sentiment)  +  deadline_pressure  +  1.0*vexatious   (clamped 0-10)
-- Nested so PRIORITY_BAND can reference PRIORITY_SCORE (Snowflake can't reuse a
-- SELECT alias within the same SELECT level).
CREATE OR REPLACE VIEW V_CASE AS
SELECT p.*,
       CASE WHEN p.PRIORITY_SCORE >= 6 THEN 'HIGH'
            WHEN p.PRIORITY_SCORE >= 4 THEN 'MED'
            ELSE 'LOW' END AS PRIORITY_BAND
FROM (
  SELECT b.*,
         ROUND(LEAST(10, GREATEST(0,
             0.45 * COALESCE(b.COMPLEXITY_RANK, 0)
           + 2.5  * GREATEST(0, -COALESCE(b.SENTIMENT_SCORE, 0))
           + CASE WHEN b.WD_REMAINING IS NULL THEN 1.0
                  WHEN b.WD_REMAINING < 0     THEN 3.0
                  WHEN b.WD_REMAINING <= 5    THEN 2.5
                  WHEN b.WD_REMAINING <= 10   THEN 1.5
                  ELSE 0.5 END
           + 1.0  * IFF(b.IS_VEXATIOUS, 1, 0)
         )), 2) AS PRIORITY_SCORE
  FROM (
    SELECT c.*, s.STAGE_NAME, s.STAGE_ORDER, s.LEGAL_BASIS,
           (dl.WD_INDEX - tdy.WD_INDEX) AS WD_REMAINING,
           CASE WHEN c.STATUS = 'CLOSED' THEN 'CLOSED'
                WHEN c.CLOCK_STATE NOT IN ('RUNNING','PIT_EXTENSION','EIR_COMPLEX') THEN 'PAUSED'
                WHEN (dl.WD_INDEX - tdy.WD_INDEX) <= 5 THEN 'RED'
                WHEN (dl.WD_INDEX - tdy.WD_INDEX) <= 10 THEN 'AMBER'
                ELSE 'GREEN' END AS RAG
    FROM FOI_CASE c
    LEFT JOIN LIFECYCLE_STAGE s ON s.STAGE_CODE = c.CURRENT_STAGE
    LEFT JOIN CALENDAR dl ON dl.CAL_DATE = c.STATUTORY_DEADLINE
    CROSS JOIN (SELECT WD_INDEX FROM CALENDAR WHERE CAL_DATE = CURRENT_DATE()) tdy
  ) b
) p;

-- (Artefacts, derived triage JSON and audit-trail events are seeded in 04_seed_artefacts.sql)
