# 04 — Partial s.21 with percentage match

**Status:** Designed, not built. **Owner:** Paddy Gardner.

## What exists today

Two **separate, unconnected** s.21 mechanisms:

**1. Case-level auto-flag** — `01_ddl/10_s21_duplicate_check.sql`
- `SP_FLAG_S21_REUSE` computes `AI_SIMILARITY(request_text, candidate.REQUEST_TEXT)` against
  `V_S21_CORPUS` (own-authority only: `FOI_SYNTH_PRECEDENT` + `FOI_DISCLOSURE_PUBLICATION` +
  closed granted `FOI_CASE`).
- Threshold `COUNCIL_CONFIG.S21_SIMILARITY_THRESHOLD` = **0.85**. Takes `MAX(SIM)` / `LIMIT 1`.
- Writes **only** `FOI_TRIAGE.S21_MATCH_REF`. **The score is discarded** — it survives solely as
  prose in a `FOI_CASE_EVENT` note ("matches X at 87%").
- Gated to FOI regime and triage stages. Officer can only accept or ignore.

**2. Public self-service deflection** — `app/api/published/route.ts` → `searchPublished`
(`lib/queries.ts:1532`). Cortex Search + `COMPLETE`, no threshold, no score, no case record, no
reranker floor. Entirely disconnected from case data.

**Precedent matching (separate again)** — `FOI_PRECEDENT_MATCH` *does* persist
`SIMILARITY_PCT = ROUND(100*AI_SIMILARITY(...))` with a 40% floor, one best row per case, and the UI
already renders a `★ 87% match` pill (`components/shared/precedent-match.tsx`). **The % chip idiom
exists — the s.21 path just has no number to feed it.**

### Blockers in the current model

1. **No request segmentation anywhere.** A request is one atomic blob in every similarity call.
   No table, column or function represents part of a request.
2. **Similarity is request-to-request, never request-to-response-content.** It measures *"was a
   similar question asked?"*, not *"is the answer actually in what we published?"* — which is what
   coverage requires.
3. **`PARTIAL` is already taken** — it means partial disclosure via exemptions (`apply` +
   `disclose` in `FOI_EXEMPTION_ASSESSMENT`), and maps to `GRANTED_PARTIAL`. It has no relationship
   to s.21.
4. **s.21 short-circuits exemptions** — `suggestedResponseType` (`lib/queries.ts:901`) returns on
   `s21MatchRef` before evaluating exemptions, so "part published, part withheld, part new" is
   unreachable.
5. **Only one match retained** (both s.21 and precedent). "These three published items jointly
   cover 70%" is not representable.
6. **The `S21_REUSE` prompt assumes total deflection** — *"Do not re-supply the full dataset"*
   (`lib/queries.ts:1271`), with no vocabulary for a residual net-new element.

## Design

The conceptual shift: from **request-level similarity** to **element-level coverage**.

### Phase 0 — free win: stop throwing the score away

Add `S21_SIMILARITY_PCT` to `FOI_TRIAGE` and retain top-N instead of top-1. The score is *already
computed*; persisting it costs nothing and immediately lets the existing % chip render on the s.21
flag. Do this first regardless of the rest.

### Layer 1 — segmentation

Decompose the request into discrete answerable elements via `AI_COMPLETE` with a structured array
schema (or `AI_EXTRACT`).

```
FOI_REQUEST_ELEMENT (ELEMENT_ID, CASE_ID, SEQ, ELEMENT_TEXT, PERIOD_REQUESTED,
                     CREATED_BY /* AI|HUMAN */, CONFIRMED_BY, CONFIRMED_AT)
```

The officer can merge, split or confirm elements — and that confirmation is itself a learning
signal (see `07-learning-loop.md`).

### Layer 2 — per-element matching, retaining two scores

For each element × candidate published item, compute **two** distinct measures. This is the crux:

| Measure | How | Answers |
|---|---|---|
| **Question similarity** | `AI_SIMILARITY(element_text, candidate.REQUEST_TEXT)` | "Was this asked before?" |
| **Answer coverage** | `AI_FILTER` / `AI_COMPLETE` as judge: *"Does this published response fully answer this element? FULL / PARTIAL / NO + confidence"* | "Is the answer actually there?" |

Both are needed because the case the business cares about — *previously answered but the figures are
now out of date* — presents as **high question similarity with failed coverage**. Request similarity
alone cannot distinguish it, and would confidently mis-signpost a stale answer.

```
FOI_ELEMENT_MATCH (ELEMENT_ID, SOURCE, REF, URL, QUESTION_SIM_PCT, ANSWER_COVERAGE,
                   COVERAGE_VERDICT /* COVERED|PARTIAL|NET_NEW */, PUBLISHED_DATE,
                   PERIOD_COVERED, STALENESS_DAYS, RATIONALE, MATCHED_AT)
```

Retain **top-N per element**, because several published items may jointly cover one element.

**Staleness is the detail that stops this embarrassing you.** Extract `PERIOD_REQUESTED` per element
and compare against the candidate's `PERIOD_COVERED`. "2025/26 spend" vs a 2023/24 publication
scores ~95% on question similarity and is worthless as an s.21 answer. Any officer will spot this
immediately in a demo, so handle it explicitly.

### Layer 3 — roll-up

```
FOI_CASE_COVERAGE (CASE_ID, ELEMENTS_TOTAL, ELEMENTS_COVERED, ELEMENTS_PARTIAL,
                   ELEMENTS_NEW, COVERAGE_PCT, COMPUTED_AT)
```

`COVERAGE_PCT` = weighted mean of element verdicts (COVERED 1.0, PARTIAL 0.5, NET_NEW 0), weighted
by element effort — element count initially, retrieval-hours later.

### Outcome model

Do **not** reuse `PARTIAL`. Add `MIXED_S21` to `ResponseType`, mapping to a new case outcome
(`GRANTED_PARTIAL_S21`). Critically, **remove the s.21 short-circuit**: the case outcome should be
*derived by composing per-element dispositions* rather than being a scalar chosen by the first rule
that matches. That is the underlying design fix — the outcome is currently a scalar where it should
be an aggregate.

### Drafting

Assemble a hybrid letter: per-element s.21 signpost with the real link for COVERED; refreshed
figures for PARTIAL; newly retrieved content for NET_NEW. Replace the blanket "do not re-supply"
instruction with per-element instruction blocks.

### UI showcase

An element coverage panel: one row per element with a % chip (reuse `PrecedentPill`), a verdict
colour (green COVERED / amber PARTIAL / grey NET NEW), and the source link. Header reads
*"68% of this request is already published"* with a donut. The demo value is that it makes the AI's
reasoning **inspectable element by element** instead of one opaque score.

## Compliance guardrails

- s.21 requires the information be reasonably accessible **to that particular applicant** — the
  officer must confirm; never auto-dispatch an s.21 disposal.
- Threshold policy in `COUNCIL_CONFIG` (e.g. auto-suggest COVERED only at ≥0.90 question similarity
  **and** coverage verdict FULL).
- Show staleness prominently — a stale signpost is a complaint waiting to happen.

## Side benefit

Element matches **are** case links. This delivers the substrate for linked-case / repeat-requester
detection, which does not exist today (see `07-learning-loop.md`).
