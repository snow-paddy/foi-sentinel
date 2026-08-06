# Redaction Studio — Persona Audit (2026-07-05)

**Scope:** `/redaction` Redaction Studio (UC5). **Method:** agentic-browser (Playwright absent) against live harness `localhost:3100`, connection PG-SNOWFLAKE. **Data:** synthetic training doc "Housing Benefit — Case-file note" (claimant Mr James Whitfield = requester; third parties Mrs Sarah Quinn, Mr Daniel Okoro, Thomas Lee, Mr R Shah). Personas reused from `personas.md`.

## What was exercised
Navigated to `/redaction` → clicked **Run AI redaction** → `AI_EXTRACT` returned in ~3s → captured findings list, summary chips, released-document text, and visual rendering. Confirmed the released doc **keeps** the requester (Mr James Whitfield, 07700 900113) and blacks out third-party values.

## Result summary (observed)
- **11 third-party items redacted**, **3 of James Whitfield's own details kept**.
- Findings: Mrs Sarah Quinn (NAME 64%), Mr Daniel Okoro (NAME 64%), Thomas Lee (NAME 64%), Mr R Shah (NAME 64%), 0117 900 1234 (PHONE 87%), 0117 900 4412 (PHONE 87%), thomas.lee@exampleton.gov.uk (EMAIL 40%), benefits@exampleton.gov.uk (EMAIL 40%).
- Released doc header now reads **"EMAIL REDACTED"** where `benefits@exampleton.gov.uk` sat.

## Per-story grades

### UC5-S1 (End-user) — "Detect third-party PII and keep my requester's own data"
**PASS.** Requester's name + contact retained; neighbour/other-party names, phones, an address, and emails detected and blacked out. Confidence scores shown per item, colour-coded (green ≥60%, amber ≥45%, red <45%). SQL (`PARSE` + `AI_EXTRACT`) is inspectable via the toggle. This is the core promise and it holds.

### UC5-S2 (Economic buyer / compliance) — "Redactions are correct and defensible under DPA 2018 s.40"
**FAIL (P1) — over-redaction of non-personal / official data.**
`benefits@exampleton.gov.uk` is the council's **team mailbox** — it is not third-party *personal* data at all, yet it is counted in the "11 redacted" and blacked out. `thomas.lee@exampleton.gov.uk` is a **council officer acting in an official capacity**, which ICO guidance generally does *not* treat as automatically withheld. Redacting the council's own contact route can itself be a disclosure error (withholding info the requester is entitled to) and misrepresents what s.40 requires.
- **Mitigant present:** the AI scored both at 40% (red / low confidence) — the model *is* signalling doubt. Good.
- **Gap:** low-confidence items are still auto-included in the redaction count and applied, with no gate. The buyer's "auditability + data honesty" bar is not met while false positives are silently redacted.

### UC5-S3 (End-user / HITL) — "I review the AI before releasing"
**FAIL (P1) — no per-finding human-in-the-loop.**
The officer cannot accept/reject individual detections, cannot override the 40% false positives, and there is no explicit "confirm & release" step (or audit log of who released what). For a statutory disclosure, auto-accepting model output — including low-confidence org-mailbox false positives — is not a defensible HITL workflow. This is the same HITL theme as the FOI batch-send P1.

### UC5-S4 (Champion) — "Live redaction as the wow moment for leadership"
**PASS with caveat (P2).** The 11-redacted / 3-kept split, the confidence chips, and the visible SQL make a strong "moment that matters." Caveat: the two 40% council-email flags muddy the "precise, selective" narrative — a sceptical viewer may spot that the council's own mailbox got redacted. For the demo, either exclude org mailboxes from the headline count or present low-confidence items as **"flagged for officer review"** rather than **"redacted."**

## Visual / Theme
**PASS.** Light canvas, GOV.UK-style blue primary, readable contrast throughout. Blackout `[… REDACTED]` tags render as solid dark chips (intentional). Confidence chips colour-code correctly (green/amber/red). Two-column layout (source PDF | AI panel) is clean; PDF `<object>` renders with an `<iframe>` fallback + "open in new tab" link. Synthetic-data warning banners present on both source and released panes. No dark-mode/contrast defect observed.

## Gate decision
**CONDITIONAL PASS — ship for demo, do not represent as production-defensible.**
- The feature is a compelling, functionally-correct **demo** of selective AI redaction (UC5-S1, S4 pass) and is visually sound.
- Two P1 findings block a "production / statutorily-defensible" claim: **over-redaction of official/org data (S2)** and **no per-finding HITL review + release log (S3)**. Both are about *governance of the AI output*, not the AI itself.

## Recommended fixes (priority order)
1. **P1 — Per-finding review controls:** each detection gets keep/redact toggles; officer must explicitly "Confirm & release." Persist who/when (audit trail).
2. **P1 — Exclude organisational identifiers:** don't treat team mailboxes / official council contact routes as third-party personal data. Filter `@exampleton.gov.uk` org mailboxes (and optionally officer-in-official-capacity) out of the redaction set, or route them to "review" not "redact."
3. **P2 — Demo framing:** low-confidence (<45%) findings shown as "flagged for review," excluded from the headline "redacted" count until confirmed.

---

## Re-audit (2026-07-05, post-fix) — GATE: PASS

Fixes implemented (plan `redaction-hitl-learning-and-demo`) and verified live via agentic browser on `localhost:3100`.

### UC5-S2 (compliance) — over-redaction — NOW PASS
`runRedactionDemo()` now skips role/team mailboxes (`SAR_ORG_MAILBOXES`) and the `AI_EXTRACT` email prompt excludes generic mailboxes. Verified: `benefits@exampleton.gov.uk` no longer appears in the findings and is **visible** in the released document header. Org mailbox is no longer treated as third-party personal data.

### UC5-S3 (HITL) — NOW PASS
The Studio has per-finding keep/redact checkboxes; the released document + counts recompute live from the officer's choices; a "Confirm & release" action persists the decision set. Verified: unticking two items moved the count 10 → 9 → 8 live; release wrote 10 rows (8 REDACT / 2 KEEP) to `SAR_REDACTION_DECISION`.

### New — learning flywheel — PASS
On re-run the tool pre-applies the most-recent decision per value: "Learned from 10 prior decisions" chip shown; `thomas.lee@` came back **unticked** with a "kept last time" marker; all others "redacted last time". Case-detail panel (`sar-redaction-panel.tsx`) shares the same `SAR_REDACTION_DECISION` table (SOURCE='case') and shows the same provenance (code-complete, tsc clean; recommend a case-panel browser pass during the demo dry-run).

### UC5-S4 (champion) — PASS
"AI suggests, the officer decides" framing + the visible learning chip make a stronger, more defensible wow moment than the pre-fix auto-redact.

### Visual / Theme — PASS
Summary chips (danger/ok/muted/brand) and provenance chips render cleanly in the light GOV.UK theme with good contrast; blackout tags intact.

### Known minor limitation (P3, not blocking)
Learning matches on the detected **value** (not value+category) so cross-surface learning works (Studio ↔ case). When the identical literal string is detected under two categories (e.g. a phone number mis-classified by `AI_EXTRACT` as an EMAIL — observed: `0117 900 1234` as both PHONE and EMAIL), the value-level decision applies to both. Harmless here (the phone should be redacted either way); note for future refinement if category-specific learning is ever needed.

### Gate
**PASS** — the two P1 findings are resolved; the feature is now demo-ready and materially more defensible (human-verified, auditable via `SAR_REDACTION_DECISION`, and self-improving).
