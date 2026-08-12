# 06 — AI cost: replacing the modelled figure with measured spend

**Status:** Analysis + recommendation. **Owner:** Paddy Gardner.

## The problem with the current cost story

`AUTOMATION_COST` (`lib/queries.ts:3156`) is a **hardcoded constant**:

```ts
llmGbp: 0.08, searchGbp: 0.02, computeGbp: 0.02, perFoiGbp: 0.12, reviewFraction: 0.2
```

Three things will not survive procurement scrutiny:

1. **£0.12 per FOI is a literal, not a measurement.** The comment claims alignment with "measured
   ~£0.075/request", but that reconciliation exists only as a comment.
2. **The ~80% saving headline is arithmetically forced.** Because £0.12 is negligible against a
   ~£239 manual baseline, `pctReduction ≈ 100 − 20 = 80%` **for any input**. It is a restatement of
   `reviewFraction: 0.2`, not a finding. `reviewFraction` has no empirical basis in the codebase.
3. **The manual baseline is the LLM's own guess.** `getCostOfProcessing()` computes
   `AVG(TRIAGE_JSON:estimated_hours) × rate`, where `estimated_hours` is **LLM-estimated at triage**
   and the rate defaults to £25/hr from config. The UI does label it honestly ("A modelled estimate,
   not invoiced cost"), but the chain is model → model → headline.

The team's own backlog already concedes this (`audit/AUDIT_BACKLOG.md:61`).

Note also the app has a genuine metering pipeline (`FOI_AI_USAGE`, `logAiUsage`) where **tokens and
latency are measured** and only the GBP conversion is estimated. That is the right foundation — it is
just not what the headline card uses.

## Measured ground truth (this account, 60 days)

`SNOWFLAKE.ACCOUNT_USAGE.METERING_HISTORY` by service type:

| Service type | Credits (60d) |
|---|---|
| SNOWFLAKE_COCO_DESKTOP | 2,888.4 |
| CORTEX_CODE_DESKTOP | 1,514.9 |
| WAREHOUSE_METERING (all warehouses) | 1,154.1 |
| SNOWPARK_CONTAINER_SERVICES | 725.7 |
| OPENFLOW_COMPUTE_SNOWFLAKE | 162.8 |
| SERVERLESS_TASK | 65.8 |
| SNOWFLAKE_APP_RUNTIME | 24.8 |
| POSTGRES_COMPUTE | 22.2 |
| **AI_FUNCTIONS** | **13.28** |
| **AI_SERVICES** | **4.37** |
| **CORTEX_SEARCH** | **1.22** |
| AI_INFERENCE | 0.00 |

FOI-specific:
- `FOI_WH` warehouse = **50.92 credits** / 60 days.
- FOI Cortex Search services ≈ **1.285 credits** / 60 days, of which **`CAMDEN_FOI_SEARCH` = 1.2735
  (99%)** — the 11,400-document corpus dominates, via embedding/serving rather than queries.

## The defensible claim

**AI inference is not the cost. Compute and hosting are.**

### Attribution correction (2026-08-04)

The 725.7 SPCS credits are **not** FOI Sentinel. Per-pool over the same 60 days:

| Compute pool | Credits | Whose |
|---|---|---|
| OPENROUTESERVICE_APP_COMPUTE_POOL | 184.96 | Fleet app (`min_nodes 5` on HIGHMEM_X64_S) |
| MCP_GEO_POOL | 149.52 | MCP geo service |
| ORS_POOL_SANFRANCISCO | 87.98 | Fleet app |
| CMA_COMPUTE_POOL | 81.56 | CMA R Shiny |
| HMLR_HITL_POOL | 79.31 | HMLR demo |
| ORS_POOL_WESTYORKSHIRE | 47.17 | Fleet app (MEM_X64_G2_192) |
| **FOI_SENTINEL_POOL** | **31.53** | **FOI (old Streamlit; pool since deleted)** |
| SYSTEM_COMPUTE_POOL_CPU | 30.32 | Notebooks / builds |
| NR_LISTENER_POOL | 20.29 | Always-on STOMP listener |
| DELAY_RELAY_POOL | 9.83 | Delay Relay |
| **APP_SERVICE_1299699_COMPUTE_POOL** | **3.24** | **FOI React App Runtime** |

**FOI's share of SPCS ≈ 34.8 credits — about 5% of the 725.** The three OpenRouteService fleet pools
alone are ~320 credits (44%).

**Autosuspend is enabled on every pool** (100–600s) and all are currently SUSPENDED except
`HMLR_HITL_POOL` (ACTIVE, 120s). So this was never an autosuspend failure — the driver is
**oversized pools**: `OPENROUTESERVICE_APP_COMPUTE_POOL` pins `min_nodes 5` on HIGHMEM_X64_S (it
cannot scale below 5 nodes), and `ORS_POOL_WESTYORKSHIRE` sits on a very large instance family.

**Actions:** drop the ORS fleet pools if the fleet demo is not needed (~320 credits/60d recovered);
tighten `MCP_GEO_POOL` autosuspend from 300s to 60–120s; review whether `NR_LISTENER_POOL` really
needs to be always-on.

### The ratios that still hold

- All AI functions + AI services + Cortex Search across **every demo on this account** =
  **~18.9 credits in 60 days**.
- The FOI app's own warehouse alone (**50.9**) is ~**2.7×** all AI on the account, and ~**1.5×** all
  FOI hosting.
- Developer tooling (IDE and CLI) compute (**4,403**) is ~**230×** the app's AI inference.
- **FOI end-to-end** ≈ warehouse 50.9 + hosting ~35 + search ~1.3 + tokens ≈ **under 90 credits per
  60 days** for everything.

That is a far stronger position than a modelled pence-per-request, because it is measured and it is
structurally true: **the meaningful costs are the always-on container and the warehouse, both of
which you control directly via sizing and auto-suspend.** The AI is the cheapest component by two
orders of magnitude.

## The model has the wrong shape

Cortex Search bills for **serving, storage and embedding refresh whether or not anyone queries it** —
a fixed monthly floor **per service**, not a per-request pence figure. The current model buries all
of it in one blended `searchGbp: 0.02` per request.

There are **10 live FOI search services**, and two are pure waste:

- **`SAR_CORPUS_SEARCH`** — orphan, superseded by `SAR_SHAREPOINT_SEARCH`, still billing.
- **`WTDK_PRECEDENT_SEARCH`** — a **misspelling** of `WDTK_PRECEDENT_SEARCH`; a duplicate index
  billing separately with the same 2,838 tokens.

Drop both.

## Recommended model — three tiers

1. **Fixed monthly floor** (measured): Cortex Search serving + storage across retained services,
   plus SPCS compute pool. Reduce by consolidating the 10 services into one index with a `SOURCE`
   filter attribute, and by auto-suspending the pool.
2. **Per-case variable** (measured): tokens for triage + suggested answer + grounded letter, plus
   warehouse seconds, attributed by `QUERY_TAG` per case joined to `ACCOUNT_USAGE`.
3. **Per-action optional** (measured, page-based): SAR redaction. `AI_EXTRACT` with `arctic-extract`
   measured at **2.99 credits for 14 calls (~0.21 credits/document)** — the single most expensive AI
   operation in the estate, and it bills **per page, not per token**.

## Metering gaps to close before showing a customer

- **8 of ~14 LLM call sites bypass `logAiUsage`** — including the **LLM-judge that doubles the cost
  of every precomputed answer**, plus `benchmarkAgainstPeers`, `editDraftWithAI`, `searchPublished`,
  `detectSarPii`, `recordReviewOutcome`.
- **`triageEmail` logs `caseRef = null`** → `getCaseAiCost()` **systematically understates every case
  by the whole triage stage**.
- **`AI_PARSE_DOCUMENT` / `AI_EXTRACT` are costed with the Mistral tokeniser** though they bill per
  page — the SAR figure is not just imprecise, it is the wrong unit.
- **`AI_MODEL_RATE_CARD._DEFAULT`** silently prices unknown models rather than erroring.
- Ground truth should be `QUERY_TAG` → `ACCOUNT_USAGE`, as the backlog already specifies.

## Efficiency wins that also improve the cost story

- **`runIntakePipeline` is ~20 Cortex Search queries and 5–6 LLM completions for a single click**,
  and `gatherGroundedSources` runs **twice with an identical query and no caching**
  (`lib/queries.ts:1196`, `:1239`). Memoising it roughly halves the retrieval fan-out.
- **The SAR PDF is parsed twice** — `AI_PARSE_DOCUMENT` for display text and `AI_EXTRACT(file => …)`
  which parses it again internally (warm run ~58s). The cheap `text =>` variant was **correctly
  rejected** because it leaked a third-party postcode (s.40 risk) — so keep the file variant but
  **cache the parse** instead of re-parsing on every click.
- Prompt stuffing: up to ~25 retrieved snippets per completion. Retrieval breadth, not generation, is
  the token driver.

## How to present it

Lead with the measured service-type table and the ratio ("hosting costs ~38× the AI"). Then show
per-case token cost from real usage, clearly labelled *credits* with the conversion stated as list
rate to be confirmed against contract. Retire the £0.12 constant from the headline, or relabel it
explicitly as an illustrative model — and defend `reviewFraction` with `AI_DRAFT_FEEDBACK.EDIT_RATIO`
evidence rather than assertion.
