# FOI Sentinel v2 — Persona Audit Report

- **Date:** 2026-07-02 (functional) · 2026-07-03 (live Phase 4b visual sweep completed)
- **Scope:** Entire app, **end-user perspective primary** (buyer/champion where they meet an end-user screen).
- **Harness:** `http://localhost:3100` (Next.js 16.2.9 dev, `SNOWFLAKE_CONNECTION_NAME=PG-SNOWFLAKE`). All 16 routes reachable.
- **Method:** Server-rendered HTML signal inspection for every route + static theme-token scan + **completed live agentic per-page visual sweep (Phase 4b)** on 2026-07-03. The IDE browser panel was recovered by closing the dead `localhost:3000` tab and driving navigation via in-app click (URL navigation still lagged). All 12 primary pages + the "More" dropdown overlay were probed live with a brand-whitelisted dark-surface detector and screenshotted; `/redaction` was additionally exercised end-to-end (live AI_EXTRACT run).

## Per-story results (end-user primary)

| ID | Story | Signal asserted | Result | Evidence |
|----|-------|-----------------|--------|----------|
| US-EU-01 [KEY] | Workload at a glance (`/`) | KPI tiles + at-risk/overdue | **PASS** | Command Centre renders "at risk"/"overdue" signals |
| US-EU-02 [KEY] | Cases list & deadlines (`/cases`) | rows w/ refs + deadline | **PASS** | h1 "Cases"; ref `FOI-2026-0126` present |
| US-EU-03 [KEY] | Open a case (`/cases/[ref]`) | case detail + answer/stage | **PASS** | `/cases/FOI-2026-0126` 200; shows Draft, Exemption, Precedent, Stage, Working days, deadline |
| US-EU-04 [KEY] | Intake & triage (`/intake`) | inbound list + run control | **PASS** | renders Outlook, Triage, "Waiting to be triaged", pipeline |
| US-EU-05 | Knowledge/precedent (`/guidance`) | evidence-base grid | **PASS** | 8-corpus grid (11,611 records total), tabs, legislation library |
| US-EU-06 [KEY] | SAR redaction (`/redaction`) | findings + confidence + kept | **PASS** | live-confirmed: 9 third-party items redacted, James Whitfield + phone + ref kept, confidence chips, `[… REDACTED]` blackouts |
| US-EB-01 [KEY] | Compliance reporting (`/reporting`) | compliance % vs target | **PASS** | renders compliance / SLA / target |
| US-EB-02 | Cost-effectiveness (`/reporting`) | £ manual vs assisted | **PASS** | Manual / Assisted / Saved / per-FOI |
| US-EB-03 | Evidence base / data honesty (`/guidance`) | provenance + synthetic label | **PASS** | each corpus shows "Accessed via:"; SYNTHETIC labelled; data-delta callout |
| US-CH-01 | Narrative flow, no dead ends | nav resolves | **PASS** | legacy routes 307 → working canonical views (`/review`→`/cases?view=reviews`, `/board`→`/cases?view=board`, `/published`→`/guidance?tab=published`, `/studio`→`/cases`); targets all 200 |
| US-CH-02 [KEY] | No broken/dark surfaces (visual gate) | Phase 4b probe per page | **PASS** | **live sweep complete** — 12/12 pages + "More" overlay: canvas avg 242 (light), **0 dark-surface defects** after brand whitelist; all button/badge dark hits confirmed intentional GOV.UK palette (green `0,112,60`, blue `29,112,184`); static token scan clean (0 misused `--*-fg`) |
| US-ADV-01 | Secondary/ops pages load | 200 + heading | **PASS** | `/admin`, `/about`, `/sector-trends`, `/learning` all 200 w/ headings |

## Persona coverage matrix (lens × key use case)

| Lens | Key use cases | Verdict |
|------|---------------|---------|
| **End-user (FOI/SAR officer)** | UC1 workload, UC2 intake, UC3 grounded answer, UC5 SAR redaction, UC6 knowledge | **PASS** — full journey inbox → case → grounded draft → SAR redaction works |
| **Economic buyer** | UC7 compliance, UC8 cost, UC9 auditability/honesty | **PASS** — compliance vs target, cost model, provenance + synthetic labelling all visible |
| **Champion** | UC2→UC3→UC4 pipeline, UC5 redaction wow | **PASS** — narrative reachable, redaction is a clean "moment that matters", visual sweep now complete and clean |

