# Preprocessing pipeline — precompute today, on-the-fly with Outlook next

This note records the pipeline we run to **pre-compute** everything an FOI officer
needs before they open a case, and how the *same* pipeline runs **on the fly** when
a request arrives by email (the next build step). It is the written companion to the
in-app **Tuning & Learning → Processing pipeline** tab.

Home council = "Exampleton Council" (`COUNCIL_CONFIG`). DB/schema: `FOI.FOI_SENTINEL_V2`.

---

## What we pre-computed (batch, today)

The demo cases are processed ahead of time so every case opens instantly, already
triaged, matched, drafted and evaluated.

### 1. Compliant draft — `SP_GENERATE_RESPONSE(case_id, type)`
- Cortex `COMPLETE('mistral-large2', ...)` inside the proc. Prompt was simplified to
  emit a **plain-text message body** (no letterhead / date / address / markdown /
  bracketed placeholders), while enforcing the s.17 essentials (exemption statement,
  internal-review right, ICO route).
- Regenerated the four quick-win drafts after the prompt change:
  - `CALL SP_GENERATE_RESPONSE('<case_id>', 'DISCLOSURE')` for
    FOI-2026-0114 / 0102 / 0128 / 0126. The proc deletes any `FINAL_TEXT IS NULL`
    draft before inserting, so re-calling cleanly replaces the stored draft.

### 2. Suggested answer + evaluation — `precomputeSuggestedAnswer(reference)`
(`lib/queries.ts`, exposed via `POST /api/suggest-answer/precompute`)
- Grounds in five Cortex Search corpora (WDTK / GLA / Camden / council policy /
  Brentwood) then `COMPLETE('mistral-large2', ...)` with inline `[S#]` citations
  (`suggestAnswer`).
- **LLM-as-judge eval**: a second `COMPLETE` scores groundedness + coverage and
  returns strict JSON `{groundedness, coverage, verdict:PASS|WEAK|FAIL, notes}`.
- Upserts both into `FOI_SUGGESTED_ANSWER` (one row per case, PK = REFERENCE).

### How the batch was driven
- `POST /api/suggest-answer/precompute` with `{ references: [...] }` (defaults to all
  open cases when omitted). `maxDuration = 300`.
- Because 33 cases × (5 searches + draft + judge) can exceed one request window, it was
  driven in **batches of 5** via a small curl loop (`/tmp/foi_precompute_batches.sh`).
- Result at time of writing: 33 evaluated · avg groundedness ~0.57 / coverage ~0.65 ·
  11 PASS / 20 WEAK / 2 FAIL. Aggregates surface via `V_SUGGESTED_ANSWER_EVAL` on the
  Tuning & Learning → Evaluation tab.

### Objects involved
- Tables/views: `FOI_TRIAGE`, `FOI_PRECEDENT_MATCH`, `FOI_RESPONSE`,
  `FOI_SUGGESTED_ANSWER`, `V_SUGGESTED_ANSWER_EVAL`, `V_CASE`.
- Cortex Search: `WDTK_PRECEDENT_SEARCH`, `GLA_DISCLOSURE_SEARCH`, `CAMDEN_FOI_SEARCH`,
  `COUNCIL_POLICY_SEARCH`, `BRENTWOOD_FOI_SEARCH`.
- Procs/fns: `SP_GENERATE_RESPONSE`, `suggestAnswer`, `precomputeSuggestedAnswer`,
  `editDraftWithAI`.

---

## The same pipeline, on the fly (Outlook — next step)

Instead of a batch backfill, run the identical stages the moment a request arrives.
See `audit/scope-outlook-intake.md` for the recommended approach (Snowflake-native
external-access Python proc; SPCS webhook as a later real-time evolution). Prereq:
Azure app registration + admin consent on a dedicated demo mailbox.

```
SP_POLL_OUTLOOK_INBOX()            -- Graph API (client credentials) → land raw email
  → AI_PARSE_DOCUMENT(...)         -- email body + attachments → text
  → SP_TRIAGE_CASE(:case_id)       -- classification, complexity, sentiment,
                                   --   departments, s.14 flag, s.21 duplicate
  → precedent match                -- FOI_PRECEDENT_MATCH (Cortex Search)
  → precomputeSuggestedAnswer(ref) -- grounded suggested answer + LLM-judge eval
  → SP_GENERATE_RESPONSE(id, type) -- compliant plain-text draft (type auto-suggested
                                   --   from triage s.21 match + exemption assessments)
```

Net effect: the officer opens a case that is **already triaged, matched, drafted and
scored** — the batch precompute above, but triggered by arrival rather than by hand.

## What's configurable per authority (production)
- Mailbox(es) polled and cadence; auto-draft-on-arrival vs wait-for-officer.
- `AUTO_ACCEPT_THRESHOLD`, complexity bands (drive the Focus lanes), precedent
  similarity threshold (quick-win = ≥85%).
- Which Cortex Search corpora are grounded against (add the authority's own disclosure
  log), answer length, citation style.
- Judge pass/weak/fail bands and the action a failing case triggers.
- `COUNCIL_CONFIG` (name / sign-off / cost limits), tone, statutory paragraphs, models.
