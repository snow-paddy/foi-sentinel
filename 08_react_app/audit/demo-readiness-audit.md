# FOI Sentinel v2 — Demo-Readiness Audit

**WI-11 · 2026-07-05 · agentic-browser (Playwright absent) · dev server localhost:3100 · connection PG-SNOWFLAKE**

Scope (operator-confirmed): the demo path + `/learning`. Every page a viewer touches in the ~15-min
silent-with-captions walkthrough, plus the learning-loop showcase.

Method: route-200 sweep, then per-page render + functional check + visual/theme pass via agentic browser.
Console error check per page. No third-party code injected; all DOM reads/clicks are same-origin.

---

## Verdict

**Demo path is functionally ready.** All 8 surfaces serve 200, render cleanly in light theme with
consistent Snowflake-blue accents, and no console errors were observed. Six findings (2 × P1, 2 × P2,
2 × P3); none block the demo from running, but the two P1s are visible on the two opening surfaces
(Command Centre + Cases) and are fixed in this plan's later steps.

| Page | Verdict | Findings |
|------|---------|----------|
| `/` Command Centre | PASS (visual) | **P1** funnel under-count |
| `/cases` Focus | PASS | **P1** batch-send has no per-draft confirm gate (→ step 4) |
| `/cases/FOI-2026-0088` | PASS | none — rich (triage, complexity 7.5, tone, precedent 43%, timeline) |
| `/cases/SAR-2026-0107` | PASS | none — redaction panel + A4 flywheel wired; detect runs, spans render |
| `/intake` | PASS | **P2** shared-mailbox noise would be triaged |
| `/guidance` Knowledge Base | PASS | **P3** header count phrasing |
| `/redaction` | PASS | (re-verified earlier this session — flywheel live, gate PASS) |
| `/sar` | PASS | **P2** doc titles not prettified (→ step 6) |
| `/learning` | PASS | **P3** modest answer-quality metrics (→ step 5 improves) |

---

## Findings

### P1 — Command Centre funnel under-counts by one
`/` headline reads **36 open**, but the "Where requests are in the process" funnel bands sum to **35**:
Receipt 3 + Triage 15 + Retrieval 7 + Review 4 + Sign-off 4 + Challenge 2 = 35.
Root cause is the known 3-valued-logic bug: `getPipeline()` computes ON_TRACK with
`SUM(IFF(NOT(RAG='RED' OR WD_REMAINING<0),1,0))`. For a case with **NULL** `WD_REMAINING`
(e.g. a PIT/paused case with no live deadline), `WD_REMAINING<0` is UNKNOWN, the `NOT(...)` is
UNKNOWN, and `IFF` yields 0 — the case is dropped from its phase count while still counting in the
headline `getHeadline()`. Same class of bug flagged in the prior audit (was 32 vs 33).
**Fix (step 3):** count phase membership independently of RAG/deadline, or treat NULL `WD_REMAINING`
as not-overdue explicitly (`COALESCE(WD_REMAINING,999) < 0`). The funnel total must equal the open headline.

### P1 — Cases batch-send has no explicit per-draft confirm gate
`/cases` Focus → "Quick wins, ready to send" shows a single **"Send 4 responses"** button. The copy
promises *"review, untick any you want to handle yourself… Nothing leaves until you confirm here"*,
but the button dispatches all ticked drafts in one click with no per-draft review/confirm step. Under
the hood `batchDispatch()` auto-promotes DRAFT→FINAL then dispatches (writes DISPATCHED_AT, closes the
case, `SP_ADVANCE_STAGE` → FOI_CASE_EVENT) with no human confirmation of each outgoing text.
This is the HITL gap this plan's **step 4** exists to close (per-draft review + explicit confirm +
audit-log the human sign-off). Consistent with prior research. **Owner: step 4.**

### P2 — /intake shared mailbox contains non-FOI noise
Live Outlook/Graph read resolved correctly (**3 unread**, "Run the pipeline" enabled — the live
round-trip works). But one unread item is a **Microsoft Security noreply**
(`MSSecurity-noreply@microsoft.com`, "New recommendation available for FOI Sentinel"). Running the
pipeline on the raw inbox would triage a security notification as an FOI request — off-message on
camera. **Mitigation options:** (a) filter noreply/microsoft senders in the intake reader;
(b) operator clears/curates the demo inbox immediately before recording; (c) use **In-App Test** mode
(verified working — compose form with AI-generate, no live mail consumed) for the scripted request.
Recommend (b)+(c) for the demo; (a) is the durable fix. Not fixing the reader in this plan unless
operator wants it — flagged for decision.

### P2 — /sar document titles not prettified
Doc list shows **"Ig Sar Received"** and **"Socialcare Support Plan"**. Should read
**"IG SAR Received"** and **"Social Care Support Plan"**. The rest of `/sar` is excellent (the
"Subject Access Request — across the estate" narrative, the James Whitfield SharePoint note, the
3-part structured-masking → AI-redaction → disclosure-bundle story, doc corpus). **Owner: step 6**
(acronym uppercasing IG/SAR/DPO/FOI + "social care" word split in the title INITCAP expression).

### P3 — /guidance header count phrasing
Header: *"11,611 records in total — 11,571 from external / peer-authority sources and 40 from this
council's own published log."* The 40 is actually **records (35) + published log (5)** combined; the
"published log" card alone is 5. Reword to "…40 from this council's own records and published log"
(or "own sources"). Math itself is correct (35+5+54+1+11,420+38+16+42 = 11,611). Cosmetic.

### P3 — /learning answer-quality metrics are modest
Suggested-answer quality (LLM-judge over 35 answers): Groundedness **57%**, Coverage **65%**,
11 pass / 22 weak / 2 fail. Honest real data, and a legitimate talking point for the tuning loop —
but low-ish for a customer demo. **Directly improved by step 5** (seeding the council's own 21 sent
replies + `OWN_REPLY_SEARCH` grounds answers in real prior disclosures, lifting groundedness).
No fix needed here; noted as corroboration for the flywheel work.

---

## What passed cleanly (positives to lean on in the demo)
- Command Centre hero: 36 open / 15 at risk / 4 overdue / 30 FOI · 5 EIR · 1 SAR / 86% gauge vs 90% target / 21 closed. Reads instantly.
- FOI-2026-0088 case detail is the strongest single screen: Red / s.14 flagged / "14 working days overdue", full AI-triage panel (Priority HIGH, Complexity **7.5/10** with factor chips, Negative tone **-0.60** with rationale, IG team, 15h effort), precedent match **43%** with plain-English rationale, timeline.
- SAR-2026-0107: s.40 third-party HITL narrative + live AI_REDACT detect (spans render, release gate present), model provenance ("mistral-large2, 69% confidence, advisory — a human officer confirms").
- Knowledge Base: 8 grounded corpora, 11,611 records incl. Camden 11,420 / GLA 38 / Brentwood 16 / WDTK precedent 54 — sells the cross-authority precedent story.
- /learning: fine-tune comparison base **63% → tuned 100%** (n=16) is a crisp value proof.
- Theme consistent, no console errors on any page, live Outlook + live redaction both real (not simulated).

## Deferred / decisions for operator
- P2 mailbox noise: confirm mitigation (curate inbox + use In-App Test) vs building a sender filter.
- P3 items are cosmetic; fold P3 guidance-copy into step 3 if cheap, else leave.
