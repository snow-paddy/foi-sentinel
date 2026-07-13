-- =====================================================================
-- FOI Sentinel v2 — WhatDoTheyKnow (WDTK / Alaveteli) integration model
-- Source: whatdotheyknow.com feed/search JSON (mySociety). Browser-mediated
-- pull (Cloudflare-gated; not callable from SPCS egress). The live app reads
-- only these pre-loaded tables — it never calls WDTK directly.
--
-- Re-use: WDTK content is third party (Re-use of PSI Regs 2015). Attribute
-- mySociety, link back to each source request, store snippets not bulk dumps.
-- =====================================================================
USE WAREHOUSE FOI_WH;
USE SCHEMA FOI.FOI_SENTINEL_V2;

-- --- Stage for the raw JSON payload ----------------------------------
CREATE STAGE IF NOT EXISTS WDTK_STAGE
  FILE_FORMAT = (TYPE = JSON, STRIP_OUTER_ARRAY = FALSE);

-- --- Raw landing (whole document as one VARIANT row) -----------------
CREATE OR REPLACE TABLE WDTK_RAW_EVENTS (
    LOADED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    SOURCE    STRING,
    PAYLOAD   VARIANT
);

-- --- Authority benchmark dimension -----------------------------------
CREATE OR REPLACE TABLE WDTK_AUTHORITY (
    AUTHORITY_SLUG    STRING,
    AUTHORITY_NAME    STRING,
    GSS_CODE          STRING,
    REGION            STRING,
    HOME_PAGE         STRING,
    DISCLOSURE_LOG    STRING,
    REQUESTS_COUNT    NUMBER,
    SUCCESSFUL_COUNT  NUMBER,
    NOT_HELD_COUNT    NUMBER,
    OVERDUE_COUNT     NUMBER,
    CLASSIFIED_COUNT  NUMBER,
    SUCCESS_RATE      FLOAT,   -- successful / classified
    OVERDUE_RATE      FLOAT,   -- overdue / classified
    LOADED_AT         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- --- Flattened event / precedent table -------------------------------
CREATE OR REPLACE TABLE WDTK_EVENT (
    EVENT_ID          NUMBER,
    THEME             STRING,   -- exemption bucket the precedent was pulled under
    AUTHORITY_SLUG    STRING,
    AUTHORITY_NAME    STRING,
    CREATED_AT        TIMESTAMP_NTZ,
    CALCULATED_STATE  STRING,
    DISPLAY_STATUS    STRING,
    OUTCOME           STRING,   -- normalised outcome (deterministic mapping)
    LAW_USED          STRING,   -- foi | eir
    EXEMPTIONS        STRING,   -- comma-separated tags detected in the snippet
    REQUEST_ID        NUMBER,
    REQUEST_TITLE     STRING,
    URL_TITLE         STRING,
    REQUEST_URL       STRING,
    SNIPPET           STRING,
    LOADED_AT         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- =====================================================================
-- Load step is performed by 02_seed_data/04_load_wdtk.sql after PUT.
-- =====================================================================

-- --- Peer benchmark view (Bristol vs peer medians) -------------------
CREATE OR REPLACE VIEW V_WDTK_BENCHMARK AS
SELECT
    AUTHORITY_SLUG,
    AUTHORITY_NAME,
    REGION,
    REQUESTS_COUNT,
    CLASSIFIED_COUNT,
    SUCCESS_RATE,
    OVERDUE_RATE,
    NOT_HELD_COUNT / NULLIF(CLASSIFIED_COUNT, 0)        AS NOT_HELD_RATE,
    MEDIAN(SUCCESS_RATE)  OVER ()                       AS PEER_MEDIAN_SUCCESS,
    MEDIAN(OVERDUE_RATE)  OVER ()                       AS PEER_MEDIAN_OVERDUE,
    AVG(SUCCESS_RATE)     OVER ()                       AS PEER_AVG_SUCCESS,
    AVG(OVERDUE_RATE)     OVER ()                       AS PEER_AVG_OVERDUE,
    RANK() OVER (ORDER BY SUCCESS_RATE DESC)            AS SUCCESS_RANK,
    RANK() OVER (ORDER BY OVERDUE_RATE ASC)             AS OVERDUE_RANK,
    COUNT(*) OVER ()                                    AS PEER_COUNT
FROM WDTK_AUTHORITY;

-- --- Theme / exemption mix across peers ------------------------------
CREATE OR REPLACE VIEW V_WDTK_THEME_MIX AS
SELECT
    THEME,
    COUNT(*)                                            AS EVENTS,
    COUNT(DISTINCT AUTHORITY_SLUG)                      AS AUTHORITIES,
    SUM(IFF(LAW_USED = 'eir', 1, 0))                    AS EIR_EVENTS,
    SUM(IFF(OUTCOME = 'Refused', 1, 0))                 AS REFUSED,
    SUM(IFF(OUTCOME IN ('Successful','Partially successful'), 1, 0)) AS DISCLOSED
FROM WDTK_EVENT
GROUP BY THEME;
