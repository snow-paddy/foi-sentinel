# FOI Sentinel — xo Persona Audit (pre-deploy, phase-1 re-record plan)

Date: 2026-07-09
Harness: `http://localhost:3001` (next dev, connection PG-SNOWFLAKE, live Snowflake data)
Scope: validate the planned demo approach before deploy — (a) cost-card removal, (b) phase-1 nav path cases → SAR/EIR/FOI filters → Needs review lane → FOI-2026-0115.

## Personas (three lenses, role-anchored)

- **End-user — FOI Officer, Exampleton Council.** Problem: siloed records + a 20-working-day statutory clock; must find every record, apply exemptions defensibly, respond on time. Success: the queue shows what needs attention and gives a trustworthy, grounded draft.
- **Economic buyer — Head of Information Governance / SIRO.** Problem: ICO exposure, cost of manual FOI handling, defensibility. Success: compliance posture + AI cost-effectiveness are visible and credible; no data leaks in the UI.
- **Champion — IG lead demoing to the SIRO / cabinet.** Problem: needs the story to land in one flow. Success: narrative flows, nothing looks broken or off-brand.

## User stories & results

| ID | Persona | Story (key use case) | Signal asserted | Result |
|----|---------|----------------------|-----------------|--------|
| US-ENDUSER-01 | Officer | Filter the queue by regime to show SAR/EIR/FOI | FOI/EIR/SAR filter chips present & routable (`?regime=`) | PASS |
| US-ENDUSER-02 | Officer | Focus view → Needs review lane → open FOI-2026-0115 | 0115 (Cx 6) listed in Needs review; detail page renders | PASS |
| US-BUYER-01 | Buyer | s.12 Cost estimate card removed from case view | No "Cost estimate" card, no Appropriate limit / Officer hours / Recalculate | PASS |
| US-BUYER-02 | Buyer | No stray cost figures leak elsewhere in the case view | "Cost estimate: 5.5h / GBP 137.5" still shown in **Case history** timeline | ADVISORY FAIL |
| US-CHAMPION-01 | Champion | Case detail renders clean, on-brand, no broken layout | AI cost card + Exemptions flow with no gap; light theme; 0 console errors | PASS |

## Visual / theme sweep (Phase 4b)

- Light theme pinned; dark-surface probe on `/cases` and `/cases/FOI-2026-0115`: **0 dark surfaces**.
- Case detail: no layout hole where the cost card was removed (AI audit trail → AI cost card → Exemptions).
- Console: **no errors** after removal. Typecheck (`tsc --noEmit`): clean.

## Findings

1. **PASS — cost-card removal is clean and safe to ship.** The s.12 statutory Cost estimate card is gone; the AI cost card (kept by design) still renders and the "cheaper than £137.5 manual estimate for this case" comparison reads correctly (copy fixed from the dangling "above").
2. **ADVISORY — cost figure leaks in Case history.** A DECISION timeline event renders `Cost estimate: 5.5h / GBP 137.5 (exceeds=false)`. The dedicated card is removed but this history line still surfaces the figure. Source: `getCaseTimeline` (FOI_TIMELINE). **WAIVED (operator, 2026-07-09):** keep the append-only audit record as-is.
3. **ADVISORY (unrelated to plan) — lane vs badge rounding.** FOI-2026-0113 has raw COMPLEXITY_RANK **6.5**; the badge `score.toFixed(0)` (complexity-chip.tsx:28) rounds it to "Cx 7", while the lane test `complexity >= 7` (focus-deck.tsx:31) uses the raw 6.5, correctly keeping it in Needs review. Not a data bug — a display/threshold rounding mismatch affecting any x.5 case. Demo case 0115 (rank 6) is unaffected. **WAIVED (operator, 2026-07-09):** leave as-is to avoid creating discrepancy between records; keep behaviour consistent.

## Gate decision

**PASS (deployable)** for the planned change. No key-use-case functional failure and no visual/theme failure. Both advisory items reviewed and **WAIVED by the operator** (2026-07-09) — safe to deploy the cost-card removal.

## Validated phase-1 re-record path

cases homepage → click FOI / EIR / SAR filter chips (showcase regimes) → Focus view → **Needs review** lane → open **FOI-2026-0115** "Staff Grievances and Outcomes Last Three Years" (Cx 6, medium). Confirmed working against live data.

---

# Follow-up run — strengthen Complex lane, drivers, and card edits

Date: 2026-07-10
Harness: `http://localhost:3001` (next dev, connection PG-SNOWFLAKE, live Snowflake data)
Scope: verify the changes from `strengthen-complex-lane-and-drivers.plan.md` plus the AI-cost-card and exemptions-card edits, ahead of recording Beat 2.

## User stories & results

| ID | Persona | Story (key use case) | Signal asserted | Result |
|----|---------|----------------------|-----------------|--------|
| US-CHAMPION-02 | Champion | Complex lane explains *why* each case is complex | Header states the four criteria; cards show driver chips (vexatious / Cx N / public-interest test / multiple exemptions) + AI factor chips | PASS |
| US-BUYER-03 | Buyer | Complex criteria are defensible, not a bare score threshold | `isComplex` = vexatious OR Cx>=7 OR PIT engaged OR >=2 exemptions; 0123 & 0119 surface "Engages a public-interest test" | PASS |
| US-ENDUSER-03 | Officer | Quick wins lead with the fastest wins | s.21 cases (0108, 0109) sorted first; 6 cards, 2 s.21 badges | PASS |
| US-ENDUSER-04 | Officer | 0115 case view is clean after edits | "Exemptions considered" card gone; "Why this is a partial disclosure" + What we release / withhold intact; Chain verified; triage present | PASS |
| US-BUYER-04 | Buyer | AI cost card is honest and uncluttered | No "cheaper than £137.5" line; metered note moved to an ⓘ tooltip beside the title; £0.1149 / 9 calls / 25,615 tokens render | PASS |

## Findings

1. **PASS — Complex lane is now self-explaining.** Driver chips render per card and the header lists the four criteria. Lane counts unchanged (Complex 11 / Needs review 20 / Quick wins 6), confirming the strengthened criteria moved no cases — demo-safe.
2. **PASS — Quick wins s.21-first ordering** verified (0108, 0109 lead), with the "Already published (s.21)" badge on both.
3. **PASS — 0115 card edits** verified in the live DOM: exemptions card removed, cheaper-line removed, ⓘ tooltip present, decision panel and audit trail intact.
4. **RESOLVED (infra) — case-detail route was down** with a Snowflake `terminated connection` error across all `/cases/[ref]` pages (stale idle connection on the dev server, not a code regression — `/cases` was unaffected and 0115 had returned 200 earlier). Fixed by a clean dev-server restart (operator-approved, 2026-07-10). Route restored, 200 on 0115 and 0119.

## Gate decision

**PASS (deployed)** for all four batched changes: Complex-lane strengthening + drivers, Quick wins s.21-first order, exemptions-card removal, AI-cost-card tweak. No functional or theme failure. **Deployed 2026-07-10** to `FOI_SENTINEL_APP` (App Runtime) via `snow app deploy --connection PG-SNOWFLAKE`; service Status: ready at `https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app`.

## FAQ battlecard coverage

Recent tough questions now answered in `demo_video/FAQ_BATTLECARD.md`: Q10 lane taxonomy (Quick wins / Needs review / Complex), Q11 "At risk" (RAG / deadline), Q12 what-we-withhold and why a case is a partial. Copy verified: 0 em dashes, 0 semicolons, no "not X but Y".
