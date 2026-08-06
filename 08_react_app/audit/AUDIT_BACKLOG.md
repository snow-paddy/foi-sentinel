# FOI Sentinel v2 — AI / Architecture Audit Backlog

Design-review items from the 2026-07-03 persona/architecture review. Each is a discrete
work item to pick up on its own. Grounded in `lib/queries.ts`. Distinct from the product
`BACKLOG.md` (features) — this backlog is about *how the AI/data back-end works*.

Order = the review's numbering. Status: TODO / IN PROGRESS / DONE.

---

## A1 — Backend-demo notebook + per-task model comparison — DONE (2026-07-03)
**Intent:** A client-facing notebook that shows the "back end" of the app end-to-end
(triage → retrieval → grounded draft → SAR redaction → cost/audit), AND doubles as the
evidence for **which Cortex model is best per task per brief**.
**Current state:** Everything runs inside the Next.js server (`lib/queries.ts`); there is
no standalone artefact a client can watch. Triage + drafting both use `mistral-large2`;
no model comparison has been done.
**Target:**
- A Snowflake Notebook (Python/SQL) that runs each pipeline stage on a sample request and
  prints inputs/outputs, so the mechanics are visible in a demo.
- A **model bake-off** per task: classification (regime/priority), complexity, drafting,
  redaction/extraction — compare candidates (e.g. `mistral-large2`, `llama3.1-70b/8b`,
  `claude-*`, `snowflake-arctic`) on accuracy, latency, and cost/1k tokens against a small
  labelled sample; recommend a model per task.
**Approach:** Use the `snowflake-notebooks` skill; pull a handful of real cases; call each
Cortex function; tabulate results + `CORTEX.COUNT_TOKENS` for cost. Data-honest (synthetic labelled set).
**Demo value:** HIGH — this is the "show me how it works" artefact for clients.
**Effort:** M.

## A2 — Complexity as a calibrated feature model (not an LLM opinion) — TODO
**Intent:** Make the 1–10 complexity score reproducible, explainable, and improvable.
**Current state:** `triageEmail` (queries.ts:1950) — complexity is free-text output from
`CORTEX.COMPLETE('mistral-large2')`. No features, no calibration, `confidence: null`.
**Target:** A transparent feature-based score (blend with the LLM signal), calibrated
against real closed-case handling time / outcomes.
**Approach:**
1. Define explicit drivers already available: # info items, # departments, needs-data-pull
   vs published, estimated hours, regime, vexatious.
2. Log predicted vs **actual** (hours/outcome) per closed case.
3. Fit a lightweight regressor (Snowflake ML + Model Registry) on own history; keep LLM as one input.
**Demo value:** MED (defensibility story). **Effort:** M–L.

## A3 — Sustainable precedent + retrieval compute — TODO
**Intent:** Keep retrieval cheap and fresh as volume grows.
**Current state:** `suggestAnswer` (queries.ts:883) fans out to **6 Cortex Search services**
via `SEARCH_PREVIEW`; precedent is pre-computed into `FOI_PRECEDENT_MATCH` (good); answers
cached in `FOI_SUGGESTED_ANSWER` (good).
**Target:** Fewer indexes, incremental refresh, same recall.
**Approach:**
- Consolidate the 6 search services into **one multi-source index** with a `SOURCE`
  attribute + use Search `filter` (helper already supports it) to scope per query.
- Drive `FOI_PRECEDENT_MATCH` incrementally (Stream+Task on new clean closures) rather than batch re-embed.
- Keep/extend answer precompute caching.
**Demo value:** LOW (cost/ops). **Effort:** M.

## A4 — SAR redaction across all three data shapes + governance — DONE (2026-07-03, see audit/scope-sar.md)
**Delivered (Approach B):** new `/sar` page + `getSarData()`; multi-source synthetic corpus (SharePoint/Exchange/FileShare/SocialCare) + structured LOB table; **conditional masking policy** (third-party PII masked at data layer, verified even for ACCOUNTADMIN) + `V_SAR_DISCLOSURE` bundle + `AI_CLASSIFY` third-party tagging; **federated Cortex Search** (`SAR_CORPUS_SEARCH`) across all sources; SAR legal framing (1-month clock, third-party *balancing* test, supplementary info) + "why Snowflake" panel; **per-SAR measured cost** via A5 (`stage='sar'`, verified £0.0038). Follow-on: real Openflow SharePoint connect checklist at `audit/sharepoint-connect-checklist.md` (needs enterprise MS tenant).

## A5 — Rolling actual cost + learning-from-actions loop — DONE (2026-07-03)
**Intent:** Replace the modelled cost with a *measured* one, and turn the audit trail into a feedback dataset.
**Current state:** `AUTOMATION_COST` (queries.ts:2410) is a **static constant** (£0.12/FOI).
Feedback signals exist but aren't used: `markPrecedent` sets `USED=TRUE` + logs an event;
`FOI_CASE_EVENT` records AI-vs-HUMAN decisions.
**Target:** Live per-FOI cost trending; a closed feedback loop.
**Approach:**
- Cost: set a `QUERY_TAG` per case; join `ACCOUNT_USAGE.CORTEX_FUNCTIONS_USAGE_HISTORY` +
  Cortex Search serving usage + `WAREHOUSE_METERING_HISTORY` to get measured £/FOI in Reporting.
- Learning: capture officer **edit-distance** on drafted answers as a quality signal; use `USED`
  precedents as positive pairs to re-rank retrieval; feed outcomes into A2 calibration.
**Demo value:** HIGH (makes the buyer £ story real). **Effort:** M.

## A6 — Auditability hardening — TODO
**Intent:** Make every AI output defensible at an ICO review months later.
**Current state (solid base):** `FOI_CASE_EVENT` (actor AI/HUMAN + model + note + ts);
`FOI_TRIAGE` (`TRIAGE_JSON`/`REASONING_JSON`/`MODEL`/`COMPUTED_AT`); answers carry tagged sources + `grounded`.
**Gaps → Target:**
- Capture the **exact prompt, model version, raw response** (or hash) per AI decision.
- Capture **tokens/cost** per decision (ties to A5).
- Real **confidence** signal (e.g. `AI_CLASSIFY` scores) instead of `confidence: null`.
- Append-only + periodic hash for a tamper-evident trail.
**Demo value:** MED (governance/defensibility). **Effort:** M.

---

### Suggested sequencing (by demo value)
A1 (backend notebook + model bake-off) → A5 (real cost) → A4 (SAR across estate) → A6 (audit) → A2 (complexity) → A3 (retrieval ops).
