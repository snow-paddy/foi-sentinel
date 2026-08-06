-- =====================================================================
-- FOI Sentinel v2 - schema reconciliation
--
-- WHY THIS FILE EXISTS
-- Several objects the application depends on were created by hand in
-- Snowflake during development and never captured in 01_ddl. A clean
-- rebuild from this directory therefore produced a schema the app could
-- not run against: queries referencing FOI_TRIAGE.REASONING_JSON,
-- FOI_AI_USAGE, FOI_SUGGESTED_ANSWER and others failed with
-- "invalid identifier". This file closes that gap so the repository is
-- the source of truth and a rebuild is reproducible.
--
-- SAFETY: this script is idempotent and NON-DESTRUCTIVE. Tables use
-- CREATE TABLE IF NOT EXISTS (never OR REPLACE) so existing rows survive
-- a re-run; only views are replaced, because they hold no data.
-- Definitions were extracted with GET_DDL from the live account rather
-- than reconstructed by hand.
-- =====================================================================
USE WAREHOUSE FOI_WH; USE SCHEMA FOI.FOI_SENTINEL_V2;

-- ---------------------------------------------------------------------
-- 1. Columns added to existing tables after 01_ddl was written
-- ---------------------------------------------------------------------
-- Triage provenance: which model ran, how confident it was, and whether the
-- case was auto-handled or routed to a human. REASONING_JSON carries the
-- narrative detail (complexity factors, sentiment rationale) shown in the UI.
ALTER TABLE FOI_TRIAGE ADD COLUMN IF NOT EXISTS REASONING_JSON VARIANT;
ALTER TABLE FOI_TRIAGE ADD COLUMN IF NOT EXISTS MODEL           VARCHAR;
ALTER TABLE FOI_TRIAGE ADD COLUMN IF NOT EXISTS CONFIDENCE      FLOAT;
ALTER TABLE FOI_TRIAGE ADD COLUMN IF NOT EXISTS ROUTED          VARCHAR; -- AUTO / REVIEW

-- SUBJECT is the short human title shown on cards; IS_SYNTHETIC marks seeded
-- demo rows so they can be excluded from live views and reporting.
ALTER TABLE FOI_CASE ADD COLUMN IF NOT EXISTS SUBJECT      VARCHAR;
ALTER TABLE FOI_CASE ADD COLUMN IF NOT EXISTS IS_SYNTHETIC BOOLEAN;

-- Provenance trail for grounded letters: which sources the figures came from.
ALTER TABLE FOI_RESPONSE ADD COLUMN IF NOT EXISTS SOURCES VARIANT;

-- ---------------------------------------------------------------------
-- 2. AI metering, cost and audit
-- ---------------------------------------------------------------------
-- Call-time metering of Cortex usage: real token counts and latency, costed
-- via AI_MODEL_RATE_CARD. Tokens and latency are MEASURED; the GBP conversion
-- is an estimate from list rates.
CREATE TABLE IF NOT EXISTS FOI_AI_USAGE (
    USAGE_ID      VARCHAR DEFAULT UUID_STRING(),
    TS            TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    STAGE         VARCHAR,
    CASE_REF      VARCHAR,
    MODEL         VARCHAR,
    INPUT_TOKENS  NUMBER(38,0),
    OUTPUT_TOKENS NUMBER(38,0),
    LATENCY_MS    NUMBER(38,0),
    EST_CREDITS   FLOAT,
    EST_GBP       FLOAT
) COMMENT = 'Call-time metering of Cortex usage: real token counts + latency, costed via AI_MODEL_RATE_CARD.';

CREATE TABLE IF NOT EXISTS AI_MODEL_RATE_CARD (
    MODEL                 VARCHAR NOT NULL PRIMARY KEY,
    CREDITS_PER_1M_TOKENS FLOAT,
    NOTE                  VARCHAR
) COMMENT = 'ESTIMATED Cortex token credit rates per 1M tokens. Confirm against the Snowflake Consumption Table for your edition/region before quoting to a client.';

CREATE TABLE IF NOT EXISTS AI_COST_CONFIG (
    CONFIG_KEY VARCHAR NOT NULL PRIMARY KEY,
    VALUE_NUM  FLOAT,
    NOTE       VARCHAR
) COMMENT = 'Editable cost config. CREDIT_PRICE_GBP = your Snowflake credit price in GBP (estimate; set from your contract).';

