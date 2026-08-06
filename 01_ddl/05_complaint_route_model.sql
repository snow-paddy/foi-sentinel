-- =====================================================================
-- Complaint-route intelligence model
--   (1) WDTK escalation dimension (operator-backfilled via browser route)
--   (2) ICO / Cabinet Office published outcome statistics (cited)
--
-- Note on provenance: row-level ICO decision notices are NOT server-side
-- ingestable - ico.org.uk renders them via a client-side Funnelback app and
-- the search host (icosearch.ico.org.uk) returns 403 to server fetches, the
-- same bot-protection wall as WDTK. So escalation-risk is grounded in the
-- ACCREDITED official statistics (Cabinet Office FOI statistics annual 2025
-- and ICO published figures) rather than invented notice rows. ICO_DECISION_NOTICE
-- (01_ddl/04) remains as a reserved schema for a future authorised feed.
-- =====================================================================
USE ROLE ACCOUNTADMIN;
USE DATABASE FOI;
USE SCHEMA FOI_SENTINEL_V2;

-- (1) WDTK escalation state (e.g. internal_review, awaiting_ico). Nullable;
-- backfilled by the operator-initiated WDTK browser pull. Most events have none.
ALTER TABLE WDTK_EVENT ADD COLUMN IF NOT EXISTS ESCALATION_STATE VARCHAR;

-- (2a) Per-exemption profile from official statistics. Only fields that are
-- published and defensible are populated; SOURCE is recorded on every row.
CREATE OR REPLACE TABLE ICO_EXEMPTION_PROFILE (
    EXEMPTION_THEME   VARCHAR,   -- aligns with WDTK/GLA theme vocabulary
    LABEL             VARCHAR,
    SHARE_OF_WITHHELD NUMBER(5,3),  -- proportion of withheld requests engaging this exemption (2025)
    NOTE              VARCHAR,
    SOURCE            VARCHAR,
    SOURCE_YEAR       INT
);

INSERT INTO ICO_EXEMPTION_PROFILE (EXEMPTION_THEME, LABEL, SHARE_OF_WITHHELD, NOTE, SOURCE, SOURCE_YEAR) VALUES
 ('s12_cost',      'Section 12 - cost limit',              0.266, 'Engaged the appropriate-cost limit; requires a defensible cost estimate.', 'Cabinet Office FOI statistics annual 2025', 2025),
 ('s14_vexatious', 'Section 14 - vexatious / repeated',    0.027, 'Refused as vexatious or repeated; requires evidence of a pattern of behaviour.', 'Cabinet Office FOI statistics annual 2025', 2025),
 ('s40_personal',  'Section 40 - personal information',    NULL,  'Within the 70.7% of withheld requests engaging other exemptions (s22-44), s40 is the most commonly cited - the exemption most likely to require redaction.', 'Cabinet Office FOI statistics annual 2025', 2025),
 ('s43_commercial','Section 43 - commercial interests',    NULL,  'Within the s22-44 group; public-interest test applies.', 'Cabinet Office FOI statistics annual 2025', 2025),
 ('s21_published', 'Section 21 - reasonably accessible',   NULL,  'Information already available by other means; low escalation risk.', 'Cabinet Office FOI statistics annual 2025', 2025),
 ('eir_environmental','EIR - environmental information',   NULL,  'EIR has no cost-limit refusal; complex cases allow up to 40 working days.', 'Environmental Information Regulations 2004', 2025),
 ('other',         'Other / unclassified',                 0.707, 'Other exemptions (s22-44) accounted for 70.7% of withheld requests.', 'Cabinet Office FOI statistics annual 2025', 2025);

-- (2b) Account-level review / ICO outcome statistics (single authoritative row set).
CREATE OR REPLACE TABLE ICO_OUTCOME_BENCHMARK (
    METRIC      VARCHAR,
    VALUE       NUMBER(12,3),
    UNIT        VARCHAR,
    NOTE        VARCHAR,
    SOURCE      VARCHAR,
    SOURCE_YEAR INT
);

INSERT INTO ICO_OUTCOME_BENCHMARK (METRIC, VALUE, UNIT, NOTE, SOURCE, SOURCE_YEAR) VALUES
 ('internal_reviews_initiated', 4720, 'count',   'Internal reviews initiated on withheld requests.', 'Cabinet Office FOI statistics annual 2025', 2025),
 ('internal_review_overturn_rate', 0.28, 'ratio', 'Internal reviews that overturned the original decision fully or partially.', 'Cabinet Office FOI statistics annual 2025', 2025),
 ('internal_review_in_time_rate', 0.43, 'ratio', 'Internal reviews completed within 20 working days (down from 47%).', 'Cabinet Office FOI statistics annual 2025', 2025),
 ('ico_complaints_known', 716, 'count',           'Known complaints to the Information Commissioner (up from 640 in 2024).', 'Cabinet Office FOI statistics annual 2025', 2025),
 ('requests_withheld_full_rate', 0.35, 'ratio',   'Resolvable requests withheld in full.', 'Cabinet Office FOI statistics annual 2025', 2025),
 ('requests_withheld_part_rate', 0.21, 'ratio',   'Resolvable requests withheld in part.', 'Cabinet Office FOI statistics annual 2025', 2025);

-- (2c) Escalation-risk view: official per-exemption profile blended with our
-- real observed outcomes from WDTK (refusal-heavy themes escalate more) and
-- GLA. Consumed by the escalation-risk flag in the case workspace.
CREATE OR REPLACE VIEW V_ESCALATION_RISK AS
WITH wdtk AS (
    SELECT THEME,
           COUNT(*) AS WDTK_N,
           AVG(IFF(OUTCOME IN ('Refused', 'Partially successful', 'Information not held'), 1, 0)) AS WDTK_NOT_FULLY_MET_RATE
    FROM WDTK_EVENT GROUP BY THEME
),
gla AS (
    SELECT THEME, COUNT(*) AS GLA_N FROM GLA_DISCLOSURE_LOG GROUP BY THEME
),
ovr AS (
    SELECT MAX(IFF(METRIC = 'internal_review_overturn_rate', VALUE, NULL)) AS OVERTURN_RATE,
           MAX(IFF(METRIC = 'internal_review_in_time_rate', VALUE, NULL))  AS REVIEW_IN_TIME_RATE
    FROM ICO_OUTCOME_BENCHMARK
)
SELECT p.EXEMPTION_THEME,
       p.LABEL,
       p.SHARE_OF_WITHHELD,
       p.NOTE,
       p.SOURCE,
       p.SOURCE_YEAR,
       COALESCE(w.WDTK_N, 0)              AS WDTK_N,
       w.WDTK_NOT_FULLY_MET_RATE,
       COALESCE(g.GLA_N, 0)               AS GLA_N,
       o.OVERTURN_RATE,
       o.REVIEW_IN_TIME_RATE
FROM ICO_EXEMPTION_PROFILE p
LEFT JOIN wdtk w ON w.THEME = p.EXEMPTION_THEME
LEFT JOIN gla  g ON g.THEME = p.EXEMPTION_THEME
CROSS JOIN ovr o;

SELECT 'Complaint-route benchmark model ready' AS STATUS;
