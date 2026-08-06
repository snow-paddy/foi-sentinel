-- =====================================================================
-- GLA disclosure log + ICO decision notice models
-- Real cross-authority corpora ingested by server-side scrapers
-- (see 04_procedures/03_web_scrapers.sql). Provenance: DATA_SOURCES.md.
-- =====================================================================
USE ROLE ACCOUNTADMIN;
USE DATABASE FOI;
USE SCHEMA FOI_SENTINEL_V2;

-- GLA (london.gov.uk) full request + response, one row per disclosure entry.
CREATE TABLE IF NOT EXISTS GLA_DISCLOSURE_LOG (
    SOURCE_URL        VARCHAR PRIMARY KEY,   -- stable detail-page URL (dedup key)
    REFERENCE_NUMBER  VARCHAR,               -- e.g. MGLA270426-8865
    TITLE             VARCHAR,
    REGIME            VARCHAR,               -- FOI / EIR
    THEME             VARCHAR,               -- exemption-aligned (s12_cost, s40_personal, eir_environmental, ...)
    REQUEST_SUMMARY   VARCHAR,
    RESPONSE_TEXT     VARCHAR,
    RESPONSE_DATE     DATE,
    MONTH_LABEL       VARCHAR,               -- e.g. "May 2026" from the title
    AUTHORITY_NAME    VARCHAR DEFAULT 'Greater London Authority',
    SCRAPED_AT        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ICO decision notices (ico.org.uk): how a complaint resolved.
CREATE TABLE IF NOT EXISTS ICO_DECISION_NOTICE (
    SOURCE_URL    VARCHAR PRIMARY KEY,
    NOTICE_REF    VARCHAR,               -- e.g. IC-123456-A1B2
    AUTHORITY     VARCHAR,
    TITLE         VARCHAR,
    DECISION_DATE DATE,
    EXEMPTIONS    VARCHAR,               -- comma-separated tags (s12, s14, s40, s43, EIR ...)
    OUTCOME       VARCHAR,               -- Upheld / Not upheld / Partly upheld
    SUMMARY       VARCHAR,
    SCRAPED_AT    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Evaluation gold-set: clean GLA request->response pairs as a held-out benchmark
-- for drafting (conciseness + grounded accuracy). Serves the objective of cutting
-- through verbose AI - real published responses are the yardstick.
CREATE OR REPLACE VIEW GLA_EVAL_PAIRS AS
SELECT REFERENCE_NUMBER, TITLE, REGIME, THEME,
       REQUEST_SUMMARY AS REQUEST,
       RESPONSE_TEXT   AS GOLD_RESPONSE,
       RESPONSE_DATE, SOURCE_URL,
       LENGTH(RESPONSE_TEXT) AS GOLD_LEN
FROM GLA_DISCLOSURE_LOG
WHERE LENGTH(REQUEST_SUMMARY) > 20 AND LENGTH(RESPONSE_TEXT) > 80;

SELECT 'GLA + ICO models ready' AS STATUS;
