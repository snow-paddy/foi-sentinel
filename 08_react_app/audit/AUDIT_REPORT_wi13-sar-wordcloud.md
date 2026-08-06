# Audit Report — WI-13: SAR/Redaction integration + word-cloud de-skew & drill-down

**Date:** 2026-07-06
**Scope:** the new features shipped this batch (pre-deploy gate). Re-audit against `personas.md` / `user_stories.md`.
**Harness:** `http://localhost:3100` (local dev, conn PG-SNOWFLAKE). NOT the SSO deploy URL.
**Method:** Playwright (chromium 1.61.1, fresh context per page — cache-free) — `audit/playwright/new-features.audit.mjs`. Screenshots in `audit/screenshots/`.

## Gate decision: **PASS** (10/10 key checks)

| Story | Use case | Result | Evidence |
|---|---|---|---|
| US-EU-01 [KEY] | UC1 Command Centre KPIs | PASS | KPI tiles render numeric values |
| US-EU-07a [KEY] | UC1 word cloud honesty | PASS | 32 terms, **maxCount=8** (true counts), **no personal names**, clickable |
| US-EU-07b [KEY] | UC1 drill-down nav | PASS | click "down" → `/cases?view=list&keyword=down` |
| US-EU-07c [KEY] | UC1 drill-down list | PASS | "Showing cases mentioning" banner + **10 requests** (all statuses) |
| US-EU-06a [KEY] | UC5 studio embedded | PASS | `/sar` §3 embeds studio; no "Open the Redaction Studio" link-out |
| US-EU-06b [KEY] | UC5 released doc | PASS | `[… REDACTED]` blackouts; released panel **maxH=640px** (was 288) |
| US-EU-06c [KEY] | UC5 confirm & release | PASS | "decisions saved" chip; persisted 8 REDACT + 1 KEEP to SAR_REDACTION_DECISION |
| US-CH-03 | narrative / no dupe page | PASS | `/redaction` → redirects to `/sar`; nav entry removed |
| VIS-/ [KEY] | visual/theme sweep | PASS | 0 unexpected dark surfaces on `/` |
| VIS-/sar [KEY] | visual/theme sweep | PASS | 0 unexpected dark surfaces on `/sar` (redaction blackout chips correctly excluded) |

## Persona coverage matrix
| Lens | Use case | Result |
|---|---|---|
| End-user (FOI/SAR Officer) | UC1 workload + explore themes | PASS |
| End-user | UC5 SAR selective redaction (integrated) | PASS |
| Champion | one SAR flow, no dead ends, visual integrity | PASS |
| Economic buyer | (unchanged this batch — reporting/cost not touched) | n/a |

## Defect found & fixed during the audit (gate value)
- **Word-cloud counts were ×100 (font-weight clobber).** d3-cloud reuses the datum's `weight` property for **font-weight** (600/700/800) during layout, overwriting our mention count. The `<title>` read `w.weight` post-layout → showed "down: **800** mentions" instead of 8. This only manifests **after client-side d3 runs** — `curl`/`fetch` of the server payload showed the correct 8, which initially masked it as a browser-cache artifact. A clean Playwright context reproduced it, confirming a real bug. **Fix:** carry the true count as a separate `count` property on the placed datum and render `w.count`. Re-audit: maxCount=8. (`components/command-centre/word-cloud.tsx`)

## Visual/theme (Phase 4b)
- `/` and `/sar` swept post-interaction: 0 unexpected dark-on-light surfaces. The redaction blackout chips (`rgb(17,17,17)`) are intentional and excluded from the probe.
- Not re-swept this batch (unchanged): /cases table chrome, /reporting, /guidance — covered by prior audits.

## Notes / residual
- Drill-down uses substring `ILIKE` so a term's case count (e.g. "down" → 10 cases) can exceed the whole-word cloud count (8) — acceptable ("cases mentioning X").
- Longer-term architecture backlog (AUDIT_BACKLOG A2/A3/A6) is out of scope for this gate.

**Gate: PASS — clear to proceed to the single operator-gated redeploy.**
