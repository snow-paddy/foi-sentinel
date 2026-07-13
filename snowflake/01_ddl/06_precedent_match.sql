-- =====================================================================
-- FOI Sentinel v2 — Precedent "clean-match" model
-- Surfaces, for each open request, the closest PAST request that was
-- answered and drew NO complaint or internal review (a "clean" outcome),
-- with a real similarity % via AI_SIMILARITY. Powers the board "★ NN%
-- match" badge and the case-detail "closest past clean response" panel.
--
-- Clean corpus = (a) this council's own past clean responses, (b) the GLA
-- published disclosure log, (c) WhatDoTheyKnow requests with a successful
-- or partially-successful outcome. The council's own response log is thin,
-- so a curated set of past clean responses is SYNTHESISED (clearly flagged
-- IS_SYNTHETIC) — approved for the demo.
-- =====================================================================
USE WAREHOUSE FOI_WH; USE SCHEMA FOI.FOI_SENTINEL_V2;

-- --- (a) Synthesised past clean responses for this authority -----------
CREATE OR REPLACE TABLE FOI_SYNTH_PRECEDENT (
    PRECEDENT_ID   VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    REF            VARCHAR,
    TITLE          VARCHAR,
    THEME          VARCHAR,
    REGIME         VARCHAR,
    REQUEST_TEXT   VARCHAR,
    RESPONSE_TEXT  VARCHAR,
    CLEAN_OUTCOME  VARCHAR,
    IS_SYNTHETIC   BOOLEAN DEFAULT TRUE
);

INSERT INTO FOI_SYNTH_PRECEDENT (REF, TITLE, THEME, REGIME, REQUEST_TEXT, RESPONSE_TEXT, CLEAN_OUTCOME) VALUES
 ('FOI-2024-0488','External PR and communications consultancy spend 2023/24','finance','FOI',
  'Please confirm how much the council spent on external PR and communications consultants in 2023/24.',
  'The council spent £148,250 on external public relations and communications consultancy in 2023/24, across three suppliers engaged for campaign and crisis-communications support. A breakdown by supplier and purpose is attached. No information was withheld.',
  'Granted in full — no complaint or review'),
 ('FOI-2024-0461','SEND home-to-school transport overspend risk register 2023/24','social care','FOI',
  'Please provide the internal risk register and legal advice relating to the SEND home-to-school transport overspend for 2023/24.',
  'The SEND transport risk register for 2023/24 is enclosed. Legal advice is withheld under section 42 (legal professional privilege); the public-interest test favoured maintaining the exemption, with reasons given. The financial risk lines and mitigation actions are disclosed in full.',
  'Granted in part — no complaint or review'),
 ('FOI-2024-0502','Senior officers paid over £100,000 — 2023/24','workforce','FOI',
  'List all senior officers earning over £100,000 together with their job titles.',
  'A list of the 11 posts remunerated above £100,000 in 2023/24, with job titles and salary bands, is attached. This information is also published in the council''s annual statement of accounts under the Accounts and Audit Regulations 2015.',
  'Granted in full — no complaint or review'),
 ('FOI-2024-0455','Agency social worker spend 2021-2024','social care','FOI',
  'Please provide the total spend on agency social workers for each of the last three financial years, broken down by team.',
  'Agency social worker spend for 2021/22, 2022/23 and 2023/24 is set out in the attached table, broken down by children''s and adults'' teams. Figures are taken from the council''s finance ledger. No information was withheld.',
  'Granted in full — no complaint or review'),
 ('FOI-2024-0470','Corporate purchase-card transactions 2018-2024','finance','FOI',
  'Provide every individual corporate purchase-card transaction across all departments for the last six years with descriptions.',
  'Purchase-card transactions for the requested period are provided in the attached dataset, with merchant, date, amount and description. A small number of fields were redacted under section 40(2) where they would identify individuals. Advice on narrowing very large requests was offered under section 16.',
  'Granted in part — no complaint or review'),
 ('FOI-2024-0499','Parking enforcement (PCN) revenue by car park 2023/24','transport','FOI',
  'What were the total parking-enforcement (PCN) revenues by car park for 2023/24?',
  'Penalty Charge Notice revenue by car park and on-street zone for 2023/24 is attached. Net income after enforcement costs is also provided in line with the council''s annual parking report. No information was withheld.',
  'Granted in full — no complaint or review'),
 ('FOI-2024-0444','Council-tax arrears by ward 2023/24','finance','FOI',
  'Provide council-tax arrears by ward for 2023/24.',
  'Council-tax arrears by ward as at 31 March 2024 are attached. Figures are rounded to the nearest £1,000 and exclude amounts subject to active recovery arrangements, as explained in the covering note. No information was withheld.',
  'Granted in full — no complaint or review'),
 ('FOI-2024-0433','Temporary accommodation spend 2023/24','housing','FOI',
  'Provide the council''s spend on temporary accommodation for the last financial year.',
  'Gross and net spend on temporary accommodation for 2023/24, with the number of households accommodated and average unit costs, is provided in the attached summary. No information was withheld.',
  'Granted in full — no complaint or review'),
 ('FOI-2024-0418','School admission appeals heard and upheld 2023','education','FOI',
  'How many school admission appeals were heard and how many were upheld last year?',
  'In the 2023 admissions round, 312 appeals were heard and 121 were upheld, broken down by primary and secondary phase in the attached table. The figures are reported to the Department for Education annually. No information was withheld.',
  'Granted in full — no complaint or review'),
 ('FOI-2024-0407','Fly-tipping fixed penalty notices and fines 2023','environment','FOI',
  'How many fly-tipping fixed penalty notices were issued and what fines were collected in 2023?',
  'In 2023 the council issued 286 fixed penalty notices for fly-tipping and collected £41,900 in fines; 19 cases proceeded to prosecution. A monthly breakdown is attached. No information was withheld.',
  'Granted in full — no complaint or review');