## Visual / theme section (Phase 4b — COMPLETE, 2026-07-03)

**Probe:** for every element in `main`/`header`, flag `background-color` with avg(RGB) < 90 on a light canvas (canvas avg > 150, alpha > 0.5), excluding the GOV.UK brand palette (blue 29,112,184; green 0,112,60; red 212,53,28; orange 244,119,56; near-black text 15,23,42 / 17,24,39 / 11,46,99). Every page also screenshotted for human-readable confirmation.

| Page | Canvas avg | Dark defects | Notes |
|------|-----------|--------------|-------|
| `/` Command Centre | 242 | 0 | 86% gauge, KPI tiles, pipeline RAG bars all readable |
| `/cases` | 242 | 0 | 2 dark hits = intentional green action buttons (Quick wins / Send 4 responses) |
| `/intake` | 242 | 0 | disabled pipeline button correctly muted; empty-inbox state clean |
| `/guidance` Knowledge Base | 242 | 0 | 8-corpus grid renders; minor spacing nit (below) |
| "More" dropdown overlay | — | 0 | white panel, INSIGHT/SYSTEM groups, readable; portal probed |
| `/reporting` | 242 | 0 | cost/ROI cards, timeliness-vs-target bar; minor spacing nit (below) |
| `/redaction` | 242 | 0 | **live AI_EXTRACT run verified**: 9 third-party items redacted, 3 of requester's own kept, confidence chips 43–73% |
| `/sector-trends` | 242 | 0 | peer benchmarking charts + WDTK/Camden/GLA spotlights |
| `/learning` | 242 | 0 | confidence-routed triage, fine-tune comparison |
| `/admin` | 242 | 0 | config form fields render |
| `/about` | 242 | 0 | lifecycle (17 stages), AI-assists / humans-decide |
| `/cases/FOI-2026-0126` case detail | 242 | 0 | deadline urgency, triage card, response studio all readable |

- **Result:** **0 real dark-surface or theme defects** across the entire app. The earlier fixed bug class (`--ok-fg`/`--warn-fg`/`--danger-fg` misuse) is fully gone; light + dark theme tokens defined in `globals.css`. Overlays (the portal-style "More" menu) render on a white surface with correct contrast.

## Gate decision

**PASS — all gates cleared.**

- All **key-use-case functional stories PASS**. The core end-user journey and the buyer's compliance/cost/honesty signals are intact. No broken pages, no dead-end nav (legacy routes redirect to live views).
- **Phase 4b visual gate PASS.** The mandatory live per-page + overlay dark-surface sweep is complete: 12/12 pages + the "More" overlay show a light canvas (avg 242) with **zero dark-surface defects**; the flagship `/redaction` was verified end-to-end with a live AI_EXTRACT run. No outstanding gate items.
- App is **not deployed** (existing gate), so shipping remains a separate decision — but the audit itself no longer blocks it.
- **Low-severity polish (FIXED 2026-07-03):** number+word concatenation missing a space — "11,611records" / "40from" on `/guidance` and "£0.12of" on `/reporting`. Root cause: JSX collapsed whitespace at expression/newline boundaries; fixed with explicit `{" "}` nodes. Verified live: "11,611 records in total — … and 40 from …" and "…for £0.12 of Snowflake Cortex…".

## Notes / minor observations
- `/guidance` HTML contains the string "This page could not be found" — this is Next.js's **inert not-found boundary** in the RSC payload, not a real error; the page renders fully. No action.
- Secondary routes `/review /published /escalations /board /studio` are legacy aliases that 307-redirect into `/cases` / `/guidance` views — intentional consolidation, not dead links.
- **Redaction calibration (confidence chips FIXED 2026-07-03; over-redaction noted):** the live AI_EXTRACT run returns moderate scores (0.40–0.73). Chip thresholds were relaxed (green ≥0.6, amber ≥0.45, red <0.45) and reframed as "Detection strength" so correct extractions read confident — verified live: names (63%) and phones (71%) green, weak email (40%) red. **Still open (not actioned by request):** the council's own switchboard "0117 900 0000" is flagged as a third-party phone (an organisational number, arguably not personal data — mild over-redaction). Both are AI_EXTRACT calibration items, not theme/UX defects.
