# FOI Sentinel — 3-Act Demo Script (live mailbox, one continuous automated pass)

**Target runtime:** ~10–12 min. **Capture:** one continuous Playwright pass on the **deployed** app across four pre-authenticated tabs (FOI Sentinel, Gmail, Outlook, SharePoint). **Logins happen once in a separate profile-priming phase (`pw_login.mjs`) and never appear in the recorded run.** Captions are written first and burned in; a clean voiceover is recorded to this same script and muxed last (so audio can never block the cut).

**Standing copy rules:** professional British English; no literal em dashes, no prose semicolons, no "not X but Y". Light theme.

**Reading the captions live:** each caption line below is prefixed with a **[DO: ...]** cue. Do the cue, then read the line, so the click and the words land together. The "On screen:" block at the top of each beat stays as the full pre-run choreography reference.

**Phased capture (you narrate each phase live over the script):**
- **Phase 1 = Act 1** — FOI Sentinel walkthrough: Command Centre, caseload, the quick-wins batch send, and the Knowledge Base (only the FOI SSO login involved). I drive.
- **Phase 2 = Act 2** — Gmail send, Outlook receive, intake, Response Studio.
- **Phase 3 = Act 3** — Redaction Studio (SAR) and SharePoint.
Each phase is its own clip (`raw/phase1.mkv` etc.), so a fluff in one phase never costs the others. Re-run any phase alone. If the live narration on a phase is clean we keep it; otherwise that phase falls back to a post-recorded voiceover.


**Pre-authenticated tabs:**
1. FOI Sentinel — `https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app`
2. Gmail (the requester) — `https://mail.google.com`
3. Outlook, shared FOI mailbox `foi@exampleton.onmicrosoft.com` — `https://outlook.office.com/mail/`
4. SharePoint, `FOISARDemo` Documents library

**Preflight (verified 2026-07-07):** Graph intake live, mailbox cleared (count 0); SharePoint Openflow corpus synced (6 docs); Part A fixes deployed (disclosure badges correct, audit chain verified, letters table-free).

> **DEPLOY GATE:** Beats 1–4 reflect work built on 2026-07-07 (KB v2, response-outcome variety) and 2026-07-08 (animated SLA gauge, the tabbed "Most frequent terms" card beside Requester patterns, the needs-review lane as a plain list, FOI-2026-0115 reframed as a partial, the Knowledge Base folding the old "Already published" tab into a single Guidance search with an inline s.21 highlight, a plain-English "why this outcome" decision summary shown above the draft on each case, "Use this precedent" now grounding a draft on the adopted precedent, and the s.12 cost-estimate card removed from the case view) that is **pending the SPCS deploy**. Record these beats only after that deploy lands, or they will not match the live app. Everything else already matches the deployed build.

---

## Plain-English glossary (woven into the narration where the screen shows it)
- **FOI** — Freedom of Information Act 2000. Anyone can request recorded information a public authority holds. 20 working days to respond (s.10).
- **EIR** — Environmental Information Regulations 2004. The parallel regime for environmental information (air, water, land, emissions). Presumption of disclosure, and no cost-limit refusal like FOIA has.
- **SAR** — Subject Access Request (UK GDPR Article 15 / DPA 2018). A person asking for their **own** personal data, not general information. Handled differently: identity is assumed in-demo, and other people's data is redacted before release.
- **s.21** — information already reasonably accessible, typically already published. We point the requester to it rather than answering twice.
- **Response outcomes** — the pipeline picks one of four: **disclosure** (release in full), **partial** (release some, withhold the rest under an exemption), **refusal** (withhold, or not held), or **s.21** (already published, signpost it). The officer can override.
- **s.40** — personal data. Section 40(2) protects third parties' personal data; it is the usual reason a release is partial or refused.
- **s.14(1) vexatious** — a request whose burden is out of all proportion to its value, judged on the ICO's factors. It is about the request, not the requester being awkward.
- **s.14(2) repeated / duplicate** — an identical or substantially similar request from the same person within a reasonable interval. We need not answer it again.
- **Duplicate vs s.21** — a duplicate is the same person asking again (s.14(2)); s.21 is "it is already public".

---

## Title card — 0:00–0:10
`FOI Sentinel` / `AI-assisted FOI, EIR and SAR handling on Snowflake`