-- Append-only, hash-chained audit trail of every AI decision. Stores HASHES of
-- prompt/response, never raw text, so it is defensible without retaining PII --
-- which also means it is not usable as training data.
CREATE TABLE IF NOT EXISTS FOI_AI_DECISION (
    SEQ              NUMBER(38,0) AUTOINCREMENT START 1 INCREMENT 1,
    DECISION_ID      VARCHAR DEFAULT UUID_STRING(),
    CASE_REF         VARCHAR,
    DECISION_TYPE    VARCHAR,
    MODEL            VARCHAR,
    SF_VERSION       VARCHAR,
    PROMPT_HASH      VARCHAR,
    RESPONSE_HASH    VARCHAR,
    INPUT_TOKENS     NUMBER(38,0),
    OUTPUT_TOKENS    NUMBER(38,0),
    EST_GBP          NUMBER(12,6),
    CONFIDENCE       FLOAT,
    DECISION_SUMMARY VARCHAR,
    DECIDED_AT       TIMESTAMP_NTZ,
    PREV_HASH        VARCHAR,
    ROW_HASH         VARCHAR
) COMMENT = 'Append-only hash-chained audit of AI decisions. Hashes only (never raw PII); tamper-evidence via the ROW_HASH chain.';

CREATE OR REPLACE VIEW FOI_AI_COST_ROLLING AS
SELECT
  COUNT(*)                                                     AS TOTAL_CALLS,
  COUNT(DISTINCT CASE_REF)                                     AS DISTINCT_REQUESTS,
  SUM(INPUT_TOKENS + OUTPUT_TOKENS)                            AS TOTAL_TOKENS,
  ROUND(SUM(EST_CREDITS), 4)                                   AS TOTAL_CREDITS,
  ROUND(SUM(EST_GBP), 4)                                       AS TOTAL_GBP,
  ROUND(SUM(EST_GBP) / NULLIF(COUNT(DISTINCT CASE_REF), 0), 4)  AS GBP_PER_REQUEST,
  ROUND(AVG(LATENCY_MS))                                       AS AVG_LATENCY_MS,
  MAX(TS)                                                      AS LAST_CALL_TS
FROM FOI_AI_USAGE;

-- ---------------------------------------------------------------------
-- 3. Officer feedback on AI drafts
-- ---------------------------------------------------------------------
-- How much an officer changed the AI draft before sign-off. Low EDIT_RATIO
-- means the draft was accepted near-verbatim; high means it was rewritten.
-- CAVEAT for anyone mining this: batch dispatch copies the draft into the final
-- text when nobody edited it, which produces EDIT_RATIO = 0 rows that represent
-- NO human review rather than enthusiastic acceptance. Exclude those before
-- treating this as a quality signal.
CREATE TABLE IF NOT EXISTS AI_DRAFT_FEEDBACK (
    FEEDBACK_ID   VARCHAR DEFAULT UUID_STRING(),
    TS            TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    RESPONSE_ID   VARCHAR,
    CASE_REF      VARCHAR,
    DRAFT_CHARS   NUMBER(38,0),
    FINAL_CHARS   NUMBER(38,0),
    EDIT_DISTANCE NUMBER(38,0),
    EDIT_RATIO    FLOAT
) COMMENT = 'Officer edit distance between the AI draft and the sent response. Feeds prompt/model tuning.';

-- ---------------------------------------------------------------------
-- 4. Pre-computed suggested answers + LLM-as-judge evaluation
-- ---------------------------------------------------------------------
-- Precomputed so opening a case costs nothing in AI: the officer sees a case
-- that is already triaged, matched, drafted and scored.
CREATE TABLE IF NOT EXISTS FOI_SUGGESTED_ANSWER (
    CASE_ID      VARCHAR,
    REFERENCE    VARCHAR NOT NULL,
    ANSWER_TEXT  VARCHAR,
    SOURCES      VARIANT,
    GROUNDED     BOOLEAN,
    MODEL        VARCHAR,
    GENERATED_AT TIMESTAMP_NTZ,
    GROUNDEDNESS NUMBER(3,2),
    COVERAGE     NUMBER(3,2),
    EVAL_VERDICT VARCHAR,
    EVAL_NOTES   VARCHAR,
    EVAL_AT      TIMESTAMP_NTZ,
    CONSTRAINT PK_FOI_SUGGESTED_ANSWER PRIMARY KEY (REFERENCE)
) COMMENT = 'Precomputed grounded answer per case plus LLM-as-judge groundedness/coverage scores.';

