-- =====================================================================
-- FOI Sentinel v2 — Subject Access Request (SAR) AI redaction
-- Internal records released to a SAR requester must have THIRD-PARTY
-- personal data removed (s.40 FOIA / DPA 2018). AI_REDACT (GA) detects
-- PII; a human verifies each span (keep the requester's own data, redact
-- third parties) before the released bundle is produced. Mirrors the
-- "AI suggests, human verifies the highest-risk step" pattern.
-- =====================================================================
USE WAREHOUSE FOI_WH; USE SCHEMA FOI.FOI_SENTINEL_V2;

-- Internal source documents attached to a SAR case (synthesised; contain
-- third-party PII alongside the requester's own data).
CREATE OR REPLACE TABLE SAR_SOURCE_DOC (
    DOC_ID       VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID      VARCHAR,
    DOC_TITLE    VARCHAR,
    DOC_TEXT     VARCHAR,
    CREATED_AT   TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Released (redacted) bundle + HITL audit of how many spans were redacted.
CREATE OR REPLACE TABLE SAR_REDACTION (
    REDACTION_ID   VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    CASE_ID        VARCHAR,
    DOC_ID         VARCHAR,
    RELEASED_TEXT  VARCHAR,
    SPANS_TOTAL    NUMBER,
    SPANS_REDACTED NUMBER,
    RELEASED_BY    VARCHAR,
    RELEASED_AT    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Seed two internal docs for the live SAR case (SAR-2026-0107).
INSERT INTO SAR_SOURCE_DOC (CASE_ID, DOC_TITLE, DOC_TEXT)
SELECT CASE_ID, 'Housing Benefit case-file note',
  'Case note (Housing Benefit team). The claimant attended on 14 March 2026 to dispute an alleged overpayment of £1,240. '
  || 'A report had been received from a neighbour, Mrs Sarah Quinn of 12 Elm Close, BS5 9PJ (telephone 0117 900 4412), alleging an undeclared occupant. '
  || 'The claimant stated that the other adult at the property, Mr Daniel Okoro, had moved out in January. '
  || 'The review was carried out by benefits officer Thomas Lee (thomas.lee@exampleton.gov.uk, direct line 0117 900 1234). '
  || 'A further statement was taken from the landlord, Mr R Shah of Meadow Lettings. The claimant''s own contact number on file is 07700 900113.'
FROM FOI_CASE WHERE REGIME='SAR'
UNION ALL
SELECT CASE_ID, 'Internal email thread — benefit review',
  'From: Thomas Lee <thomas.lee@exampleton.gov.uk>  To: Aisha Khan <aisha.khan@exampleton.gov.uk>. '
  || 'Aisha — re the Housing Benefit review: the neighbour Sarah Quinn called again on 0117 900 4412 chasing this. '
  || 'I have asked the fraud team (lead investigator David Brennan, david.brennan@exampleton.gov.uk) to confirm whether Mr Okoro''s council-tax record shows him at the address. '
  || 'Please do not share the informant''s identity with the claimant. The claimant''s reference is HB-2026-55821.'
FROM FOI_CASE WHERE REGIME='SAR';