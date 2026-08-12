# 07 — How the app actually learns: feedback loops deep dive

**Status:** Analysis + design. **Owner:** Paddy Gardner.

## Verdict up front

A learning loop is **already possible for response drafting with no schema change** — `DRAFT_TEXT`
(AI) and `FINAL_TEXT` (human) are held in separate columns and the human edit does not overwrite the
draft. That pair is the most valuable asset in the system and it exists today.

But **five defects are actively destroying or fabricating the signal**, and **triage corrections do
not exist at all**. Fix the destruction before building anything new.

## What already works

| Signal | Where | Status |
|---|---|---|
| `FOI_RESPONSE.DRAFT_TEXT` + `FINAL_TEXT` | `01_ddl/01:236`; `saveResponseFinal` writes only FINAL | **Intact** — (AI, human) pairs queryable now |
| `AI_DRAFT_FEEDBACK` `EDIT_DISTANCE` / `EDIT_RATIO` | `lib/queries.ts:830` | Computed — but see defect 1 |
| `FOI_CASE_EVENT.ACTOR_TYPE` (AI/HUMAN/SYSTEM) + `ACTOR` (model name) | `01_ddl/01:141` | **Live** — who/what did what is reconstructable |
| `FOI_PRECEDENT_MATCH.USED` / `REVIEWED_BY` | `markPrecedent`, `lib/queries.ts:1894` | **Live** — explicit "I used this precedent" |
| `SAR_REDACTION_DECISION` | `01_ddl/08` | **A genuinely working closed loop** — copy this pattern |
| `FOI_SUGGESTED_ANSWER.GROUNDEDNESS` / `COVERAGE` / `EVAL_VERDICT` | `lib/queries.ts:1375` | Live LLM-as-judge scores |
| Fine-tune `mistral-7b` → `TRIAGE_TUNED` | v1 Streamlit build (superseded; not yet ported) | Real; 62.5% → 100% on n=16 |

`SAR_REDACTION_DECISION` is exactly the right shape and its own DDL comment describes the loop:
*record the human decision, pre-apply it next run, `IF NOT EXISTS` so learned decisions survive
redeploys.*

## The five defects breaking the loop

**1. `AI_DRAFT_FEEDBACK` has no `CREATE TABLE` anywhere.** It appears once in the repo — the INSERT —
wrapped in a swallow-the-error `catch`. Unless hand-created in Snowflake, **every divergence write has
been silently failing**. Raw pairs survive; the aggregate signal does not. Cheapest fix, highest value.

**2. Batch dispatch fabricates fake "perfect AI" rows.** `lib/queries.ts:946`:
```ts
if (!draft.finalText.trim()) await saveResponseFinal(reference, draft.responseId, draft.draftText)
```
This copies the draft into the final when nobody edited, producing `EDIT_RATIO = 0` rows that look
like enthusiastic acceptance but represent **no human review at all**. This would poison a fine-tune
in the most flattering and hardest-to-notice direction. Any training set must exclude them.

**3. Regeneration hard-deletes rejected drafts.** `04_procedures/02:148`
`DELETE FROM FOI_RESPONSE WHERE CASE_ID = … AND FINAL_TEXT IS NULL` destroys "AI tried, officer
rejected it wholesale, AI tried again" — the **highest-value negative example** available.

**4. Triage corrections do not exist.** No override UI (`triage-panel.tsx` is read-only), no AI/human
column pair, no correction log, no `UPDATE FOI_TRIAGE` outside the s.21 procedures. `S21_MATCH_REF` is
worse than overwritten — it is **nulled** when a re-sweep drops below threshold
(`01_ddl/10:129`). Yet `/learning` claims *"corrections become labelled training data for the next
fine-tune"* (`app/learning/page.tsx:41`) — that is **narrative, not implementation**.

**5. The "why" behind every overturn is destroyed.** `FOI_INTERNAL_REVIEW.OUTCOME_NOTE` first holds
the requester's **grounds for challenge**, then `recordReviewOutcome` (`lib/queries.ts:3912`)
**overwrites the same column** with the AI-generated outcome letter. One column doing two
incompatible jobs. You keep the label (`OVERTURNED`) and lose the feature (*why*).
**Fix this first — every completed review destroys unrecoverable data.**

### Also worth knowing

- **`TRIAGE_TUNED` is not used for inference anywhere.** Production triage runs base `mistral-large2`
  (`04_procedures/02:110`). The tuned model appears in zero lines of the app's query layer.
- **The fine-tune is unreproducible** — `FT_TRIAGE_TRAIN`, `FT_TRIAGE_EVAL`, `FT_TRIAGE_JOB`,
  `V_TRIAGE_MODEL_COMPARE` have no DDL in the repo.
