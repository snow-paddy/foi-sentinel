-- =====================================================================
-- 01_camden_soda_api.sql
-- Load Camden FOI responses from the Socrata SODA API into Snowflake.
--
-- Prerequisites:
--   1. A network rule and External Access Integration allowing outbound
--      HTTPS to opendata.camden.gov.uk (created below; ACCOUNTADMIN required).
--   2. FOI.FOI_SENTINEL_V2.CAMDEN_FOI_RESPONSES table (created by
--      01_ddl/01_schema_and_case_model.sql).
--
-- After setup, run: CALL SP_LOAD_CAMDEN_FOI_RESPONSES(50);
--   The argument is the maximum number of API pages to fetch (1,000 rows/page).
--   Pass a high number (e.g. 50) to load all ~11,420 rows; pass a small number
--   to do a trial run.
--
-- Source: Camden open data (OGL). Dataset fkj6-gqb4 on opendata.camden.gov.uk.
-- Note: an older dataset ID (j7mk-4ya8) has been made private; fkj6-gqb4 is the
-- current public endpoint (12,000+ rows, same schema, no authentication needed).
-- =====================================================================

USE ROLE ACCOUNTADMIN;
USE DATABASE FOI;
USE SCHEMA FOI_SENTINEL_V2;
USE WAREHOUSE FOI_WH;

-- ---------------------------------------------------------------------
-- Network rule: allow HTTPS egress to Camden's open data portal
-- ---------------------------------------------------------------------
CREATE NETWORK RULE IF NOT EXISTS CAMDEN_OPENDATA_RULE
    MODE = EGRESS
    TYPE = HOST_PORT
    VALUE_LIST = ('opendata.camden.gov.uk:443');

-- ---------------------------------------------------------------------
-- External Access Integration
-- ---------------------------------------------------------------------
CREATE EXTERNAL ACCESS INTEGRATION IF NOT EXISTS CAMDEN_OPENDATA_EAI
    ALLOWED_NETWORK_RULES = (CAMDEN_OPENDATA_RULE)
    ENABLED = TRUE;

-- ---------------------------------------------------------------------
-- Loading procedure
--   Paginates through the SODA JSON API, transforming each row into the
--   CAMDEN_FOI_RESPONSES schema. Skips rows already present by primary key
--   (IDENTIFIER) to make the procedure safe to re-run.
--
-- Note: confirm the exact Socrata field names against the dataset before
--   running. Use:
--     GET https://opendata.camden.gov.uk/api/views/j7mk-4ya8.json
--   and look at the `columns[].fieldName` values.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_LOAD_CAMDEN_FOI_RESPONSES(P_MAX_PAGES INT)
    RETURNS VARCHAR
    LANGUAGE PYTHON
    RUNTIME_VERSION = '3.11'
    HANDLER = 'run'
    EXTERNAL_ACCESS_INTEGRATIONS = (CAMDEN_OPENDATA_EAI)
    PACKAGES = ('snowflake-snowpark-python', 'requests')
AS
$$
import requests

ENDPOINT = 'https://opendata.camden.gov.uk/resource/fkj6-gqb4.json'
PAGE_SIZE = 1000
HEADERS   = {'Accept': 'application/json',
             'User-Agent': 'FOI-Sentinel/1.0 (data re-use; public open data)'}

# Socrata field names (verified against fkj6-gqb4 — public dataset).
# To inspect metadata: GET https://opendata.camden.gov.uk/api/views/fkj6-gqb4.json
F_ID     = 'identifier'
F_DATE   = 'document_date'
F_TITLE  = 'document_title'
F_TEXT   = 'document_text'
F_LINK   = 'document_link'
F_UPLOAD = 'last_uploaded'

def esc(v):
    return ("'" + str(v).replace("'", "''") + "'") if v else 'NULL'

def run(session, p_max_pages):
    total_new = 0
    total_updated = 0

    for page in range(p_max_pages):
        params = {'$limit': PAGE_SIZE, '$offset': page * PAGE_SIZE,
                  '$order': ':id'}
        resp = requests.get(ENDPOINT, headers=HEADERS, params=params, timeout=30)
        resp.raise_for_status()
        rows = resp.json()
        if not rows:
            break

        for r in rows:
            identifier    = r.get(F_ID, '')
            document_date = r.get(F_DATE)
            title         = r.get(F_TITLE, '')
            text          = r.get(F_TEXT, '')
            link          = r.get(F_LINK, '')
            last_uploaded = r.get(F_UPLOAD)

            dval = f"TRY_TO_DATE({esc(document_date[:10])})" if document_date else 'NULL'
            uval = f"TRY_TO_DATE({esc(last_uploaded[:10])})" if last_uploaded else 'NULL'

            result = session.sql(f"""
                MERGE INTO CAMDEN_FOI_RESPONSES t
                USING (SELECT {esc(identifier)} AS ID) s ON t.IDENTIFIER = s.ID
                WHEN MATCHED THEN UPDATE SET
                    DOCUMENT_DATE   = {dval},
                    DOCUMENT_TITLE  = {esc(title[:500])},
                    DOCUMENT_TEXT   = {esc(text[:50000])},
                    DOCUMENT_LINK   = {esc(link)},
                    LAST_UPLOADED   = {uval}
                WHEN NOT MATCHED THEN INSERT
                    (IDENTIFIER, DOCUMENT_DATE, DOCUMENT_TITLE,
                     DOCUMENT_TEXT, DOCUMENT_LINK, LAST_UPLOADED)
                    VALUES ({esc(identifier)}, {dval}, {esc(title[:500])},
                            {esc(text[:50000])}, {esc(link)}, {uval})
            """).collect()

            if result:
                total_new     += result[0][0] or 0
                total_updated += result[0][1] or 0 if len(result[0]) > 1 else 0

    return (f"Camden load complete: {page + 1} page(s) fetched, "
            f"{total_new} rows inserted, {total_updated} rows updated.")
$$;

SELECT 'Camden SODA API loader ready. Run: CALL SP_LOAD_CAMDEN_FOI_RESPONSES(50);' AS STATUS;
