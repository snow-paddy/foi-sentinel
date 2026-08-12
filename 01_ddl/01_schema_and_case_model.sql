-- =====================================================================
-- FOI Sentinel v2 — Phase 1: Schema, case model, config, bank holidays
-- Council-agnostic FOI case-management core. Built in FOI.FOI_SENTINEL_V2.
-- UK English throughout. Legal refs: FOIA 2000, EIR 2004, DPA 2018,
-- Fees Regs 2004 (SI 2004/3244), s.45 Code of Practice.
-- =====================================================================

USE WAREHOUSE FOI_WH;
USE DATABASE FOI;
CREATE SCHEMA IF NOT EXISTS FOI_SENTINEL_V2;
USE SCHEMA FOI_SENTINEL_V2;

-- ---------------------------------------------------------------------
-- Council configuration (makes the app council-agnostic)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE COUNCIL_CONFIG (
    CONFIG_KEY    VARCHAR PRIMARY KEY,
    CONFIG_VALUE  VARCHAR,
    DESCRIPTION   VARCHAR
);

INSERT INTO COUNCIL_CONFIG (CONFIG_KEY, CONFIG_VALUE, DESCRIPTION) VALUES
    ('COUNCIL_NAME',        'Exampleton Council',   'Display name of the authority'),
    ('AUTHORITY_TYPE',      'LOCAL_AUTHORITY',      'LOCAL_AUTHORITY (£450/18h) or CENTRAL_GOV (£600/24h)'),
    ('COST_LIMIT_GBP',      '450',                  'Appropriate limit in GBP (Fees Regs 2004 reg.3)'),
    ('COST_LIMIT_HOURS',    '18',                   'Hours equivalent at £25/hr'),
    ('COST_RATE_PER_HOUR',  '25',                   'Statutory flat rate £25/person/hour (reg.4)'),
    ('STANDARD_DEADLINE_WD','20',                   'Standard statutory deadline in working days'),
    ('EXTENDED_DEADLINE_WD','40',                   'Max extended deadline (PIT / EIR complex)'),
    ('SLA_TARGET_PCT',      '90',                   'Target % answered within 20 working days');

-- ---------------------------------------------------------------------
-- UK bank holidays (England & Wales) — for working-day deadline maths
-- Source: gov.uk/bank-holidays. Refresh annually (note in README).
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE UK_BANK_HOLIDAYS (
    HOLIDAY_DATE  DATE PRIMARY KEY,
    HOLIDAY_NAME  VARCHAR
);

INSERT INTO UK_BANK_HOLIDAYS (HOLIDAY_DATE, HOLIDAY_NAME) VALUES
    ('2025-01-01','New Year''s Day'),
    ('2025-04-18','Good Friday'),
    ('2025-04-21','Easter Monday'),
    ('2025-05-05','Early May bank holiday'),
    ('2025-05-26','Spring bank holiday'),
    ('2025-08-25','Summer bank holiday'),
    ('2025-12-25','Christmas Day'),
    ('2025-12-26','Boxing Day'),
    ('2026-01-01','New Year''s Day'),
    ('2026-04-03','Good Friday'),
    ('2026-04-06','Easter Monday'),
    ('2026-05-04','Early May bank holiday'),
    ('2026-05-25','Spring bank holiday'),
    ('2026-08-31','Summer bank holiday'),
    ('2026-12-25','Christmas Day'),
    ('2026-12-28','Boxing Day (substitute)'),
    ('2027-01-01','New Year''s Day'),
    ('2027-03-26','Good Friday'),
    ('2027-03-29','Easter Monday'),
    ('2027-05-03','Early May bank holiday'),
    ('2027-05-31','Spring bank holiday'),
    ('2027-08-30','Summer bank holiday'),
    ('2027-12-27','Christmas Day (substitute)'),
    ('2027-12-28','Boxing Day (substitute)');

-- ---------------------------------------------------------------------
-- Lifecycle stage reference (the 17-stage model)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE LIFECYCLE_STAGE (
    STAGE_CODE        VARCHAR PRIMARY KEY,
    STAGE_ORDER       NUMBER,
    STAGE_NAME        VARCHAR,
    LEGAL_BASIS       VARCHAR,
    AI_ASSISTED       BOOLEAN,
    HUMAN_GATED       BOOLEAN,
    DESCRIPTION       VARCHAR
);

