# FOI Sentinel v2 — React migration inventory

Living source of truth for porting the Streamlit app (`05_app/app_pages/*.py`) to
React/Next.js on SPCS (`08_react_app/`). Update this as pages land.

- **Stack:** Next.js 16 + React 19 + Tailwind v4 + shadcn/ui, Server Components reading
  real Snowflake (`FOI.FOI_SENTINEL_V2`) under owner's rights; client islands hit `/api/*` for writes.
- **Last updated:** 2026-06-29
- **Deploy:** GATED — local dev only until explicit confirmation.

## Status at a glance

| # | Old Streamlit page | React route | Status |
|---|--------------------|-------------|--------|
| 1 | Command Centre | `/` | Done |
| 2 | Cases (Kanban + drill-in) | `/cases` (list+board toggle), `/cases/[reference]` | Done (see gaps) |
| 3 | Board (read-only) | merged into `/cases?view=board` | Done |
| 4 | Workspace (single case) | `/cases/[reference]` (clock, cost, PIT, redaction, responses, suggestion) | Done |
| 5 | Intake & Triage | `/intake` (shared with Email Intake) | Done |
| 6 | Email Intake (demo) | `/intake` | Done |
| 7 | Response & Refusal Studio | folded into `/cases/[reference]` (left column); `/studio` → redirects to `/cases` | Done |
| 8 | Internal Review & ICO | `/cases?view=reviews` tab; `/review` → redirects | Done |
| 9 | Escalations (demo) | generator inside `/cases?view=reviews`; `/escalations` → redirects | Done |
| 10 | Performance Reporting | `/reporting` | Done |
| 11 | Sector Trends | `/sector-trends` | Done |
| 12 | Knowledge & Guidance | `/guidance` | Done |
| 13 | Admin & Configuration | `/admin` | Done |
| 14 | About & Architecture | `/about` | Done |
| 15 | Triage Learning | `/learning` | Done |

| 16 | Published information (NEW) | `/published` — Cortex Search + COMPLETE s.21 "already published" deflection over committee/cabinet decisions | Done |

**Ported: all functional pages + new Published-information section.** Remaining: xo audit Playwright/visual gate + SPCS deploy (both deferred/gated).

### IA restructure (2026-06-30)
- **Studio** folded into case detail (full-width left column under the request); standalone `/studio` removed (redirect). Hover/active polish on Cases list rows.
- **Reviews & ICO + Escalations** moved into Cases as the `?view=reviews` tab (escalation generator is a collapsible action there). `/review` + `/escalations` redirect in.
- **Complexity chip** gained a "how it's calculated" tooltip (method + per-case drivers).
- **SAR redaction** is now a before/after two-pane (original w/ highlighted PII ↔ redacted release), in the wide left column for SAR cases.
- **Reporting** gained a modelled **cost-of-processing-an-FOI** panel (triage hours × £25/hr, vs the s.12 basis + a published £100–200 benchmark).
- **Published information** (NEW): seeded 7 demo-marked committee/cabinet decision docs into `COUNCIL_POLICY_DOCS` (DOC_TYPE='COMMITTEE_REPORT'), indexed by `COUNCIL_POLICY_SEARCH`.
- **Nav** regrouped: Primary = Command Centre · Cases · Intake; "More" = *Insight & knowledge* (Reporting, Sector Trends, Published information, Guidance, Triage Learning) + a separated *System* (Admin, About).
- Persona/journey spec written under `audit/personas.md` + `audit/user_journeys.md` (xo-audit Phases 1–2; gate Phases 3–5 deferred).

## What the React app has today

