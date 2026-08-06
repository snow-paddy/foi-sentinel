# FOI Sentinel v2 — Audit User Stories (end-user primary)

Each story: Given/When/Then + the **UI signal** the audit asserts. `[KEY]` = gate-blocking key use case.

## End-user — FOI/SAR Officer
- **US-EU-01 [KEY] Workload at a glance (UC1, `/`)** — Given the officer opens the Command Centre, When it loads, Then headline KPIs (open / at-risk / overdue / closed, compliance %) render with numbers. **Signal:** KPI tiles with numeric values + an at-risk/overdue indicator.
- **US-EU-02 [KEY] Cases list & deadlines (UC1, `/cases`)** — When the officer opens Cases, Then a list of requests shows reference, status/stage and a due/deadline signal. **Signal:** table rows with references + deadline/RAG indicator.
- **US-EU-03 [KEY] Open a case (UC3, `/cases/[ref]`)** — When the officer opens a case, Then case detail shows the request, stage, and an AI answer / actions area. **Signal:** case header + suggested-answer or stage controls.
- **US-EU-04 [KEY] Intake & triage (UC2, `/intake`)** — When the officer views Intake, Then they can see inbound items and run triage/pipeline. **Signal:** inbound list + a "run pipeline / triage" control.
- **US-EU-04b [KEY] Live Outlook inbound (UC2, `/intake` Outlook Test)** — Given a real FOI email in the shared mailbox, When the officer runs the pipeline, Then it lands as a FOI case (clock running, +20 WD, IS_SYNTHETIC=FALSE) with a grounded answer citing the council's own figures, and the requester's signature (name/email/phone) is NOT surfaced in the Command-Centre word cloud. **Signal:** new case ref + grounded/eval PASS; word-cloud payload contains request themes but no requester name/email. Verified live 2026-07-06 (FOI-2026-D07060953030: FOI, groundedness 1.0/coverage 1.0 PASS, HR; word cloud clean). Note: the animated pipeline consumes the email (marks read), so the automated audit asserts /intake renders + peek works rather than firing a live send.
- **US-EU-05 Knowledge/precedent (UC6, `/guidance`)** — When the officer opens Knowledge Base, Then guidance + an evidence-base/corpus panel render. **Signal:** evidence-base grid with corpus counts.
- **US-EU-06 [KEY] SAR redaction (UC5, `/sar` §3, studio embedded)** — Given a council doc with PII, When the officer runs AI redaction in the SAR flow, Then third parties are redacted and the requester's own data is kept, each with a confidence score, and the officer can Confirm & release. **Signal:** findings list w/ confidence chips + released doc (roomy, 640px panel) with `[… REDACTED]` blackouts + "decisions saved" chip on release.
- **US-EU-07 [KEY] Command-Centre themes are honest & explorable (UC1, `/`)** — Given the officer views the word cloud, When it renders, Then terms reflect FOI/SAR themes with **true mention counts** (no requester personal names/signatures skewing it), and each term is clickable to see the matching cases. **Signal:** word-cloud terms with single/low-digit counts, no personal names, cursor-pointer; clicking navigates to `/cases?view=list&keyword=<term>` with a "Showing cases mentioning …" banner + filtered list (all statuses).

## End-user — SAR (queue → identity → workspace model, 2026-07-07 reimagining)
- **US-SAR-01 [KEY] SAR queue is an officer's inbox, not one person (UC5, `/sar`)** — Given the officer opens SAR, When the queue loads, Then it shows multiple requests as an inbox with reference, pseudonymised requester, request summary, received date, one-calendar-month due date and a stage, and the page intro does NOT name any data subject. **Signal:** ≥2 queue rows; no personal name of a data subject anywhere on the queue page; generic intro copy (no "James"). Verified 2026-07-07 (3 rows; intro generic).
- **US-SAR-02 [KEY] Named subject appears only after identity verification (UC5, `/sar?case=SAR-2026-0107`)** — Given a verified request, When the officer opens it, Then the header resolves the pseudonym to the verified data subject with an "Identity verified" badge, shows "received as <pseudonym>", the running one-month clock, and the federated cross-source records. **Signal:** "Identity verified" badge + "received as Anonymous Resident" + verified subject name (James Whitfield) + 5-source records table. Verified 2026-07-07.
- **US-SAR-03 [KEY] Unverified request leaks no subject and spends no Cortex (UC5, `/sar?case=<unverified>`)** — Given a request whose identity is not yet verified, When the officer opens it, Then the workspace withholds the subject and findings (an "awaiting identity verification" state), naming no individual and running no Cortex search. **Signal:** awaiting-ID notice; no subject name; no findings/records table rendered.