INSERT INTO LIFECYCLE_STAGE
    (STAGE_CODE, STAGE_ORDER, STAGE_NAME, LEGAL_BASIS, AI_ASSISTED, HUMAN_GATED, DESCRIPTION) VALUES
    ('RECEIPT',        1,  'Receipt & logging',        's.8, s.45 CoP',        TRUE,  FALSE, 'Request received and registered'),
    ('VALIDITY',       2,  'Validity check',           's.8',                  TRUE,  TRUE,  'Valid request: in writing, name, address, description'),
    ('CLASSIFY',       3,  'Regime classification',    'FOIA / EIR / UK GDPR', TRUE,  TRUE,  'FOI, EIR, SAR or business-as-usual'),
    ('SAR_REDIRECT',   4,  'SAR redirect',             's.40(1), DPA 2018',    TRUE,  TRUE,  'Own personal data routed to DPA / 1 month'),
    ('DUPLICATE',      5,  'Duplicate / s.21 reuse',   's.21',                 TRUE,  TRUE,  'Already answered — reuse prior disclosure'),
    ('CLARIFICATION',  6,  'Clarification',            's.1(3), EIR reg.9',    TRUE,  TRUE,  'Clarification requested — stops the clock'),
    ('ALLOCATION',     7,  'Allocation',               's.45 CoP',             TRUE,  TRUE,  'Routed to owning department / officer'),
    ('SEARCH',         8,  'Search & retrieval',       's.1(1)(b)',            TRUE,  TRUE,  'Locate and retrieve held information'),
    ('COST',           9,  'Cost assessment',          's.12, Fees Regs 2004', TRUE,  TRUE,  'Four prescribed activities at £25/hr'),
    ('EXEMPTIONS',     10, 'Exemption identification', 'Part II FOIA / reg.12',TRUE,  TRUE,  'Identify and apply exemptions/exceptions'),
    ('PIT',            11, 'Public interest test',     's.2(2)(b)',            TRUE,  TRUE,  'Qualified exemptions — human decision'),
    ('REDACTION',      12, 'Redaction',                's.40 / s.43',          TRUE,  TRUE,  'AI suggests, human verifies every redaction'),
    ('DRAFTING',       13, 'Response drafting',        's.1, s.17',            TRUE,  TRUE,  'Disclosure / refusal / partial response'),
    ('QA',             14, 'QA / sign-off',            's.45 CoP',             TRUE,  TRUE,  'Senior officer sign-off'),
    ('DISPATCH',       15, 'Dispatch',                 's.10',                 TRUE,  FALSE, 'Response sent within 20 working days'),
    ('PUBLISH',        16, 'Disclosure log publish',   's.19, s.45 CoP',       TRUE,  TRUE,  'Publish non-exempt response'),
    ('REVIEW',         17, 'Internal review / ICO',    's.45 CoP / reg.11 / s.50', TRUE, TRUE, 'Fresh reviewer; ICO complaint route');

