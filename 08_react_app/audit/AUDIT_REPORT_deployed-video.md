# Deployed-App Persona Audit — Video Pages & Buttons (PII / over-redaction lens)

**Date:** 2026-07-06
**Target:** the DEPLOYED SPCS app (VERSION$2, RUNNING) at `a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app` — audited post-deploy via the authenticated agentic browser (operator signed in through Snowflake SSO; Playwright can't automate the OAuth gate).
**Scope:** every page shown and button clicked in `audit/demo-assets/demo-script.md`, through the end-user / buyer / champion lens, focused on personal-data leaks and over/under-redaction.

## Gate decision: PASS — no PII leaks, no over-redaction found.

| Video section | Page/button | Result | Evidence |
|---|---|---|---|
| 1 Command Centre | `/` word cloud, requester patterns | PASS | Word cloud correct counts (max 9, not x100), council themes, **no name/email leaks**. Requesters **pseudonymised** ("Citizen DD4A"; orgs named). No emails on page. |
| 2 Cases (list) | `/cases?view=list` | PASS | Requester column absent; "Requester identities are not shown" note present; no emails. |
| 2 Cases (detail) | `/cases/[ref]` triage, precedent, A6 | PASS | Triage panel; **A6 "AI evidence & audit trail" with "Chain verified" + hashes only** (no raw prompt/response); grounded answer. Only email shown = requester's OWN (legitimate officer view). No third-party NI leaks. |
| 3 Intake | `/intake` Outlook Test, Run pipeline | PASS | Outlook Test tab, waiting inbox, run control, connection explainer render. (End-to-end pipeline verified live earlier: FOI-2026-D07060953030, grounded 1.0/1.0 PASS.) |
| 4 Knowledge Base | `/guidance` corpus + search | PASS | Corpus cards (legislation, WhatDoTheyKnow, Camden) render; no leaks. |
| 5 SAR (static) | `/sar` federated + structured + bundle | PASS | 6 third-party review flags; **9 masked third-party PII cells, zero raw NI/phone exposed**; disclosure bundle present; studio embedded; subject shown. |
| 5 Redaction (interactive) | `/sar` Run AI redaction -> Confirm & release | PASS | Third parties detected + redacted (Quinn/Okoro/Lee/Shah + phones/addresses, 7 blackouts). **Subject's own data KEPT** (James Whitfield, 07700 900113, HB-2026-55821) — no over-redaction. `thomas.lee@` defaults KEEP (the untick moment). Confirm & release -> "decisions saved", no error, Re-run available. |
| 5 redirect | `/redaction` | PASS | Redirects to `/sar` (studio consolidated). |

## Minor notes (non-blocking; operator's call before recording)
1. **Requester's own contact on camera.** The case-detail "request" text for FOI-2026-D07060953030 shows the requester's real email/phone (`paddy.gardner@snowflake.com`, mobile) from the email signature. This is the subject's OWN data (not a third-party leak), shown legitimately to the officer — but consider a fictional requester signature, or blur in post, if you don't want a real work email on screen.
2. **Duplicate finding.** The AI_EXTRACT run returned `0117 900 1234` twice in the findings list (both redacted). Cosmetic; run-to-run variation.
3. **Colleague handling asymmetry.** Default redacts the name "Thomas Lee" but keeps `thomas.lee@` (the official contact the demo unticks). Narrative-driven and officer-adjustable; consider whether you want name+email treated consistently.
4. **Learning-state reset.** This audit clicked Confirm & release, writing a `SAR_REDACTION_DECISION` batch. For a clean "first run" in the recording, run the demo-script reset: `DELETE FROM FOI.FOI_SENTINEL_V2.SAR_REDACTION_DECISION WHERE SOURCE='studio';` (or leave it to open on the "Learned from N" moment).

## Demo-script drift to fix (`audit/demo-assets/demo-script.md`)
- Section 5 says "`/sar` -> `/redaction`"; redaction is now **embedded in `/sar`** and `/redaction` redirects. Update the script so the presenter stays on `/sar`.
- The script header says "record locally; do not record a deployed SPCS URL" — this audit confirms the deployed build behaves identically, so deployed recording is viable (subject to SSO login before capture).

## Deploy delta observed
- Redaction returned **10 findings (9 redact)** on the deployed run vs 9 (8 redact) locally — AI_EXTRACT is non-deterministic run-to-run. Behaviour correct either way; just don't hard-caption an exact count.