-- --- Unified clean-precedent corpus -----------------------------------
CREATE OR REPLACE VIEW V_PRECEDENT_CLEAN AS
SELECT 'This council' AS SOURCE, REF, TITLE, NULL::VARCHAR AS URL,
       REQUEST_TEXT, RESPONSE_TEXT, THEME, CLEAN_OUTCOME, TRUE AS IS_SYNTHETIC
FROM FOI_SYNTH_PRECEDENT
UNION ALL
SELECT 'GLA', REFERENCE_NUMBER, TITLE, SOURCE_URL,
       REQUEST_SUMMARY, RESPONSE_TEXT, THEME, 'Published (GLA disclosure log)', FALSE
FROM GLA_DISCLOSURE_LOG
WHERE RESPONSE_TEXT IS NOT NULL
UNION ALL
SELECT 'WhatDoTheyKnow', AUTHORITY_NAME, REQUEST_TITLE, REQUEST_URL,
       REQUEST_TITLE, SNIPPET, THEME, OUTCOME, FALSE
FROM WDTK_EVENT
WHERE OUTCOME IN ('Successful','Partially successful');

-- --- Per-open-case best clean match -----------------------------------
CREATE OR REPLACE TABLE FOI_PRECEDENT_MATCH (
    CASE_ID         VARCHAR,
    REFERENCE       VARCHAR,
    SOURCE          VARCHAR,
    REF             VARCHAR,
    TITLE           VARCHAR,
    URL             VARCHAR,
    SIMILARITY_PCT  NUMBER,
    CLEAN_OUTCOME   VARCHAR,
    IS_SYNTHETIC    BOOLEAN,
    REQUEST_TEXT    VARCHAR,
    RESPONSE_TEXT   VARCHAR,
    MATCHED_AT      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    REVIEWED_BY     VARCHAR,
    REVIEWED_AT     TIMESTAMP_NTZ,
    USED            BOOLEAN DEFAULT FALSE
);

-- Refresh: for each OPEN case keep the single closest clean precedent
-- (AI_SIMILARITY on request text), above a 40% floor. Cheap board reads
-- afterwards; call on demand and after intake. Preserves any HITL review
-- state (REVIEWED_BY / USED) across refreshes by re-merging.
CREATE OR REPLACE PROCEDURE SP_REFRESH_PRECEDENT_MATCH()
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
  CREATE OR REPLACE TEMPORARY TABLE _PREC_NEW AS
  WITH oc AS (
    SELECT CASE_ID, REFERENCE, REQUEST_TEXT
    FROM FOI_CASE WHERE STATUS='OPEN' AND REQUEST_TEXT IS NOT NULL
  ),
  scored AS (
    SELECT oc.CASE_ID, oc.REFERENCE, p.SOURCE, p.REF, p.TITLE, p.URL,
           p.CLEAN_OUTCOME, p.IS_SYNTHETIC, p.REQUEST_TEXT AS P_REQ, p.RESPONSE_TEXT,
           AI_SIMILARITY(oc.REQUEST_TEXT, p.REQUEST_TEXT) AS SIM
    FROM oc CROSS JOIN V_PRECEDENT_CLEAN p
  )
  SELECT CASE_ID, REFERENCE, SOURCE, REF, TITLE, URL,
         ROUND(100*SIM) AS SIMILARITY_PCT, CLEAN_OUTCOME, IS_SYNTHETIC,
         P_REQ AS REQUEST_TEXT, RESPONSE_TEXT
  FROM scored
  QUALIFY ROW_NUMBER() OVER (PARTITION BY CASE_ID ORDER BY SIM DESC, REF ASC) = 1
     AND ROUND(100*SIM) >= 40;

  -- Carry forward HITL review state, then replace.
  CREATE OR REPLACE TEMPORARY TABLE _PREC_HITL AS
  SELECT CASE_ID, SOURCE, REF, REVIEWED_BY, REVIEWED_AT, USED FROM FOI_PRECEDENT_MATCH;

  TRUNCATE TABLE FOI_PRECEDENT_MATCH;
  INSERT INTO FOI_PRECEDENT_MATCH
    (CASE_ID, REFERENCE, SOURCE, REF, TITLE, URL, SIMILARITY_PCT, CLEAN_OUTCOME,
     IS_SYNTHETIC, REQUEST_TEXT, RESPONSE_TEXT, REVIEWED_BY, REVIEWED_AT, USED)
  SELECT n.CASE_ID, n.REFERENCE, n.SOURCE, n.REF, n.TITLE, n.URL, n.SIMILARITY_PCT,
         n.CLEAN_OUTCOME, n.IS_SYNTHETIC, n.REQUEST_TEXT, n.RESPONSE_TEXT,
         h.REVIEWED_BY, h.REVIEWED_AT, COALESCE(h.USED, FALSE)
  FROM _PREC_NEW n
  LEFT JOIN _PREC_HITL h ON h.CASE_ID = n.CASE_ID AND h.REF = n.REF AND h.SOURCE = n.SOURCE;

  RETURN 'Refreshed precedent matches for ' || (SELECT COUNT(*) FROM FOI_PRECEDENT_MATCH) || ' open cases.';
END;
$$;