## Architecture slide (post-production insert) — 0:10–0:45
**VO:** "Every council answers Freedom of Information, environmental and subject-access requests on a twenty-working-day clock. FOI Sentinel puts one governed pipeline behind that: Microsoft 365 in, Cortex AI inside Snowflake, defensible disclosure out. Nothing leaves the governed boundary."

---

# ACT 1 — The command centre and the caseload

## Beat 1 — Command Centre (`/`) — 0:45–2:00
**On screen:** land on `/`; let the scorecard render and the **SLA gauge sweep up** to the in-time figure on load; note the peer benchmark; scroll to the **"Where requests are in the process"** pipeline card and **expand the 2. Triage & allocation (s.16) stage** to reveal its breakdown (request categorisation FOI/EIR/SAR, SAR redirect, clarification, allocated to service) with the in-time and at-risk counts; then slow-scroll to "Intelligence, powered by Snowflake Cortex". The "Most frequent terms, ranked" card sits beside "Requester patterns"; toggle its **Ranked** and **Word cloud** tabs, then click a term to see the cases behind it.
**VO / captions (do the [DO] cue, then read the line):**
- **[DO: land on `/`; let the SLA gauge sweep up on load]** "Every FOI, EIR and SAR request in one live view, on the twenty-day statutory clock."
- **[DO: point to the SLA gauge and the peer-benchmark figure]** "An SLA gauge against the regulator's in-time target, and how we compare to peers on WhatDoTheyKnow."
- **[DO: scroll to 'Where requests are in the process'; expand '2. Triage & allocation']** "The same caseload is also shown by where it sits in the statutory process. Open a stage, such as triage and allocation under section sixteen, and it breaks down into categorisation, allocation and clarification, with anything near its deadline flagged as at risk."
- **[DO: slow-scroll to Intelligence; toggle Ranked and Word cloud; click a term]** "Cortex reads the inbox and surfaces what people are asking about. Click any theme to see the cases behind it."
- **[DO: point to the Requester patterns card]** "Repeat requesters and campaigns are surfaced automatically, including possible section 14. Requester identities stay pseudonymised."

## Beat 2 — Cases: Focus, List and Board (`/cases`) — 2:00–3:30
**On screen:** open `/cases` in **Focus view**; show the three lanes with live counts (**Quick wins**, **Needs review**, **Complex**) as the at-a-glance triage. Switch to **List view** and **click the FOI, then EIR, then SAR filter chips in turn** so the list narrows to each regime, then return to **All open** (regime filtering is done from the List view). Switch to **Board view**: the six-phase Kanban across the statutory FOIA process (Receipt, Triage, Retrieval, Review, Sign-off) with the live counts and the KEY legend, and the amber **Challenge (s.50)** column marked "Requester-led, not draggable"; each card shows its `Cx n` complexity inline beside the priority. **Hover a `Cx n` complexity chip, then a `★ n% match` precedent pill** to show the Cortex similarity. **Drag one card one column to the right** (for example a Retrieval-stage case into Review) and hold as it settles. Then switch back to **Focus**, click the **Needs review** tab and open `FOI-2026-0115` (a **partial**: staff grievances, where the yearly totals are released and the outcome breakdown is withheld under section 40(2)); show "How AI triaged this case" and the precedent card; in the Response Studio read the plain-English **"Why this is a partial disclosure"** panel above the letter; scroll to "AI evidence & audit trail" and **hover the Chain verified badge**. Then return to Cases and open the **Complex** tab as a **view only** (do **not** open a card), pointing to the per-card **driver chips** that say why each case is complex.
**VO / captions (do the [DO] cue, then read the line):**
- **[DO: open `/cases` in Focus view; show the three lanes and their counts]** "Cases are triaged into three lanes: quick wins, needs review and complex. Complexity is scored zero to ten by Cortex, with the drivers shown."
- **[DO: switch to List view; click the FOI, then EIR, then SAR filter chips in turn, then return to All open]** "The same queue as a list, filtered by regime. FOI is recorded information any authority holds. EIR is environmental information, with no cost limit to refuse behind. And a SAR is a person's own personal data, handled through redaction."
- **[DO: switch to Board view; show the six phases, the counts and the KEY legend]** "The same caseload as a board, laid out across the statutory process from receipt to sign-off, prioritised by deadline, complexity and requester sentiment."
- **[DO: point to the amber Challenge (s.50) column on the right]** "Challenges to the Information Commissioner sit apart on the right. Those arrive by escalation, so they are shown for visibility and are not draggable."
- **[DO: hover a `Cx n` complexity chip, then a `★ n% match` precedent pill]** "Priority is banded high, medium or low, and a precedent match shows how close a clean past case is, using Cortex AI similarity."
- **[DO: drag one card one column to the right, then switch back to Focus]** "Move a case on and the stage advances in Snowflake, logged to the audit trail. It is the officer's board, the officer's decision."
- **[DO: click the Needs review tab; open `FOI-2026-0115`; show 'How AI triaged this case' and the precedent card]** "Needs review is the everyday middle. The AI has done the work and drafted a reply, and the officer checks and confirms before it goes. This one is a partial: we can give the yearly totals, but the outcome breakdown is small enough to identify individuals, so that part is withheld under section 40. The triage covers category, priority, complexity and tone, with the strongest precedent and its prior outcome."
- **[DO: in the Response Studio, point to the 'Why this is a partial disclosure' panel above the letter]** "Above the draft, a plain-English note explains the decision in the officer's terms: what we release, what we withhold under section 40, and where it sits in the letter."
- **[DO: scroll to 'AI evidence & audit trail'; hover the Chain verified badge]** "Every AI decision on the case is hash-chained and tamper-evident. **Chain verified.** Prompts are stored as hashes, never raw personal data, so it is ICO-ready and deletion-compliant."
- **[DO: return to Cases; click the Complex tab; point to the driver chips on the cards]** "Complex is different. These are flagged for human judgement: high complexity, potentially vexatious, a public-interest test to weigh, or multiple exemptions in play, and each card says which. The AI does not draft these. Needs review means it hands you a draft to confirm. Complex means it hands you the case and tells you why it will not draft it."