- **Broad schema drift** — `AI_DRAFT_FEEDBACK`, `AI_DECISION_LOG`, `FOI_SUGGESTED_ANSWER`, `V_CASE`
  and several `FOI_TRIAGE` columns exist in Snowflake but not in `01_ddl`. **A fresh deploy from
  `01_ddl` would not support the current app** — resolve before building a learning loop on top.
- `logAiDecision` stores prompt/response **hashes only**, never raw text — excellent for
  defensibility, useless as training data.
- **Linked cases do not exist.** No `LINKED_CASE` / `DUPLICATE_OF` / `REPEAT_REQUESTER`;
  `REQUESTER_EMAIL` is a bare string with no dedupe — yet the vexatious triage prompt asks whether the
  request is *"part of a repeated campaign"* with **no data to ground that judgement**.

## The four loops, in cost/value order

### Loop 0 — free, today: stop destroying data
- Create `AI_DRAFT_FEEDBACK` (the INSERT is failing silently).
- Split `FOI_INTERNAL_REVIEW.OUTCOME_NOTE` → `GROUNDS_NOTE` + `OUTCOME_LETTER`.
- Soft-delete superseded drafts (`SUPERSEDED_AT`) instead of `DELETE`.
- Log a `FOI_CASE_EVENT` on save/edit — the most learning-relevant human action currently leaves no
  audit event.
- Flag batch-copied finals so they are excludable from any training set.

No AI cost, no new model, no UI. Do this first.

### Loop 1 — cheap, high value: retrieval feedback (no fine-tuning at all)
Generalise `FOI_PRECEDENT_MATCH.USED`: record, per suggested source, whether it was **actually cited
in the final letter** (match the final text against the retrieved sources). That yields per-corpus
precision — *"Camden is cited 40% of the time, Brentwood 2%"* — which tunes retrieval weights and
justifies **dropping or downweighting corpora**. This improves groundedness *and* cuts cost, since
retrieval breadth is the token driver (see `06-ai-cost-model.md`).

### Loop 2 — flagship: the drafting reward signal
From `(DRAFT_TEXT, FINAL_TEXT)` pairs, mine **what officers systematically change** — not just edit
distance, but the *kind* of edit, clustered by an LLM: tone, added statutory citation, removed
speculation, added signposting, corrected figure.

Two outputs:
- a measurable **AI acceptance** trend over time (the honest version of "it's learning"), and
- **style/policy rules fed back into the drafting prompt** — cheaper, more controllable and more
  explainable than fine-tuning, and it works at low volume.

Fine-tune on high-quality finals later, once there are enough clean pairs (excluding batch copies).

### Loop 3 — most defensible: outcome-supervised learning
`FOI_INTERNAL_REVIEW.OUTCOME` (UPHELD / OVERTURNED / PARTIALLY_UPHELD) plus ICO status is the **only
ground-truth label in the entire system** — the world telling you the decision was wrong. Join
overturn outcomes back to the exemptions claimed, complexity and drafted text, then **warn at draft
time**: *"s.43 on procurement contracts is overturned in X% of comparable cases."*

Highest value to a buyer because it reduces legal and reputational risk, not merely effort.
`V_ESCALATION_RISK` and `ICO_OUTCOME_BENCHMARK` already provide the external baseline.

### Loop 4 — needs build: triage corrections
Add a correction path with an **AI-value / human-value column pair, never an overwrite**:

```
FOI_TRIAGE_CORRECTION (CASE_ID, FIELD, AI_VALUE, HUMAN_VALUE,
                       CORRECTED_BY, CORRECTED_AT, REASON)
```

Append-only. This is the labelled dataset the existing fine-tune pipeline needs, and it closes the
gap between the `/learning` page's claim and reality.

### Loop 5 — linked cases
Requester identity resolution + a case-link table. Note the element-level matching designed in
`04-partial-s21-percentage-match.md` **produces case links as a by-product** — element matches *are*
links. Build s.21 coverage and linked cases fall out of it.

## Design principles

1. **Append-only, never overwrite.** Every in-place `UPDATE` in this app is a destroyed training
   example. This is also the fix for the concurrency problem in `05-multi-user-escalation-and-postgres.md`
   — one design decision solves both.
2. **Always store the AI value beside the human value** — a column pair, not a column.
3. **Distinguish "no edit" from "not reviewed."** Otherwise silence reads as approval — the most
   dangerous bias in a human-in-the-loop system, and defect 2 above is exactly this.
4. **Capture the reason, not just the decision.** Labels train classifiers; reasons train prompts,
   and prompts are what you can actually ship and explain.
5. **Real identity is a prerequisite** — corrections attributed to the literal `'FOI Officer'` cannot
   support reviewer-level learning. See `05-multi-user-escalation-and-postgres.md`.