-- ---------------------------------------------------------------------
-- FOI_CASE — the master case spine
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_CASE (
    CASE_ID               VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    REFERENCE             VARCHAR UNIQUE,                 -- e.g. FOI-2026-00042
    SOURCE                VARCHAR,                        -- EMAIL / WHATDOTHEYKNOW / WEB_PORTAL / LETTER / PHONE
    REQUESTER_NAME        VARCHAR,
    REQUESTER_EMAIL       VARCHAR,
    REQUESTER_ORGANISATION VARCHAR,
    REQUEST_TEXT          VARCHAR,
    RECEIVED_DATE         DATE,
    REGIME                VARCHAR DEFAULT 'FOI',          -- FOI / EIR / SAR / BAU
    CURRENT_STAGE         VARCHAR DEFAULT 'RECEIPT',      -- FK LIFECYCLE_STAGE.STAGE_CODE
    STATUS                VARCHAR DEFAULT 'OPEN',         -- OPEN / CLOSED / REFUSED / WITHDRAWN / TRANSFERRED
    OWNING_DEPARTMENT     VARCHAR,
    ASSIGNED_OFFICER      VARCHAR,
    -- Clock / deadline management
    STATUTORY_DEADLINE    DATE,
    CLOCK_STATE           VARCHAR DEFAULT 'RUNNING',      -- RUNNING / STOPPED_CLARIFICATION / STOPPED_FEES / PIT_EXTENSION / EIR_COMPLEX
    CLOCK_STOPPED_AT      DATE,
    WORKING_DAYS_USED     NUMBER,
    -- Outcome
    OUTCOME               VARCHAR,                        -- GRANTED_FULL / GRANTED_PARTIAL / GRANTED_PARTIAL_S21 / REFUSED / NOT_HELD / S21_REUSE / SAR_REDIRECTED
    CLOSED_DATE           DATE,
    ANSWERED_IN_TIME      BOOLEAN,
    IS_PUBLISHED          BOOLEAN DEFAULT FALSE,
    -- Scoring (carried from v1)
    SENTIMENT_SCORE       FLOAT,
    COMPLEXITY_RANK       FLOAT,
    URGENCY_SCORE         FLOAT,
    IS_VEXATIOUS          BOOLEAN DEFAULT FALSE,
    CREATED_AT            TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT            TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------
-- FOI_CASE_EVENT — append-only audit / state-transition log
-- (ICO defensibility: who did what, AI vs human, when)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_CASE_EVENT (
    EVENT_ID      VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID       VARCHAR,
    FROM_STAGE    VARCHAR,
    TO_STAGE      VARCHAR,
    ACTOR_TYPE    VARCHAR,                                -- AI / HUMAN / SYSTEM
    ACTOR         VARCHAR,
    EVENT_TYPE    VARCHAR,                                -- STAGE_ADVANCE / CLOCK_STOP / CLOCK_RESUME / DECISION / NOTE
    NOTE          VARCHAR,
    EVENT_TS      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------
-- FOI_CASE_TASK — per-stage work items (e.g. search task per dept)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_CASE_TASK (
    TASK_ID       VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID       VARCHAR,
    STAGE_CODE    VARCHAR,
    TITLE         VARCHAR,
    ASSIGNED_TO   VARCHAR,
    TASK_STATUS   VARCHAR DEFAULT 'OPEN',                 -- OPEN / DONE / BLOCKED
    DUE_DATE      DATE,
    CREATED_AT    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------
-- FOI_TRIAGE — AI triage output per case (replaces v1 PRECOMPUTED_TRIAGE)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_TRIAGE (
    CASE_ID                  VARCHAR PRIMARY KEY,
    TRIAGE_JSON              VARIANT,                      -- full classification
    POLICY_RESULTS           VARIANT,
    COUNCIL_POLICY_RESULTS   VARIANT,
    DISCLOSURE_RESULTS       VARIANT,
    CAMDEN_RESULTS           VARIANT,
    S21_MATCH_REF            VARCHAR,                       -- matched prior disclosure (duplicate)
    S21_SIMILARITY_PCT       NUMBER(5,2),                   -- AI_SIMILARITY score 0-100 of that match; NULL when below threshold
    COMPLEXITY_RANK          FLOAT,
    URGENCY_SCORE            FLOAT,
    COMPUTED_AT              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------
-- FOI_COST_ESTIMATE — four prescribed activities (Fees Regs 2004 reg.4)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_COST_ESTIMATE (
    ESTIMATE_ID      VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID          VARCHAR,
    HOURS_DETERMINE  FLOAT DEFAULT 0,   -- determining whether info is held
    HOURS_LOCATE     FLOAT DEFAULT 0,   -- locating the information
    HOURS_RETRIEVE   FLOAT DEFAULT 0,   -- retrieving the information
    HOURS_EXTRACT    FLOAT DEFAULT 0,   -- extracting the information
    RATE_PER_HOUR    FLOAT DEFAULT 25,
    LIMIT_GBP        FLOAT,             -- 450 or 600 from config (NULL for EIR)
    TOTAL_HOURS      FLOAT,
    TOTAL_GBP        FLOAT,
    EXCEEDS_LIMIT    BOOLEAN,
    NOTE             VARCHAR,
    CREATED_AT       TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------
-- FOI_EXEMPTION_ASSESSMENT — per-exemption decision + PIT
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_EXEMPTION_ASSESSMENT (
    ASSESSMENT_ID    VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID          VARCHAR,
    SECTION_REF      VARCHAR,           -- e.g. s.40(2), s.43
    EXEMPTION_TYPE   VARCHAR,           -- ABSOLUTE / QUALIFIED
    PIT_REQUIRED     BOOLEAN,
    PIT_FOR          VARCHAR,           -- public interest in disclosure
    PIT_AGAINST      VARCHAR,           -- public interest in maintaining exemption
    DECISION         VARCHAR,           -- APPLY / DO_NOT_APPLY / PENDING
    DECIDED_BY       VARCHAR,
    DECIDED_AT       TIMESTAMP_NTZ,
    CREATED_AT       TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------
-- FOI_REDACTION — AI-suggested, human-verified redactions
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_REDACTION (
    REDACTION_ID     VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID          VARCHAR,
    EXCERPT          VARCHAR,
    BASIS_SECTION    VARCHAR,           -- e.g. s.40 personal data
    SUGGESTED_BY_AI  BOOLEAN DEFAULT TRUE,
    VERIFIED_BY      VARCHAR,
    VERIFIED         BOOLEAN DEFAULT FALSE,
    CREATED_AT       TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------
-- FOI_RESPONSE — drafted / final response (s.17(7) compliance fields)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_RESPONSE (
    RESPONSE_ID                   VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID                       VARCHAR,
    RESPONSE_TYPE                 VARCHAR,   -- DISCLOSURE / REFUSAL / PARTIAL / S21_REUSE / MIXED_S21
    DRAFT_TEXT                    VARCHAR,
    FINAL_TEXT                    VARCHAR,
    S17_EXEMPTION_STATED          BOOLEAN DEFAULT FALSE,
    S17_INTERNAL_REVIEW_INCLUDED  BOOLEAN DEFAULT FALSE,
    S17_ICO_ROUTE_INCLUDED        BOOLEAN DEFAULT FALSE,
    SIGNED_OFF_BY                 VARCHAR,
    DISPATCHED_AT                 TIMESTAMP_NTZ,
    CREATED_AT                    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------
-- FOI_INTERNAL_REVIEW — fresh reviewer (must differ from original)
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_INTERNAL_REVIEW (
    REVIEW_ID            VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID              VARCHAR,
    REQUESTED_DATE       DATE,
    ORIGINAL_DECISION_BY VARCHAR,
    REVIEWER             VARCHAR,
    REVIEW_DEADLINE      DATE,              -- 20 WD (max 40)
    OUTCOME              VARCHAR,           -- UPHELD / OVERTURNED / PARTIALLY_UPHELD / PENDING
    OUTCOME_NOTE         VARCHAR,
    COMPLETED_DATE       DATE,
    CREATED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------
-- FOI_ICO_COMPLAINT — s.50 complaint tracking
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_ICO_COMPLAINT (
    COMPLAINT_ID        VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID             VARCHAR,
    ICO_REFERENCE       VARCHAR,
    RECEIVED_DATE       DATE,
    STATUS              VARCHAR,           -- OPEN / DECISION_NOTICE / UPHELD / NOT_UPHELD / APPEALED
    DECISION_NOTICE_URL VARCHAR,
    NOTE                VARCHAR,
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------
-- FOI_DISCLOSURE_PUBLICATION — s.19 publication-scheme record
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE FOI_DISCLOSURE_PUBLICATION (
    PUBLICATION_ID    VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID           VARCHAR,
    REFERENCE_NUMBER  VARCHAR,
    PUBLICATION_DATE  DATE,
    TOPIC             VARCHAR,
    SUMMARY           VARCHAR,
    PUBLISHED_BY      VARCHAR,
    CREATED_AT        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

SELECT 'Phase 1 DDL complete' AS STATUS;
