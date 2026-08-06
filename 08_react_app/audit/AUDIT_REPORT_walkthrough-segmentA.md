# Audit Report — Segment A walkthrough surface (video re-audit)

**Date:** 2026-07-06 · **Harness:** http://localhost:3000 (light theme) · **Scope:** Command Centre, Cases, Knowledge Base ("up to intake") · **Spec:** `audit/playwright/walkthrough.audit.mjs`

Re-audit ahead of recording the automated FOI walkthrough (video Segment A). Read-only: no redaction run, no Confirm & release, no pipeline fire (those mutate state / meter cost and are verified separately in Phase 2).

## Result: GATE PASS (15/15)

| Story | Page | Result | Signal |
|---|---|---|---|
| US-EU-01 | `/` | PASS | KPI tiles render numbers (37 open / 17 at-risk / 6 overdue / 86%) |
| US-EU-08-peer (S-1 fix) | `/` | PASS | "Exampleton Council discloses information on 92% ... peer median of 73%, ranked 1 of 17" |
| US-EU-07a | `/` | PASS | Word cloud 31 terms, maxCount 9, no personal names, clickable |
| US-EU-07b | `/` | PASS | Click 'financial' → `/cases?view=list&keyword=financial` |
| US-EU-07c | `/` | PASS | "Showing cases mentioning" banner + filtered list |
| US-EU-02 | `/cases` | PASS | References + focus lanes (Quick wins/Needs review/Complex) |
| US-EU-03 | `/cases/FOI-2026-0115` | PASS | AI triage panel + Precedent card |
| US-EB-04 | `/cases/FOI-2026-0115` | PASS | AI evidence & audit trail + "Chain verified" |
| US-EB-05 | `/cases/FOI-2026-0115` | PASS | "AI cost of this response" card + cheaper contrast |
| US-EU-05 | `/guidance` | PASS | Evidence-base / corpus cards render |
| US-EU-05b | `/guidance` | PASS | Search 'personal data' → cross-authority precedent results |
| VIS-/ , VIS-/cases , VIS-/cases/[ref] , VIS-/guidance | all | PASS | Phase 4b dark-surface probe: 0 dark surfaces on the light canvas |

## Notes
- Two initial FAILs on the word cloud were a **test-only** case-sensitivity bug (tooltip reads "Click to see these cases"; regex was `/click.../`). App unaffected; regex made case-insensitive. No application changes required for Segment A.
- Screenshots: `audit/screenshots/walk-01-cc.png`, `walk-02-cases.png`, `walk-03-case-0115.png`, `walk-04-guidance.png`.
