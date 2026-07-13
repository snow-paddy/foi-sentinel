-- =====================================================================
-- FOI Sentinel v2 — SAR redaction learning flywheel
-- Every officer keep/redact decision (from the Redaction Studio AND the
-- case-level SAR panel) is recorded here. On the next detection run the
-- most-recent decision for a given value is pre-applied, so the tool
-- learns from the human: values kept once (e.g. a council team mailbox)
-- are auto-excluded next time; values redacted once are pre-selected.
-- IF NOT EXISTS so learned decisions survive re-deploys.
-- =====================================================================
USE WAREHOUSE FOI_WH; USE SCHEMA FOI.FOI_SENTINEL_V2;

CREATE TABLE IF NOT EXISTS SAR_REDACTION_DECISION (
    DECISION_ID  VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    SOURCE       VARCHAR,          -- 'studio' | 'case'
    DOC_KEY      VARCHAR,          -- studio: file name; case: DOC_ID
    CATEGORY     VARCHAR,          -- NAME | PHONE | EMAIL | ADDRESS | AI_REDACT category
    VALUE_NORM   VARCHAR,          -- lowercased/trimmed detected value
    ACTION       VARCHAR,          -- 'REDACT' | 'KEEP'
    CONFIDENCE   FLOAT,
    DECIDED_BY   VARCHAR,
    DECIDED_AT   TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
