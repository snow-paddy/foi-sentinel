# Persona Audit — FOI Sentinel v2 (React/SPCS)

- **Date:** 2026-07-10
- **Target:** Deployed app `FOI_SENTINEL_APP` (SPCS App Runtime) — `https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app`
- **Method:** Agentic-browser mode (CoCo `browser_*`). The deploy URL is SSO-gated and cannot be scripted with headless Playwright; the operator was logged in, so the audit drove the authenticated session directly.
- **Scope:** Post-deploy verification of this session's AI-SQL capability upgrade + s.21 duplicate-flag wiring, plus a full-app visual/theme sweep across all 11 nav surfaces.
- **Invoked as gate:** yes (pre-record / pre-demo).
- **Supersedes:** `AUDIT_REPORT.md` (2026-06-28) — that report covers the retired Streamlit app (`05_app`) and is retained for history only.

## Three persona lenses (established project context)

| Lens | Role | What a pass proves |
|------|------|--------------------|
| End-user | FOI/IG Officer working the daily queue | Triage signals, s.21 quick-win close, SAR redaction and audit trail work end-to-end with human-in-the-loop. |
| Economic buyer | Head of Information Governance / Monitoring Officer | Compliance posture, cost defensibility (s.12), data-honesty and "runs where the data lives" are visible and credible. |
| Champion | Snowflake SE demoing to the council | The AI-SQL story and the s.21 "already published" moment land, nothing looks broken or accidentally synthetic. |

## Results — changed surfaces (this session)

| Story | Lens | Key use case | Result | Signal asserted / evidence |
|-------|------|--------------|--------|----------------------------|
| US-S21-01 | End-user / Champion | s.21 duplicate auto-flag on case | PASS | `/cases/FOI-2026-0108` triage panel: "Possible s.21 duplicate of FOU-2024-0390" + s.21 legal-basis badge. |
| US-S21-02 | End-user / Champion | s.21 quick-win close | PASS | Cases → Focus: Quick wins (6); 0108 and 0109 carry "Already published (s.21)" badge with pre-drafted s.21 signposting replies (real figures + [S#] citation + s.17 review + ICO route). |
| US-AISQL-01 | Champion | AI_CLASSIFY / AI_FILTER / AI_EXTRACT live in triage | PASS | Intake → In-App Test → Analyse: FOI (AI_CLASSIFY), complexity 5.0, tone (SENTIMENT), depts Finance/Education/SEND, 8h, **SCOPE (AI_EXTRACT): "Period: last three financial years"**. |
| US-AISQL-02 | Champion | Under-the-hood copy names the functions | PASS | Intake step 2 lists SENTIMENT/AI_CLASSIFY/AI_FILTER/AI_EXTRACT/COMPLETE; step 3 code shows dual `AI_SIMILARITY` (board match + s.21 reuse ≥ 85%). |
| US-AISQL-03 | Buyer / Champion | corpus-wide theme summary | PASS | Sector Trends: "Corpus themes (AI_AGG)" card renders summary + "sample of 54 WhatDoTheyKnow titles with Cortex AI_AGG, computed in-database and cached". |
| US-CONTENT-01 | Buyer / Champion | 0115 reads like a real request | PASS | `/cases/FOI-2026-0115`: full GMB Union multi-part FOI (5 numbered asks); complexity factors (multi-part / wide date range / aggregation / sensitive) justify the s.40(2) partial. |
| US-KB-01 | Champion | KB explains s.21 detection | PASS | `/guidance`: "Disclosure logs … used as precedent and for s.21 duplicate detection" + AI_SIMILARITY auto-flag-at-85% paragraph. |
| US-ABOUT-01 | Buyer | architecture names the AI functions | PASS | `/about`: "AI assists" + "Snowflake features used" name AI_CLASSIFY, SENTIMENT, AI_FILTER, AI_EXTRACT, AI_SIMILARITY, AI_REDACT, COMPLETE, Cortex Search; Legal basis includes s.12 + Fees Regs 2004. |

## Results — full-app sweep (existing surfaces re-verified)

| Surface | Result | Notes |
|---------|--------|-------|
| Command Centre `/` | PASS | 35 open / 86% gauge / peer rank 1/17; 5-step statutory rollup; requester-patterns table with data-honest s.14 framing ("a prompt for officer judgement, not an automatic refusal") + anonymisation note. |
| Cases — Focus | PASS | Quick wins / Needs review / Complex buckets; provenance chips + citations. |
| Cases — Board | PASS | 5-lane Receipt→Triage→Retrieval→Review→Sign-off; s.50 challenge note; FOI-2026-0090 correctly back in Retrieval (board-drag reset held). |
| Cases — List | PASS | RAG / complexity / sentiment / match columns; "requester identities not shown". |
| Cases — Reviews & ICO | PASS | s.45 → s.50 → s.19 redress route; internal-review card with Uphold/Partially/Overturn. |
| Reporting & Cost | PASS | s.12 £450/18h basis stated; £240 avg benchmarked to Frontier Economics £150–£300; "£0.12 Cortex per request" honest cost model. |
| Sector Trends | PASS | AI_AGG card (above) + peer disclosure ranking. |
| SAR (list + detail) | PASS | Art 15 framing; "No s.12 cost limit applies" (correct); Cortex Search across 5 systems; AI_CLASSIFY third-party scan; source PDF is synthetic-labelled. |
| Tuning & Learning | PASS | Confidence routing (13%/87%), fine-tune base 63% → TRIAGE_TUNED 100%, LLM-judge 82% groundedness / 85% coverage. |
| Admin | PASS | s.12 cost limit (£450/18h/£25) editable; deadlines, targets, auto-accept 0.90; departments list. |

## Visual / Theme audit (Phase 4b — full sweep)

- **Theme:** app renders in **light** theme on every page (matches the standing demo rule). Header, cards, tables, gauges, RAG/priority/sentiment badges all on-brand with adequate contrast.
- **Overlays opened & re-probed:** nav "More" dropdown, Intake "under the hood" accordions, Cases Focus/List/Board/Reviews tabs, guidance filter chips — all light, no dark surfaces.
- **One dark UI encountered (NOT a defect):** the SAR source-document viewer toolbar in section 3 is the **browser's native PDF viewer chrome**, not app-themed content. Expected and out of app control.
- **No** dark widget surfaces on the light canvas, iframe background leak, contrast failures, or clipped/broken layouts found.

## Persona coverage matrix

| Use case \ Lens | End-user | Economic buyer | Champion |
|-----------------|----------|----------------|----------|
| s.21 auto-flag + quick-win close | PASS | — | PASS |
| Live AI-SQL triage (classify/filter/extract) | PASS | — | PASS |
| Corpus theme summary (AI_AGG) | — | PASS | PASS |
| Realistic request content (0115) | PASS | PASS | PASS |
| Cost defensibility (s.12) | — | PASS | — |
| SAR redaction + audit trail | PASS | PASS | — |
| Command Centre SLA + data-honesty | — | PASS | PASS |

## Advisory (non-blocking)

- **Cosmetic spacing** in `/guidance` limitations note rendered "WhatDoTheyKnow spans 16councils" (space swallowed on the deployed build). Fixed in source (`app/guidance/page.tsx` line 93 now uses a non-breaking space) — **will clear on the next deploy**; not redeployed solo per the batch-deploy rule.

## Gate decision

**PASS — cleared to record / demo.**

- Every key-use-case story is PASS.
- Every page passed the Phase 4b visual/theme sweep.
- No functional or visual FAIL. One cosmetic advisory (the "16councils" spacing) does not block.
