# Demo-Script Verified-Lens Review — WI-12 Item 4

**Date:** 2026-07-06 · **Build:** localhost:3100 (PG-SNOWFLAKE) · **Companion to:** `demo-script.md`

Every caption line paired with **how it is actually wired** and a **verification status** against the running app / DB. Status: ✅ verified this pass · ◑ verified prior (WI-11) · ⚠ caveat/presenter-note.

**Pre-record confirmed:** `/`, `/cases`, `/intake`, `/guidance`, `/sar`, `/redaction` all return **200**. Data spot-checks: 36 real open cases, SLA config present, 16-row WDTK benchmark, SAR corpus 6 docs, 10 redaction decisions (learned state), 36 grounded suggested answers, FOI_LEGISLATION 59 sections.

---

## Section 1 — Command Centre (`/`)
| Caption claim | Technical hookup | Status |
|---|---|---|
| "Every FOI, EIR and SAR request — one live view" | `getFocusCases`/`getCases` over `V_CASE` (all three regimes) | ◑ |
| "The statutory clock: 20 working days. At-risk and overdue, up front" | `V_CASE.WD_REMAINING`; overdue = `WD_REMAINING < 0`, at-risk = `RAG='RED'` (matches the semantic view's verified queries) | ✅ |
| "An SLA gauge against the regulator's in-time target" | `COUNCIL_CONFIG.SLA_TARGET_PCT` (config row present) vs answered-in-time rate | ✅ |
| "How we compare to peers on WhatDoTheyKnow" | `V_WDTK_BENCHMARK` (16 rows) | ✅ |
| "Cortex reads the inbox: what people are asking about" | word cloud from case subjects/themes | ◑ |
| "Repeat requesters and campaigns… including possible s.14" | `getRequesterPatterns` (repeat-requester aggregation) | ◑ |

## Section 2 — Cases (`/cases`)
| Caption claim | Technical hookup | Status |
|---|---|---|
| "Triaged into quick wins, needs-review, complex" | Focus lanes from priority/complexity bands | ◑ |
| "Complexity scored 0-10 by Cortex — with the drivers" | `FOI_TRIAGE` complexity rank + driver text | ◑ |
| "Priority banded high / medium / low" | `V_CASE.PRIORITY_BAND` | ◑ |
| "A precedent match: how close a clean past case is" | `FOI_PRECEDENT_MATCH.SIMILARITY_PCT` — real `AI_SIMILARITY` (`SP_REFRESH_PRECEDENT_MATCH`) over clean requests | ◑ |
| "Precedent uses Cortex AI_SIMILARITY over past clean requests" | as above; corpus = own replies + GLA + WDTK, incl. synthetic (flagged) | ◑ |
| "The strongest precedent, with the prior response and outcome" | `getPrecedentMatch` top row | ✅ |
| **"The match score is real; illustrative comparators are labelled"** (new 4:15) | **Item 3:** `PrecedentCard` shows amber "Illustrative example" badge when `IS_SYNTHETIC` (23/31 cases). Verified: 0114 badged, 0115 not. | ✅ |
| "One click to reuse that precedent and move the case on" | `/api/precedent` `use` action advances stage | ◑ |

⚠ **Presenter note:** pick the precedent case deliberately (see script note). Never narrate a synthetic match as a real authority disclosure.

## Section 3 — Intake → triage (`/intake`)
| Caption claim | Technical hookup | Status |
|---|---|---|
| "A real request arrives — straight from Outlook via Microsoft Graph" | Graph-ingested mail landing table | ◑ |
| "No middleware: the mailbox lands in Snowflake" | direct Graph → Snowflake ingestion | ◑ |
| "Run the pipeline. Watch it work, live" | 6-step notebook UI (`outlook-test.tsx`) | ◑ |
| "Classified, then triaged: category, priority, complexity, effort" | classification + `FOI_TRIAGE` | ◑ |
| "Matched to this council's own records and peer precedent" | `gatherGroundedSources` (internal holdings + peers) | ✅ |
| **"A grounded draft answer — with citations to verified council sources"** (strengthened) | **Item 1 + F1:** `generateGroundedLetter` cites real figures inline `[S1]`, persists SOURCES; **peer corpora now pass a reranker floor** so weak hits don't leak; provenance strip + citation legend render | ✅ |
| "Evaluated for groundedness and coverage before anyone sees it" | eval verdict on `FOI_SUGGESTED_ANSWER` (81% ground / 85% cov / 27 pass) | ◑ |
| "A compiled statutory draft, benchmarked against real peer disclosure" | `WDTK_RESPONSE_BODY` real disclosures per theme | ◑ |
| "Every step is inspectable — the SQL and prompts are right there" | "Under the hood" expanders | ◑ |

## Section 4 — Knowledge Base (`/guidance`)
| Caption claim | Technical hookup | Status |
|---|---|---|
| "The knowledge an officer needs, in one place" | `getCorpusCoverage` cards | ◑ |
| **"Council and ICO guidance, past disclosures, legislation"** | **Item 2:** legislation is now a real corpus card — `FOI_LEGISLATION_SEARCH` (59 sections), rendered on `/guidance`. Previously legislation was named but not searchable. | ✅ |
| "Precedent from other local authorities — WhatDoTheyKnow" | `WDTK_EVENT` / `WDTK_AUTHORITY` cards | ◑ |
| "The same evidence base that drove the precedent match" | shared `cortexSearch` corpora | ◑ |
| "Search it by hand, or let the pipeline retrieve against it" | `/guidance` search → `SEARCH_PREVIEW`; pipeline → `gatherGroundedSources` | ✅ |

## Section 5 — SAR + Redaction (`/sar` → `/redaction`)
| Caption claim | Technical hookup | Status |
|---|---|---|
| "A Subject Access Request spans the whole estate" | `/sar` findings over `SAR_DOC_CORPUS` (6) + LOB records | ✅ |
| "Documents from SharePoint, plus structured records — one governed view" | SharePoint corpus + structured LOB | ◑ |
| "The requester gets their own data; third parties must be removed (s.40)" | s.40 framing | ◑ |
| "Cortex AI_EXTRACT finds third-party personal data — with confidence" | `AI_EXTRACT` redaction findings + confidence | ◑ |
| "The AI only suggests. The officer decides each item" | HITL keep/redact toggles | ◑ |
| "Keep a colleague's official contact; redact the rest" | untick `thomas.lee@` | ◑ |
| "The released document updates as you decide. Then release" | live released-doc + counts | ◑ |
| "It learns: next time, your decisions are pre-applied" | `SAR_REDACTION_DECISION` (10 rows) drives pre-apply | ◑ |
| "'Kept last time' — human judgement, remembered and auditable" | decision provenance | ◑ |

## Section 6 — Live SharePoint pull-through (manual)
| Caption claim | Technical hookup | Status |
|---|---|---|
| "A caseworker saves one file to SharePoint … the only manual step" | manual upload of walkthrough note | ◑ (manual capture) |
| "Openflow captures it, parses it with Cortex, lands it in Snowflake" | Openflow CDC → `SAR_INGEST` (`SAR_SHAREPOINT_SEARCH`, 2-min lag) | ◑ |
| "Refresh the SAR — and there it is, discoverable in seconds" | `/sar` refresh; count 6→7 | ◑ (see `upload-and-verify.md`) |

---

## Verdict
Demo script is **truthful against the current build**. The three WI-12 changes are reconciled:
1. **Precedent honesty (Item 3)** — script now instructs deliberate case choice + adds an honesty caption; app badges synthetic matches.
2. **Grounded drafts + provenance (Item 1/F1)** — Section 3 now points to the provenance strip + citation legend; ungrounded path retired.
3. **Legislation grounding (Item 2)** — Section 4 legislation claim is now backed by a live corpus card + search service.

Remaining ◑ items were verified under WI-11's demo-readiness audit and are unchanged. No blocking gaps. **Gate: demo-valid.**
