# 08 — Cortex Search: what it does today, and how a council should use it

**Status:** Analysis + recommendation. **Owner:** Paddy Gardner.

## What it does today

**10 live services**, 9 of them queried in a single fan-out (`gatherGroundedSources`,
`lib/queries.ts:1097`) on every drafting action:

| Service | Corpus |
|---|---|
| `OWN_REPLY_SEARCH` | The council's own previous replies |
| `DISCLOSURE_SEARCH` | The council's own disclosure log |
| `INTERNAL_HOLDINGS_SEARCH` | The council's own spend/staffing facts |
| `COUNCIL_POLICY_SEARCH` | Policy and guidance documents |
| `FOI_LEGISLATION_SEARCH` | FOIA/EIR legislation |
| `CAMDEN_FOI_SEARCH` | ~11,400 Camden published responses |
| `GLA_DISCLOSURE_SEARCH` | GLA disclosure log |
| `WDTK_PRECEDENT_SEARCH` | WhatDoTheyKnow cross-authority threads |
| `BRENTWOOD_FOI_SEARCH` | Brentwood publication scheme |
| `SAR_SHAREPOINT_SEARCH` | SAR case-file documents from SharePoint |

Measured cost (60 days): **~1.285 credits total**, of which `CAMDEN_FOI_SEARCH` = **1.2735 (99%)** —
driven by embedding/serving the 11,400-document corpus, not by queries.

### Four problems with the current shape

1. **10 services = 10 fixed serving/storage floors.** Cortex Search bills for serving, storage and
   embedding refresh whether or not anyone queries. This should be **one index with a `SOURCE`
   filter attribute**: one floor, one query, filterable by corpus.
2. **The fan-out runs twice per pipeline, uncached** — `gatherGroundedSources` is called by both
   `suggestAnswer` and `generateGroundedLetter` with an identical query
   (`lib/queries.ts:1196`, `:1239`). Straight duplication.
3. **Reranker scores are computed then discarded.** `cortexSearch` filters on
   `@scores.reranker_score` and throws the number away (`lib/queries.ts:981`). So the officer is never
   shown retrieval confidence, results cannot be ranked by it, and per-corpus precision cannot be
   measured.
4. **Peer corpora are weighted equally with the council's own material** — wrong for s.21, where
   *only* the authority's own published material makes information "reasonably accessible" to the
   applicant.
5. **Two services bill for nothing** — `SAR_CORPUS_SEARCH` (orphan, superseded) and
   `WTDK_PRECEDENT_SEARCH` (a **misspelling** of WDTK; a duplicate index). Drop both.

## How a council should use it — highest value first

**1. Citizen-facing "check before you ask" deflection.** The single biggest win. Brentwood already
forces a disclosure-log search before the request form, but it is **keyword-only**, so any paraphrase
misses ("mobility permit for wheelchair users" never finds "Blue badge parking bays"). Semantic
search over the disclosure log, publication scheme and website turns "44 documents" into "here is
your answer, with a link". A deflected request never becomes a case at all — so the saving is
**avoided demand**, not faster handling, and deflection rate is a clean KPI.

**2. Publication-scheme gap analysis.** Run incoming requests against what is already published and
cluster the ones that *don't* match. Those clusters are precisely what should be published
proactively under s.19. This turns FOI from reactive to proactive: publish the top ten recurring
themes and those requests stop arriving. Nothing in the market does this well.

**3. Internal knowledge retrieval for officers.** Search policies, previous responses, committee
minutes and contract registers so the officer finds the holding team and the source document without
emailing three departments. This attacks the *retrieval* half of the s.12 cost problem — the part
that actually consumes officer hours.

**4. Element-level s.21 coverage matching.** Search is the substrate for
`04-partial-s21-percentage-match.md`.

**5. SAR document discovery.** Find every document mentioning a data subject across SharePoint and
network drives. This is the genuinely hard part of a Subject Access Request and the part most likely
to cause a breach if missed.

**6. Vexatious / campaign detection (s.14).** Semantic clustering of requests over time to spot
coordinated campaigns. Keyword matching cannot see this; the triage prompt already asks whether a
request is "part of a repeated campaign" with no data to ground the judgement.

**7. Cross-authority benchmarking.** What did comparable councils release, and was it later
overturned — grounding both the draft and the escalation-risk warning.

## Recommendation

Consolidate to **one index with a `SOURCE` attribute**; **retain and surface the reranker score**;
**weight the council's own material above peer material** (and restrict the s.21 path to own material
only); drop the two orphan services; memoise the retrieval per case; and expose a **citizen-facing
deflection endpoint** as the flagship council-value use case.
