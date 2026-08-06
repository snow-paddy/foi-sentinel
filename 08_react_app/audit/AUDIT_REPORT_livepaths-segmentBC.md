# Audit Report — Live paths (video Segments B/C) verification

**Date:** 2026-07-06 · **Harness:** http://localhost:3000 · **Spec:** `audit/playwright/livepaths.audit.mjs` · **Connection:** PG-SNOWFLAKE

Verifies the flows you drive live on camera before recording, since these were flagged as under-exercised.

## Result: GATE PASS (6/6)

| Story | Flow | Result | Detail |
|---|---|---|---|
| US-EU-04b | `/intake` render | PASS | Outlook Test tab + "Waiting to be triaged" + "Run the pipeline" control (render only; live fire happens on camera in Segment B) |
| US-EU-06a | `/sar` studio embedded | PASS | Findings + embedded Redaction Studio present |
| US-EU-06b | Run AI redaction | PASS | Findings render + released doc shows `[… REDACTED]` blackouts |
| US-EU-06d | Untick to keep | PASS | Council officer email `thomas.lee@exampleton.gov.uk` kept (unticked) |
| US-EU-06c | Confirm & release | PASS | "decisions saved" chip |
| US-EU-06e | Re-run learning | PASS | "Learned from N prior decisions" + "kept last time" chips |

Learning state reset to clean first-run afterwards (`DELETE … WHERE SOURCE='studio'`) so the live demo opens with no prior decisions.

## Key finding — redaction latency (NOT a bug), and the fix

The `/api/redaction/demo/run` endpoint appeared to "hang". Root cause: the query does the heavy PDF work **twice** — `AI_PARSE_DOCUMENT` for the display text AND `AI_EXTRACT(file => …)` which parses the PDF again internally.

Measured (`sar_casefile.pdf`, 98KB, COMPUTE_WH):
| Run | Time |
|---|---|
| Cold (first ever) | **290.6s** |
| Warm display-parse | 58.2s (the `AI_EXTRACT` internal parse dominates) |
| Result-cache hit (identical query) | **5.8s** |

- Extraction is **correct** with `file =>`: third-party names (Quinn, Okoro, Shah), officer email `thomas.lee@`, two phones, and full addresses incl. postcode "12 Elm Close, BS5 9PJ".
- **Rejected optimisation:** switching to `AI_EXTRACT(text => parsedText)` returns in ~5s but **drops the third-party postcode** from the address field — an s.40 disclosure risk. Not adopted; correctness wins over speed.

### Operational mitigation for the live recording (no code change)
Snowflake result cache makes the identical query ~6s. **Before recording Segment C, pre-warm by hitting the app's exact query once:**
```
curl -s -m 360 -X POST http://localhost:3000/api/redaction/demo/run >/dev/null
```
Then the on-camera "Run AI redaction" returns in seconds. Cache persists 24h while the staged file and query are unchanged. (Note: the app interpolates the real requester name/phone into the extract prompt, so warming must go through the app endpoint, not a hand-written query.)

## Segment C pre-record checklist (SharePoint §6)
- SharePoint baseline confirmed: `FOI.SAR_INGEST` = 6 files / 12 chunks / 6 docs; the walkthrough note is **not** yet ingested, so the live upload will show 6→7.
- SAR Cortex Search service `FOI.SAR_INGEST.SAR_SHAREPOINT_SEARCH` responds.
- **Live-recording readiness (verify in Openflow before capture):** the SharePoint connector must be actively polling so the on-camera upload of `2026-04-02_ASC-2026-04021_file_note.docx` ingests within a poll interval. Nudge via the "Capture Sharepoint Changes" processor if needed. (Cannot be verified headlessly from SQL.)
