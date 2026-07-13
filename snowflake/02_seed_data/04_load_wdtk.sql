-- =====================================================================
-- FOI Sentinel v2 — Load WhatDoTheyKnow JSON into the WDTK model
-- Prereq: 01_ddl/02_wdtk_model.sql has created the tables/stage.
-- Run with:  snow sql --connection PG-SNOWFLAKE -f 02_seed_data/04_load_wdtk.sql
-- (the PUT line uses a local path; adjust if running elsewhere)
-- =====================================================================
USE WAREHOUSE FOI_WH;
USE SCHEMA FOI.FOI_SENTINEL_V2;

-- 1) Stage the raw JSON (single-document file)
PUT 'file:///Users/pgardner/Desktop/Finito/FOI/foi_sentinel_v2/02_seed_data/wdtk_raw.json'
    @WDTK_STAGE OVERWRITE = TRUE AUTO_COMPRESS = FALSE;

-- 2) Land the whole document as one VARIANT row
TRUNCATE TABLE WDTK_RAW_EVENTS;
COPY INTO WDTK_RAW_EVENTS (SOURCE, PAYLOAD)
FROM (
    SELECT $1:source::STRING, $1
    FROM @WDTK_STAGE/wdtk_raw.json
)
FILE_FORMAT = (TYPE = JSON, STRIP_OUTER_ARRAY = FALSE)
FORCE = TRUE;

-- 3) Authority benchmark dimension (one row per authority)
TRUNCATE TABLE WDTK_AUTHORITY;
INSERT INTO WDTK_AUTHORITY
    (AUTHORITY_SLUG, AUTHORITY_NAME, GSS_CODE, REGION, HOME_PAGE, DISCLOSURE_LOG,
     REQUESTS_COUNT, SUCCESSFUL_COUNT, NOT_HELD_COUNT, OVERDUE_COUNT, CLASSIFIED_COUNT,
     SUCCESS_RATE, OVERDUE_RATE)
SELECT
    a.value:slug::STRING,
    a.value:name::STRING,
    a.value:gss::STRING,
    a.value:region::STRING,
    a.value:home_page::STRING,
    a.value:disclosure_log::STRING,
    a.value:requests_count::NUMBER,
    a.value:successful_count::NUMBER,
    a.value:not_held_count::NUMBER,
    a.value:overdue_count::NUMBER,
    a.value:classified_count::NUMBER,
    ROUND(a.value:successful_count::NUMBER / NULLIF(a.value:classified_count::NUMBER, 0), 4),
    ROUND(a.value:overdue_count::NUMBER    / NULLIF(a.value:classified_count::NUMBER, 0), 4)
FROM WDTK_RAW_EVENTS r,
     LATERAL FLATTEN(input => r.PAYLOAD:authorities) a;

-- 4) Flattened event / precedent table
--    OUTCOME normalised from calculated_state + display_status (deterministic).
--    EXEMPTIONS tagged by keyword/regex on the response snippet.
TRUNCATE TABLE WDTK_EVENT;
INSERT INTO WDTK_EVENT
    (EVENT_ID, THEME, AUTHORITY_SLUG, AUTHORITY_NAME, CREATED_AT, CALCULATED_STATE,
     DISPLAY_STATUS, OUTCOME, LAW_USED, EXEMPTIONS, REQUEST_ID, REQUEST_TITLE,
     URL_TITLE, REQUEST_URL, SNIPPET)
SELECT
    e.value:event_id::NUMBER,
    e.value:theme::STRING,
    e.value:authority_slug::STRING,
    e.value:authority_name::STRING,
    TRY_TO_TIMESTAMP_NTZ(e.value:created_at::STRING),
    e.value:calculated_state::STRING,
    e.value:display_status::STRING,
    -- normalised outcome
    CASE
        WHEN e.value:calculated_state::STRING = 'successful'            THEN 'Successful'
        WHEN e.value:calculated_state::STRING = 'partially_successful'  THEN 'Partially successful'
        WHEN e.value:calculated_state::STRING = 'rejected'              THEN 'Refused'
        WHEN e.value:calculated_state::STRING = 'not_held'              THEN 'Information not held'
        WHEN e.value:calculated_state::STRING IN ('waiting_response','waiting_clarification','internal_review')
                                                                       THEN 'In progress'
        WHEN e.value:display_status::STRING IN ('Successful','Partially successful','Refused','Information not held')
                                                                       THEN e.value:display_status::STRING
        ELSE 'Response (unclassified)'
    END,
    e.value:law_used::STRING,
    -- exemption tags detected in the snippet (statutory references)
    TRIM(
        IFF(e.value:snippet::STRING ILIKE '%section 12%' OR e.value:snippet::STRING ILIKE '%appropriate limit%', 's12 ', '') ||
        IFF(e.value:snippet::STRING ILIKE '%section 14%' OR e.value:snippet::STRING ILIKE '%vexatious%',          's14 ', '') ||
        IFF(e.value:snippet::STRING ILIKE '%section 21%' OR e.value:snippet::STRING ILIKE '%reasonably accessible%', 's21 ', '') ||
        IFF(e.value:snippet::STRING ILIKE '%section 40%' OR e.value:snippet::STRING ILIKE '%personal data%',      's40 ', '') ||
        IFF(e.value:snippet::STRING ILIKE '%section 43%' OR e.value:snippet::STRING ILIKE '%commercial interest%','s43 ', '') ||
        IFF(e.value:snippet::STRING ILIKE '%regulation 12%' OR e.value:snippet::STRING ILIKE '%environmental information%', 'EIR ', '')
    ),
    e.value:request_id::NUMBER,
    e.value:request_title::STRING,
    e.value:url_title::STRING,
    'https://www.whatdotheyknow.com/request/' || e.value:url_title::STRING,
    e.value:snippet::STRING
FROM WDTK_RAW_EVENTS r,
     LATERAL FLATTEN(input => r.PAYLOAD:events) e;

-- 5) Sanity checks
SELECT 'authorities' AS TBL, COUNT(*) AS N FROM WDTK_AUTHORITY
UNION ALL SELECT 'events', COUNT(*) FROM WDTK_EVENT;

SELECT AUTHORITY_NAME, REQUESTS_COUNT, SUCCESS_RATE, OVERDUE_RATE
FROM WDTK_AUTHORITY ORDER BY SUCCESS_RATE DESC;
