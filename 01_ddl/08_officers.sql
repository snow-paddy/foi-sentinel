-- =====================================================================
-- FOI Sentinel v2 — Officers & case assignment (G-stack personas)
-- Dummy officers mapped to the end-user personas in docs/PERSONAS.md so
-- cases can be assigned and a "My cases" view demonstrates the workflow.
-- =====================================================================
USE WAREHOUSE FOI_WH; USE SCHEMA FOI.FOI_SENTINEL_V2;

CREATE OR REPLACE TABLE FOI_OFFICER (
    OFFICER_ID   VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    NAME         VARCHAR,
    PERSONA      VARCHAR,          -- maps to docs/PERSONAS.md end-user roles
    DEPARTMENT   VARCHAR,
    INITIALS     VARCHAR,
    IS_ACTIVE    BOOLEAN DEFAULT TRUE
);

INSERT INTO FOI_OFFICER (NAME, PERSONA, DEPARTMENT, INITIALS) VALUES
 ('Paddy Gardner', 'FOI / Information Governance Officer', 'Information Governance', 'PG'),
 ('Sarah',         'Data Protection / SAR Officer',        'Information Governance', 'SA'),
 ('Spencer',       'Service contact (SPOC)',               'Adult Social Care',      'SP'),
 ('Roger',         'Senior / Independent Reviewer',        'Information Governance', 'RO'),
 ('Izzy',          'Information Governance Manager',        'Information Governance', 'IZ');

-- Assign existing open cases to a sensible officer (deterministic, demo-friendly).
UPDATE FOI_CASE SET ASSIGNED_OFFICER = CASE
    WHEN REGIME = 'SAR'                                              THEN 'Sarah'
    WHEN CURRENT_STAGE = 'REVIEW'                                   THEN 'Roger'
    WHEN OWNING_DEPARTMENT ILIKE '%social care%'
      OR OWNING_DEPARTMENT ILIKE '%adult%'
      OR OWNING_DEPARTMENT ILIKE '%children%'
      OR OWNING_DEPARTMENT ILIKE '%planning%'
      OR OWNING_DEPARTMENT ILIKE '%environment%'
      OR OWNING_DEPARTMENT ILIKE '%financ%'
      OR OWNING_DEPARTMENT ILIKE '%revenue%'                        THEN 'Spencer'
    ELSE 'Paddy Gardner' END
WHERE STATUS = 'OPEN';