## Economic buyer
- **US-EB-01 [KEY] Compliance reporting (UC7, `/reporting`)** — When the buyer opens Reporting, Then compliance % vs SLA target + monthly/outcome breakdowns render. **Signal:** compliance stat vs target + charts.
- **US-EB-04 [KEY] AI evidence & audit trail (A6, `/cases/[ref]`)** — Given the buyer opens a case with AI decisions, When they view it, Then a per-decision audit trail shows model + Snowflake version, tokens, cost, confidence and prompt/response hashes, with a tamper-evidence "Chain verified" indicator. **Signal:** "AI evidence & audit trail" panel + "Chain verified" badge + decisions with model/hashes. Verified 2026-07-06 (FOI-2026-D07060953030: suggested_answer + eval, chain intact).
- **US-EB-02 Cost-effectiveness (UC8, `/reporting`)** — Then a manual-vs-assisted cost card renders with £ saved. **Signal:** cost card with £ figures + % reduction.
- **US-EB-03 Evidence base / data honesty (UC9, `/guidance`)** — Then sources are attributed and synthetic data is labelled. **Signal:** corpus provenance + synthetic labelling / data-delta callout.
- **US-EB-05 [KEY] Price of a response (Section 7, `/cases/[ref]`)** — Given a case with metered Cortex calls, When the buyer/officer opens it, Then an "AI cost of this response" card shows the metered £ (4dp), calls · tokens · avg latency, and an "About Nx cheaper than the £X manual estimate above" contrast, sourced from FOI_AI_USAGE via the editable rate card. **Signal:** green £ figure + calls/tokens/latency line + "Nx cheaper" line + InspectPopover with per-stage SQL. Demo cases: FOI-2026-0115 (£0.0873) and FOI-2026-D07060953030 (£0.0652). Card is hidden when a case has no metered calls (advisory: verify a no-cost case doesn't render an empty card).

## Champion
- **US-CH-01 Narrative flow** — Intake → case answer → benchmark → redaction all reachable from nav without dead ends. **Signal:** nav links resolve to working pages.
- **US-CH-03 SAR is one flow (no dead/duplicate page)** — Given the SAR story, When the officer follows it, Then the redaction studio is part of `/sar` (not a separate page) and the old `/redaction` route redirects to `/sar`. **Signal:** `/redaction` → `/sar`; no `/redaction` nav entry.
- **US-CH-02 [KEY] No broken/dark surfaces (visual gate)** — Every page renders in the base theme with no dark-on-light widgets, clipped text, or contrast failures. **Signal:** Phase 4b probe passes per page.

## Secondary/ops pages (advisory): `/review`, `/published`, `/escalations`, `/board`, `/sector-trends`, `/learning`, `/studio`, `/admin`, `/about`
- **US-ADV-01** — each loads without error and renders its primary content. **Signal:** HTTP 200 + a heading + Phase 4b visual pass.

## Demo-narrative walk (video dry-run — script sections → page → story)
The audit walks these in narrative order to catch on-camera stragglers.

| § | Script beat | Page | Stories asserted |
|---|---|---|---|
| 1 | Command Centre / word cloud | `/` | US-EU-01, US-EU-07 |
| 2 | Intake + live triage (Outlook) | `/intake` | US-EU-04, US-EU-04b |
| 3 | Case AI pipeline (triage, precedent, complexity) | `/cases/FOI-2026-0115` | US-EU-03 |
| 4 | Knowledge / corpus + search | `/guidance` | US-EU-05, US-EB-03 |
| 5 | Exemptions s.40, Studio draft, s.17, HITL | `/cases/FOI-2026-0115` | US-EU-03, US-EB-04 |
| 6 | SAR redaction + SharePoint | `/sar` | US-EU-06, US-CH-03 |
| 7 | Price of a response (optional) | `/cases/FOI-2026-0115` + `/cases/FOI-2026-D07060953030` | US-EB-05 |
| — | Buyer reporting + outro | `/reporting` | US-EB-01, US-EB-02 |