## Beat 3 — Quick wins, sent as a batch (`/cases`, Quick wins lane) — 3:15–4:15
**On screen:** switch to the **Quick wins** lane. Six cases sit ready: four strong-precedent disclosures and two already-published cases carrying the green **Already published (s.21)** badge, each showing its pre-drafted reply and a green provenance strip. Click **Send N responses** (six by default; see the Act 2 overlap note), confirm in the sign-off dialog, and watch each card flip to **Sent, case closed** and drop out of the lane.
**VO / captions (do the [DO] cue, then read the line):**
- **[DO: switch to the Quick wins lane; show the six ready cards with their green provenance strips]** "The quick-wins lane is the officer's fast path: low-complexity requests with a strong precedent, and information that is already published, each with a reply the AI has already drafted and grounded."
- **[DO: point to the two green Already published (s.21) badges]** "Two of these are section 21, already published, so we point the requester to the source rather than answering twice."
- **[DO: click Send N responses; confirm in the sign-off dialog; watch each card flip to Sent, case closed]** "Review, untick anything you want to handle yourself, and send the rest as one batch. Nothing leaves until you confirm here. Each case then closes and lands on the disclosure log."
- **[DO: note the outcome mix; you saw the partial in Needs review]** "And it is not always a full release. Across the caseload the pipeline varies the outcome: disclosure, partial, or already-published under section 21, with refusal always in the toolkit, and the officer decides. You saw the partial in needs review a moment ago."