- **Command Centre** (`/`): KPIs, SLA gauge, peer benchmark, pipeline funnel (bottleneck top-3 + drill), d3-cloud word cloud, requester patterns (anonymised).
- **Cases** (`/cases`): List | Board toggle. List = filtered table (risk/regime/stage) with RAG, deadline, complexity, sentiment, job-title owner. Board = Kanban (6 phases / 17 stages), drag-to-advance (`SP_ADVANCE_STAGE`), figures + legend, complexity/sentiment/precedent chips.
- **Case detail** (`/cases/[reference]`): statutory strip, deadline banner, request text, case-history timeline, Details (inline stage editor), **AI Triage panel** (classification, complexity + factors, sentiment + rationale, departments, model/confidence, s.21), **Precedent match** (HITL use/review), cost estimate, exemptions.
- **Email Intake** (`/intake`): compose or AI-generate an inbound FOI email (tone selector, optional Camden topic seed) -> live `CORTEX.SENTIMENT` + `COMPLETE` triage rendered in the shared `TriagePanel` -> "Create case" writes a real, non-synthetic case marked demo-origin (`(Demo) ` subject prefix + `-D` reference + "Demo intake" badge) into FOI_CASE/FOI_TRIAGE(REASONING_JSON)/FOI_CASE_EVENT, with a "clear demo cases" reset. Generated emails are tone-faithful and the displayed sentiment is clamped to the chosen tone's band for demo reliability (raw `SENTIMENT` when no tone).
- **Precedent match**: `★ NN% match` pill on board **and** list; detail HITL card. "Use this precedent" adopts it and advances the case to **Response drafting** (`SP_ADVANCE_STAGE`, forward-only) with success feedback; the `NN% similar` pill explains the `AI_SIMILARITY` logic + clean corpus (council / GLA / WhatDoTheyKnow).
- **SAR redaction** (`SarRedactionPanel`, SAR detail only): per-doc `AI_REDACT(mode=>'detect')` -> human ticks each span (keep requester's own, redact third parties) -> multibyte-safe released preview -> "Release bundle" writes `SAR_REDACTION` + a human DECISION event.
- **APIs:** `/api/advance-stage` (toPhase/toStage), `/api/precedent` (use/review, returns advancedTo), `/api/sar/{detect,release}`, `/api/intake/{generate,triage,create,clear}`.

## Functional gaps in the React case detail (vs old Workspace/Cases)

- Document **redaction** — FOI (`FOI_REDACTION`) still pending; SAR (`AI_REDACT` over `SAR_SOURCE_DOC` -> `SAR_REDACTION`) is **done** (SAR detail).
- **Response drafting** — `SP_GENERATE_RESPONSE` / Cortex `COMPLETE` disclosure/refusal drafts.
- **Clock stop/resume** — `SP_STOP_CLOCK` / `SP_RESUME_CLOCK` (only stage advance today).
- Cost **re-estimate** trigger (`SP_COST_ESTIMATE`); priority override.

## Data conventions (do not regress)

- **No personal names in the UI.** Requesters are hashed in-DB ("Citizen XXXX") or shown as the organisation. **Officers are shown by job title only** (`FOI_OFFICER.PERSONA`) — no names, no initials.
- Analytics exclude `IS_SYNTHETIC` cases. Reference prefix (FOI-/EIR-/SAR-) encodes regime.
- Triage reasoning is **stored** in `FOI_TRIAGE.REASONING_JSON` (`complexity_factors`, `sentiment_rationale`), computed by Cortex at/after intake — never computed in the UI.

## Roadmap (sequenced)

1. **Email Intake demo** (`/intake`) — DONE (2026-06-29). Live SENTIMENT + COMPLETE triage → shared `TriagePanel` → create demo-marked case.
2. **SAR redaction**: SAR-only detail panel, `AI_REDACT(mode=>'detect')` + HITL span confirm -> release bundle. DONE (2026-06-30).
3. **Agentic answer suggestion** (builds on the precedent card): one common FOI — ground in internal data (Cortex Analyst/Search), then escalate to web search for a partial public answer.
4. **Local-gov APIs**: research ModernGov/democracy-system feeds as public-data sources.
5. **Remaining pages**: Response Studio, Review/ICO, Reporting, Sector Trends, Guidance, Admin, About, Triage Learning, Escalations.
6. **xo audit**: re-baseline once the above land.
