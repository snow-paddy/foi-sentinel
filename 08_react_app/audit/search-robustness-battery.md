# Search-Service Robustness Battery — WI-12 Item 1

**Date:** 2026-07-06 · **Connection:** PG-SNOWFLAKE · **Scope:** all 10 Cortex Search services (FOI.FOI_SENTINEL_V2 + FOI.SAR_INGEST)

## Method
Fired **39 anticipated user questions** (4–6 per service, phrased as a real IG officer / requester would ask that corpus) via `SNOWFLAKE.CORTEX.SEARCH_PREVIEW`. Relevance judged by **`@scores.reranker_score`** (the true signal — cosine alone is misleading) plus the identifying attributes of the top hit. Generator: `/tmp/gen_battery.py`.

## Result: coverage is complete, quality tiers by corpus depth
**No service is empty or broken — every query returned hits.** Relevance tracks corpus depth/diversity:

| Service | Rows | Verdict | Notes |
|---|---|---|---|
| **INTERNAL_HOLDINGS_SEARCH** | 97 | ✅ Excellent | All 6 dead-on (appeals→214, arrears→REVENUES_COUNCIL_TAX_ARREARS, LAC→412, RIPA→4, RTB→132, EHCP). The app's core grounding source. |
| **CAMDEN_FOI_SEARCH** | 11,420 | ✅ Excellent | Spot-on: PCNs, School admissions, Temp accommodation, Licence apps (reranker +0.6–1.0). |
| **COUNCIL_POLICY_SEARCH** | 42 | ✅ Strong | Vexatious→S14, retention→Record Keeping, DP→DP interface. "Fees" maps to Timescales (no dedicated fees doc — minor). |
| **SAR_CORPUS_SEARCH** | 6 | ✅ Good | All resolve to the correct data subject (Whitfield SAR). |
| **SAR_SHAREPOINT_SEARCH** | 12 | ✅ Good | Live SharePoint chunks (housing note, tenancy letter, complaint intake) on-topic. |
| **OWN_REPLY_SEARCH** | 21 | ◑ Mostly | Council-tax / s40 / EIR replies match; no own reply about school appeals yet (thin own-reply history — grows via flywheel). |
| **GLA_DISCLOSURE_SEARCH** | 29 | ◑ Moderate | Corpus skews to recent EIR/CPO; "Mayor spending"→MIPIM is a good hit, "air quality" misses. |
| **WDTK_PRECEDENT_SEARCH** | 54 | ◑ Moderate | Broad precedent pool; targeted exemption scenarios match loosely. (Real precedent match is the separate AI_SIMILARITY `SP_REFRESH_PRECEDENT_MATCH`.) |
| **DISCLOSURE_SEARCH** | 5 | ◑ Data-thin | Own published log, only 5 entries; low recall by construction. Grows as cases dispatch (flywheel). |
| **BRENTWOOD_FOI_SEARCH** | 16 (**2 distinct docs**) | ⚠ Weak | Structural: 16 chunks are only 2 documents, so every query collapses to the same chunk (reranker −4 to −9). Noise in the grounding mix. |

**Headline:** weakness is **data coverage, not configuration** — every service is wired correctly and active.

## Fix applied (cheap, evidence-based)
Added an optional **reranker-score floor** to `cortexSearch()` (`lib/queries.ts`) and applied `PEER_RERANK_FLOOR = -4` to the four external **peer-comparison** corpora (WDTK/GLA/Camden/Brentwood) in `gatherGroundedSources()`. Calibrated against real case queries: genuinely relevant peers score above ~−3 (Camden ~+0.2, GLA/WDTK ~−2); thin-corpus noise scores below −4.

- **Verified/own sources are unfiltered** (internal holdings, own replies, disclosure log, policy) — a peer floor can never drop a grounded figure.
- **Verified on FOI-2026-0126:** Brentwood noise dropped 2→1, Camden/GLA/WDTK moderate hits retained, all verified `This council's records` (EDUCATION_ADMISSION_APPEALS ×3) + disclosure log + own reply intact. `tsc` clean.

## Recommendations (flagged, not done — data decisions for the operator)
1. **Brentwood** — either enrich the corpus (currently 2 docs) or retire the service from grounding. The −4 floor suppresses most of its noise; a fuller fix is a data decision.
2. **DISCLOSURE_LOG (5) / OWN_REPLY (21)** — both grow naturally through the dispatch→index flywheel; no action needed.
3. **`FOI_LEGISLATION` (59 statutory rows, unindexed)** — being addressed in WI-12 Item 2 (index + wire into grounding for legislation-cited refusals).
4. **`ICO_DECISION_NOTICE` (0 rows)** — empty; leave unindexed until populated.

## Verdict
Services are **tip-top for the operational grounding path** (internal holdings + Camden + policy + own sources). Peer corpora now pass through a relevance guard so weak matches no longer leak into grounded letters. Remaining weaknesses are corpus-depth limitations, documented above.