## Beat 4 — Knowledge Base (`/guidance`) — 4:15–5:00
**On screen:** open **Knowledge Base** from the top nav (`/guidance`). Under "Evidence base the pipeline retrieves against", show the three grouped sections: the council's own **records** (the full-width hero card), the **disclosure logs** (the council's own log alongside one combined peer-logs card of ~11,500 published answers), and **guidance & legislation**. Open the **Legislation library** tab and click a section, for example **s.12**, to open it on legislation.gov.uk in a new tab. Return to **Guidance & precedent**, type **personal data**, press Enter, and let the grounded results resolve. Then search a citizen-style question that has already been answered, for example **how much is council tax going up next year**, and let the green **Already published · section 21** card resolve with its drafted reply and cited decisions. (Optionally, in the evidence base below, expand the peer-logs card's **Show 5 sources**.)
**VO / captions (do the [DO] cue, then read the line):**
- **[DO: open Knowledge Base from the top nav (`/guidance`); show the three grouped sections]** "This is the evidence base the pipeline retrieves against, grouped by what it is: the council's own records, the disclosure logs it learns precedent from, and the guidance and legislation behind every decision."
- **[DO: point to the full-width records hero, then the combined peer-logs card]** "The council's own records sit apart from the logs. Peer authorities' published answers, over eleven thousand of them, are pooled into one cross-authority precedent set."
- **[DO: open the Legislation library tab; click a section, for example s.12, opening it on legislation.gov.uk]** "The legislation library links straight to the statute on legislation dot gov dot uk, so any claim is one click from its source."
- **[DO: return to Guidance & precedent; type 'personal data', Enter; then search 'how much is council tax going up next year' and let the green Already published · section 21 card resolve]** "Search it the way the AI does. Ask about personal data and it returns the relevant guidance and prior cases, ranked by relevance. And when a question has already been answered, it flags a section 21 already-published reply inline, grounded in the council's own decisions. Nothing the AI cites is invented, and every drafted answer is traceable back here."

---

# ACT 2 — A real request, from inbox to grounded draft

## Beat 5 — Gmail: the request is sent (tab 2) — 5:00–5:20
**On screen:** switch to the Gmail tab. A pre-composed message to `foi@exampleton.onmicrosoft.com` is open: subject "Freedom of Information request — senior officer salaries", body asking for all staff earning over £100,000. Click **Send**.
**VO / captions (do the [DO] cue, then read the line):**
- **[DO: switch to the Gmail tab; the pre-composed message is open; click Send]** "A member of the public sends a real Freedom of Information request to the council's inbox: every officer earning over one hundred thousand pounds."

## Beat 6 — Outlook: the mailbox receives it (tab 3) — 5:20–5:35
**On screen:** switch to the Outlook tab (shared `foi@exampleton.onmicrosoft.com`). The new message arrives at the top of the inbox. Hold on it briefly.
**VO / captions (do the [DO] cue, then read the line):**
- **[DO: switch to the Outlook tab; the new message arrives at the top; hold on it briefly]** "It lands in the council's shared FOI mailbox in Outlook, exactly as it would today."

## Beat 7 — FOI Sentinel intake and triage (`/intake`, tab 1) — 5:35–7:15
**On screen:** switch to FOI Sentinel `/intake`, Outlook Test tab. "Waiting to be triaged" shows the unread message. Click **Run the pipeline**. Let the six steps reveal: 1 Intake & classification, 2 Triage (section 14 vexatious, section 21 duplicate), 3 Precedent match, 4 Suggested answer, 5 Evaluation, 6 Compiled draft. Expand one "Under the hood" to show the SQL/prompt.
**VO / captions (do the [DO] cue, then read the line):**
- **[DO: switch to FOI Sentinel `/intake`, Outlook Test tab; the unread message shows under 'Waiting to be triaged']** "FOI Sentinel pulls it straight from Outlook through Microsoft Graph, into Snowflake. No middleware."
- **[DO: click Run the pipeline; let steps 1 Intake and 2 Triage reveal]** "Run the pipeline and follow each step. It is classified, then triaged: category, priority, complexity and effort."
- **[DO: point to the section 14 and section 21 checks in the triage step]** "Triage also checks for section 14 and section 21. Section 14 lets us refuse a vexatious request, one whose burden outweighs its value, or a repeat of one we have already answered. Section 21 covers information already published, which we signpost rather than answer twice."
- **[DO: let steps 3 Precedent match, 4 Suggested answer and 5 Evaluation reveal]** "It matches this council's own records and peer precedent, drafts a grounded answer, then self-evaluates for groundedness and coverage before anyone sees it."
- **[DO: expand one 'Under the hood' to show the SQL and prompt]** "Every step is inspectable: the SQL and the prompts are on screen."

## Beat 8 — Response Studio: the grounded draft (open the case → Studio) — 7:15–8:15
**On screen:** open the new case, go to Response Studio. Note the four outcome buttons (Disclosure, Partial, Refusal, Already published), with **Disclosure** pre-selected for this request. Generate the grounded draft. Show the letter with inline `[S1]`/`[S2]` citations, the data-provenance strip (green verified-source chips), the citation legend resolving each marker, and the **DISCLOSURE** badges: **Exemption stated ✗, Internal review ✓, ICO route ✓**.
**VO / captions (do the [DO] cue, then read the line):**
- **[DO: open the new case, go to Response Studio; point to the four outcome buttons with Disclosure pre-selected]** "The studio offers four outcomes: disclosure, partial, refusal or already-published. The pipeline pre-selects the right one from triage, and the officer can change it. This request has nothing to withhold, so it is a full disclosure."
- **[DO: click Generate the grounded draft; show the letter with inline [S1]/[S2] citations]** "The draft is grounded in the council's own records, every figure carrying a citation you can trace to a verified source table."
- **[DO: point to the DISCLOSURE badges (Exemption stated cross, Internal review tick, ICO route tick)]** "It carries the statutory essentials automatically: the internal-review right and the ICO complaint route. No exemption applies here, so it discloses in full and states no exemption."
- **[DO: point to the data-provenance strip and the citation legend resolving each marker]** "A complete, ready-to-send letter in plain English, benchmarked against real peer disclosure."

---

# ACT 3 — Subject access, redaction, and the live document estate

## Beat 9 — SAR queue, then the workspace (`/sar`, tab 1) — 8:15–9:45
**On screen:** open `/sar` — the **SAR queue**. Show the inbox of Subject Access Requests: pseudonymised requesters, the one-calendar-month clock (one paused pending ID), and a "verified vs awaiting identity" status. Click the verified request **SAR-2026-0107** to open it. The header resolves the pseudonymised requester to the **verified data subject** (James Whitfield, claim HB-2026-55821). **Hover the "Identity verified" badge** to reveal how that was done: logged pseudonymised, then verified out of band on 2026-06-24 by an Information Governance officer, photo ID and proof of address matched to the Housing Benefit claim record. Then show the estate-wide findings: the **AI third-party scan clears two of the six documents** as the subject's own data and flags the other four for review, so the officer looks only where it matters. Below that, structured records with third-party PII masked in the data layer. Scroll to the embedded Redaction Studio; click **Run AI redaction**; show findings with confidence and the "AI suggests, the officer decides" framing; **untick** a council officer's email (`thomas.lee@`) to keep it; show the released document and counts update; click **Confirm & release**; click **Re-run** and land on "Learned from N prior decisions" with "kept last time".
**VO / captions (do the [DO] cue, then read the line):**
- **[DO: open `/sar`; show the SAR queue with pseudonymised requesters and the one-month clock]** "Subject Access Requests arrive in a queue, held pseudonymised until identity is verified, each on a one-month clock."
- **[DO: click SAR-2026-0107; the header resolves to the verified data subject (James Whitfield)]** "Open a verified request and it resolves to the data subject. Only now is the person named, to the officer working the case."
- **[DO: hover the 'Identity verified' badge to reveal the out-of-band verification]** "How can we be confident it is really them? The request came in pseudonymised, and identity was verified separately, against the council's own claim record, before anything was revealed."
- **[DO: show the estate-wide findings: AI clears two of six documents, flags four for review]** "A SAR spans the whole estate: documents from SharePoint and structured records in one governed view. The AI clears two documents as the subject's own and flags four for review, narrowing where the officer looks."
- **[DO: point to the structured records with third-party PII masked in the data layer]** "Section 40 protects other people's personal data, so the requester keeps their own and third parties are removed."
- **[DO: scroll to the Redaction Studio; click Run AI redaction; untick the officer email `thomas.lee@` to keep it]** "Cortex finds third-party personal data with a confidence score, but the AI only suggests. The officer decides. Keep a colleague's official contact, redact the rest."
- **[DO: show the released document and counts update; click Confirm & release; click Re-run to land on 'Learned from N prior decisions']** "The released document updates as you decide, then you release it. And it remembers your decisions: next time, the same choices are pre-applied. Human judgement, remembered and auditable."

## Beat 10 — SharePoint: continuous sync (tab 4) — 9:45–10:45
**On screen:** switch to the SharePoint `FOISARDemo` Documents library, where the council's case files already live. Save one further file, `2026-04-02_ASC-2026-04021_file_note.docx`, into the library. Cut a short wait (or trim). Switch back to `/sar` and **refresh**: the document now appears in the findings, surfaced by relevance, flagged by AI as containing third-party data (Mrs Sarah Quinn) and linked back to SharePoint.
**VO / captions (do the [DO] cue, then read the line):**
- **[DO: switch to the SharePoint FOISARDemo Documents library where the case files live]** "Councils already keep their case files in SharePoint. Openflow mirrors that library into Snowflake, continuously."
- **[DO: hold on the existing library contents]** "So when a SAR lands, the relevant documents are already there, indexed and searchable."
- **[DO: save `2026-04-02_ASC-2026-04021_file_note.docx`; switch to `/sar` and refresh; the doc appears flagged for third-party data]** "Save a new file this morning, and it is pulled in within minutes. Refresh, and it is discoverable by relevance and flagged for third-party data."

## Outro card — 10:45–11:00
`One governed platform.` / `FOI, EIR and SAR: from inbox to defensible disclosure, on Snowflake.`

---

## Optional tail — the price of a response
**On screen:** on the live case, the "AI cost of this response" card.
**VO / captions (do the [DO] cue, then read the line):** **[DO: on the live case, point to the 'AI cost of this response' card]** "Triaged, grounded, drafted and self-checked for pennies, metered live from real Cortex token usage."

---

## Notes for the automated pass
- Tab switches are on-screen (`page.bringToFront()`), so the viewer sees the round-trip across Gmail, Outlook and the app.
- **Beat 3 mutates state:** sending the quick-wins batch closes those six cases (status CLOSED, dispatched, OUTCOME written). Before each take, reset them to OPEN and clear the dispatched drafts, or the lane will be empty on the next run. Keep a small reset SQL to hand (set STATUS='OPEN', CURRENT_STAGE back, DISPATCHED_AT=NULL on the six references; restore OUTCOME='S21_REUSE' for 0108/0109 and NULL for the four disclosures).
- **Beat 2 (cont.) Board drag mutates state:** dragging a card calls `SP_ADVANCE_STAGE`, so the moved case's `CURRENT_STAGE` changes and a stage-advance event is logged. Note which reference you drag and restore its `CURRENT_STAGE` before the next take, so the board looks the same each run. Pick a case that is NOT one of the six quick-wins or 0115/0119, to keep the other beats stable.
- **Beat 3 prerequisite:** each quick-win case needs a pre-drafted reply so the cards are populated. Seed via `POST /api/suggest-answer/precompute { references:[...], withLetter:true }` for the six references before recording (0114/0102/0128/0126 disclosure, 0108/0109 s.21). FOI-2026-0115 (the needs-review partial opened in Beat 2) is seeded the same way but with a `guidanceNote`, so its letter discloses the yearly grievance totals and withholds the outcome breakdown under s.40(2).
- **Outcome variety, by design:** the walkthrough shows three outcomes on screen — disclosure (quick wins and Act 2), partial (FOI-2026-0115 in Beat 2) and s.21 (quick wins and the Knowledge Base). We deliberately do not stage a full refusal; the point is that the pipeline varies the outcome rather than rubber-stamping a release, and refusal stays covered in the glossary and the Studio's four outcome buttons. Narrate the partial on that theme rather than reaching for a refusal. We open only one partial (0115); the second partial (0119) is no longer opened, to avoid showing two same-outcome cases.
- **Lane taxonomy (Beat 2):** a case is **Complex** when it is potentially vexatious, complexity ≥ 7, **engages a public-interest test**, or has **≥ 2 exemptions applied** (not a bare score threshold), and each complex card shows the concrete driver plus the AI complexity factors. **Needs review** is the everyday middle (AI drafts, officer confirms). This is the firm on-screen distinction; 0115 stays Needs review (one absolute exemption, no PIT) and 0119 stays Complex.
- **Use this precedent (not clicked in the demo, but live):** adopting a precedent records the human sign-off, logs it on the audit trail, and advances the case to Drafting. If the case has no draft yet, it also grounds a fresh reply on that exact precedent (source S1) so the letter mirrors how a similar request was answered before. If a draft already exists it is never overwritten; the officer uses "Regenerate from precedent" in the Studio to align it. This is the customer-demo value: consistency, explainability and human accountability.
- **Cost estimate (s.12 card removed 2026-07-09; AI-cost comparison removed 2026-07-09):** the s.12 **Cost estimate** card has been removed from the case view, so do **not** narrate a cost figure in Beat 2. The **AI cost card** now shows only the metered £ figure (calls · tokens · latency); the on-screen "cheaper than the manual estimate" comparison has been removed, and the rate-card note is now an (i) tooltip on the card title. The seeded £137.5 estimate remains only as a **Case history** event (append-only audit record, left as-is).
- **Topic overlap:** quick-win `FOI-2026-0114` is "Senior officers earning over £100,000", the same topic as the live Act 2 email. To avoid closing that topic in Beat 3 and then receiving a near-identical request in Act 2, untick `FOI-2026-0114` from the batch (send five) so the senior-salary thread stays fresh for Act 2.
- Beat 7 (intake) is the most compressible if the cut runs long (show three of the six steps).
- Caption beats are ~8–12 words so they read at a comfortable pace; tighten to the live narration.
- Dry-run once end-to-end to confirm exact on-screen labels before the pass. Beats 2–4 require the KB-v2 / outcome-variety SPCS deploy to be live first (see the deploy gate at the top).
