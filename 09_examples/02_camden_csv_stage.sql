-- =====================================================================
-- 02_camden_csv_stage.sql
-- Bulk-load Camden FOI responses from a CSV export.
--
-- Use this when a quick one-time load is preferred over the API approach.
--
-- Steps:
--   1. Download the dataset as CSV from Camden's open data portal:
--      https://opendata.camden.gov.uk/resource/j7mk-4ya8.csv
--      (or use the portal UI: Datasets → Camden FOI Responses → Export → CSV)
--   2. Upload the file to a Snowflake internal stage (see below).
--   3. Run the COPY INTO statement.
--
-- Source: Camden open data (OGL). Dataset j7mk-4ya8 on opendata.camden.gov.uk.
-- =====================================================================

USE ROLE ACCOUNTADMIN;
USE DATABASE FOI;
USE SCHEMA FOI_SENTINEL_V2;
USE WAREHOUSE FOI_WH;

-- ---------------------------------------------------------------------
-- Create a named stage for the upload (skip if you prefer a user stage).
-- ---------------------------------------------------------------------
CREATE STAGE IF NOT EXISTS CAMDEN_LOAD_STAGE
    COMMENT = 'Temporary stage for Camden FOI CSV load';

-- Upload the file via Snowsight (Data → Databases → FOI → FOI_SENTINEL_V2 →
-- Stages → CAMDEN_LOAD_STAGE → Upload files), or via the CLI:
--   snow stage copy ./camden_foi.csv @FOI.FOI_SENTINEL_V2.CAMDEN_LOAD_STAGE --connection <your-connection>

-- ---------------------------------------------------------------------
-- Load the CSV.
-- Adjust SKIP_HEADER, column order and field names to match the actual export.
-- The Socrata CSV export includes a header row and uses the column names from
-- the dataset. Use:
--   SELECT $1, $2, $3 ... FROM @CAMDEN_LOAD_STAGE LIMIT 5;
-- to inspect column order before running the full load.
-- ---------------------------------------------------------------------
COPY INTO CAMDEN_FOI_RESPONSES (
    IDENTIFIER,
    DOCUMENT_DATE,
    DOCUMENT_TITLE,
    DOCUMENT_TEXT,
    DOCUMENT_LINK,
    LAST_UPLOADED
)
FROM (
    SELECT
        $1,                           -- identifier
        TRY_TO_DATE($2, 'YYYY-MM-DD'),-- document_date
        $3,                           -- document_title
        $4,                           -- document_text
        $5,                           -- document_link
        TRY_TO_DATE($6, 'YYYY-MM-DD') -- last_uploaded
    FROM @CAMDEN_LOAD_STAGE
)
FILE_FORMAT = (
    TYPE = CSV
    FIELD_OPTIONALLY_ENCLOSED_BY = '"'
    SKIP_HEADER = 1
    NULL_IF = ('', 'NULL')
    EMPTY_FIELD_AS_NULL = TRUE
)
ON_ERROR = CONTINUE; -- log bad rows rather than halting the load

-- Verify row count
SELECT COUNT(*) AS ROWS_LOADED FROM CAMDEN_FOI_RESPONSES;
