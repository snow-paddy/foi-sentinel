# FOI Sentinel v2 — Backlog

Captured items not yet built. Each notes the intent, why it matters, and a first-pass approach.

---

## 1. Outlook email → app integration (show it in practice)
**Intent:** Demonstrate the real intake path — a request arriving in the council's shared Outlook/Exchange mailbox automatically becoming a triaged case — rather than the simulated Intake composer.
**Why:** The Intake page already explains the production pipeline (Graph/Power Automate → stage → Snowpipe → triage task). The champion demo lands harder if we *show* an email flowing in end-to-end.
**Status:** Being scoped with `xo-discover` → see `audit/scope-outlook-intake.md`.

## 2. Understand why FOI decisions (e.g. "Refused") happen — WhatDoTheyKnow — ✅ DONE (2026-06-30)
Pre-extracted a one-line plain-English "why" + normalised exemption sections from the WDTK corpus via Cortex (added `WDTK_EVENT.REFUSAL_REASON`/`REFUSAL_SECTIONS`, populated over 31 refused/partial/not-held/exemption-citing rows). Surfaced in two places: (a) the **sector precedent search** — refused/partial WDTK cards now show an exemption chip (`s.12, s.43`) + the one-line reason; (b) a new **Sector Trends panel "Why requests get refused across the sector"** ranking the most-cited exemptions (s.12 cost, s.43 commercial, s.21 accessible, s.40 personal, s.14 vexatious) with a representative reason each. `getWdtkRefusalReasons()` (EVENT_ID lookup, enriches search hits) + `getRefusalDrivers()` (FLATTEN over EXEMPTIONS codes) in queries.ts. Ties to FOIA step 4 (exemptions/PIT).

**Original intent:** Surface *why* similar requests were refused/granted, not just that they were. Reference example:
`https://www.whatdotheyknow.com/request/foi_request_machine_learning_mod#outgoing-1994222`
**Why:** Ties to FOI process step 4 (exemptions/PIT). Helps the officer anticipate the likely exemption and draft defensibly; strengthens the precedent feature.

## 3. Simplify the case funnel (why so many steps?) — ✅ DONE (2026-06-30)
Board funnel relabelled to the 5-step FOIA process (+ Challenge): Receipt & logging (s.8·s.10) · Triage & allocation (s.16) · Retrieval & cost (s.12) · Review, redaction & PIT (s.40/43·s.45) · Sign-off & disclosure (s.17) · Challenge (s.50). The 17 stages now show as the precise stage on each card. Implemented by remapping `PHASES` (+ label/note) in queries.ts; KanbanBoard renders label + statutory note.

**Original intent:** The board funnel exposes the full 17-stage lifecycle; the canonical FOIA process is ~5 steps (Receipt → Triage → Retrieval → Review/Redaction → Sign-off, + Challenge). Consider making the 5/6-step process the primary funnel.
**Why:** Clarity for the demo; the 17 stages are operationally precise but hard to read at a glance.
**Note:** We *already* group the 17 `LIFECYCLE_STAGE` rows into **6 PHASES** (`PHASES`/`STAGE_TO_PHASE` in queries.ts) — the board uses phases. Proposal: align the 6 phases explicitly to the 5-step FOIA process (see `audit/personas.md` → "The FOI response process"), relabel for plain English, and keep the 17 stages as the detail tier. Low-risk: a labelling/grouping change, not a data migration.

## 4. Camden disclosure log — same approach as GLA — ✅ DONE (2026-06-30)
Wired the existing Camden corpus (`CAMDEN_FOI_RESPONSES`, 11,420 parsed response PDFs to Mar 2026; `CAMDEN_FOI_SEARCH` already ACTIVE) into the same surfaces as GLA — no scraper needed (data already ingested). Added: `getCamdenSpotlight()` + `getCamdenLinks()` in queries.ts; a **Camden disclosure-log spotlight** card on Sector Trends (recent 5, FOI/EIR split, source-PDF links); `CAMDEN_FOI_SEARCH` added to the sector precedent search (`/api/search` mode=sector) and to `suggestAnswer` citations; Camden row count on Admin. Regime (FOI vs EIR) is derived from the response text ("dealt with under the Environmental Information Regulations" → EIR) since Camden has no REGIME column. DOCUMENT_LINK isn't a returnable Cortex Search attribute, so search hits are enriched with their real link via an IDENTIFIER lookup. Camden is framed as a peer/sector source (home council = "Exampleton Council", not Camden).

**Original intent:** Replicate the GLA disclosure-log ingest/search for Camden.
Reference: `https://www.london.gov.uk/who-we-are/governance-and-spending/sharing-our-information/foi-disclosure-log`
**Why:** Broadens cross-authority precedent/benchmarking with a borough-level source.

## 5. Semantic disclosure-log deflection (upgrade Brentwood's keyword gate)
**Intent:** Ingest Brentwood's answered-FOI **disclosure-log entries** (case ref, title, response text, signpost links, attachments) into a Cortex Search service, then offer (a) a **citizen** "check before you ask" gate that matches in plain English and drafts a grounded, cited pointer, and (b) an **officer** "has this been answered before?" assist on intake.
**Why:** Brentwood's live flow already forces a **Disclosure Log Search** before the request form, but it is **keyword-only** — a paraphrase with no shared token ("mobility permit for wheelchair users") misses "Blue badge parking bays". Semantic search + `suggestAnswer`-style grounding fixes recall and turns "44 documents" into "here's the likely answer." Deflection-rate becomes a buyer cost-avoidance KPI.
**Finding:** the current `BRENTWOOD_FOI_SEARCH` indexes Brentwood **publication-scheme/transparency pages, not the disclosure log** — so this needs a real disclosure-log ingest (entries live behind the `my.brentwood.gov.uk` AchieveForms widget; find its data source/API). See `audit/brentwood-disclosure-log-audit.md`.
**Status:** Audited 2026-07-01, not built.

## 6. WhatDoTheyKnow — most common attachment types
**Intent:** Analyse the attachment/file types most commonly submitted with FOI requests on WhatDoTheyKnow.
**Why:** Brentwood's request form (and disclosure-log entries) support **uploads**; to handle attachments at intake (`AI_PARSE_DOCUMENT`) we should know the real distribution of formats (PDF, DOCX, XLSX, images, etc.) to expect. Feeds the Outlook intake pipeline (backlog 1).
**Status:** Raised 2026-07-01 during the Brentwood audit, not built.