-- ---------------------------------------------------------------------
-- 5. Triage fine-tuning assets
-- ---------------------------------------------------------------------
-- Training/eval sets and the job handle for the mistral-7b -> TRIAGE_TUNED
-- fine-tune. NOTE: the tuned model is not currently used for inference;
-- production triage runs base mistral-large2 (see 04_procedures).
CREATE TABLE IF NOT EXISTS FT_TRIAGE_TRAIN (
    PROMPT     VARCHAR,
    COMPLETION VARCHAR
);

CREATE TABLE IF NOT EXISTS FT_TRIAGE_EVAL (
    CASE_ID    VARCHAR,
    PROMPT     VARCHAR,
    COMPLETION VARCHAR
);

CREATE TABLE IF NOT EXISTS FT_TRIAGE_JOB (
    JOB_ID     VARCHAR,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Held-out predictions from base vs tuned model, used by the comparison view.
CREATE TABLE IF NOT EXISTS EVAL_TRIAGE (
    CASE_ID    VARCHAR,
    GOLD       VARCHAR,
    BASE_PRED  VARCHAR,
    TUNED_PRED VARCHAR
);

CREATE OR REPLACE VIEW V_TRIAGE_MODEL_COMPARE AS
SELECT 'base (mistral-7b)' AS MODEL,
       ROUND(AVG(IFF(BASE_PRED = GOLD, 1, 0)), 3) AS ACCURACY,
       COUNT(*) AS EVAL_N
FROM EVAL_TRIAGE
UNION ALL
SELECT 'fine-tuned (TRIAGE_TUNED)',
       ROUND(AVG(IFF(TUNED_PRED = GOLD, 1, 0)), 3),
       COUNT(*)
FROM EVAL_TRIAGE;

-- ---------------------------------------------------------------------
-- 6. Reference data required for the app to function
-- ---------------------------------------------------------------------
-- Without these rows the measured-cost panels return nulls, so they are seeded
-- here rather than left to manual setup. Inserted only when absent so a re-run
-- never overwrites locally tuned rates.
INSERT INTO AI_MODEL_RATE_CARD (MODEL, CREDITS_PER_1M_TOKENS, NOTE)
SELECT x.MODEL, x.RATE, x.NOTE FROM (
  SELECT 'mistral-7b'        AS MODEL, 0.12 AS RATE, 'estimate - confirm vs Consumption Table' AS NOTE
  UNION ALL SELECT 'mixtral-8x7b',      0.22, 'estimate'
  UNION ALL SELECT 'llama3.1-8b',       0.19, 'estimate'
  UNION ALL SELECT 'llama3.1-70b',      1.21, 'estimate'
  UNION ALL SELECT 'mistral-large2',    1.95, 'estimate - default drafting model'
  UNION ALL SELECT 'claude-haiku-4-5',  1.00, 'estimate - EU cross-region'
  UNION ALL SELECT 'claude-sonnet-4-6', 2.55, 'estimate - EU cross-region'
  UNION ALL SELECT 'SENTIMENT',         0.08, 'estimate - managed function proxy rate'
  UNION ALL SELECT 'AI_EXTRACT',        0.60, 'estimate - arctic-extract proxy rate'
  UNION ALL SELECT '_DEFAULT',          1.95, 'fallback when model not in rate card'
) x
WHERE NOT EXISTS (SELECT 1 FROM AI_MODEL_RATE_CARD r WHERE r.MODEL = x.MODEL);

INSERT INTO AI_COST_CONFIG (CONFIG_KEY, VALUE_NUM, NOTE)
SELECT 'CREDIT_PRICE_GBP', 2.30,
       'ESTIMATE - set to your contracted GBP price per Snowflake credit'
WHERE NOT EXISTS (SELECT 1 FROM AI_COST_CONFIG c WHERE c.CONFIG_KEY = 'CREDIT_PRICE_GBP');
