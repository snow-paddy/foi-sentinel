-- WI-12 Item 2: FOIA/EIR legislation as a Cortex Search service + registry entry.
-- Indexes FOI_LEGISLATION (statute sections, ICO Code of Practice, procedures) so grounded
-- letters can cite the actual legal basis / exemption reasoning. Wired into gatherGroundedSources()
-- as a VERIFIED reference source (lib/queries.ts).

USE ROLE ACCOUNTADMIN;
USE DATABASE FOI;
USE SCHEMA FOI_SENTINEL_V2;
USE WAREHOUSE FOI_WH;

CREATE OR REPLACE CORTEX SEARCH SERVICE FOI.FOI_SENTINEL_V2.FOI_LEGISLATION_SEARCH
  ON SEARCH_TEXT
  ATTRIBUTES SECTION_REF, TYPE, TITLE, PUBLIC_INTEREST_TEST
  WAREHOUSE = FOI_WH
  TARGET_LAG = '1 hour'
  EMBEDDING_MODEL = 'snowflake-arctic-embed-m-v1.5'
  AS (
    SELECT
      SECTION_REF, TYPE, TITLE, PUBLIC_INTEREST_TEST, SUMMARY,
      TITLE || ' (' || SECTION_REF || '). ' || SUMMARY || ' ' || COALESCE(DETAILS, '') AS SEARCH_TEXT
    FROM FOI.FOI_SENTINEL_V2.FOI_LEGISLATION
  );

-- Trust-catalogue entry so the provenance strip resolves legislation citations. VERIFIED reference
-- (authoritative statute), distinct SOURCE_KIND = 'LEGISLATION'. SOURCE_KEY must match the origin
-- string pushed in gatherGroundedSources ("FOIA / EIR legislation").
MERGE INTO DATA_SOURCE_REGISTRY t
USING (SELECT 'FOIA / EIR legislation' AS SOURCE_KEY) s ON t.SOURCE_KEY = s.SOURCE_KEY
WHEN NOT MATCHED THEN INSERT (SOURCE_KEY, DISPLAY_NAME, SOURCE_TABLE, OWNING_SERVICE, VERIFIED, SOURCE_KIND, DESCRIPTION)
VALUES ('FOIA / EIR legislation', 'FOIA / EIR legislation', 'FOI_LEGISLATION', 'Legal & Governance', TRUE, 'LEGISLATION',
        'Freedom of Information Act 2000, EIR 2004 and ICO Code of Practice sections used to ground legal basis and exemption reasoning.');
