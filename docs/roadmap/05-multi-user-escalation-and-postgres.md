# 05 — Multi-user escalation: identity, concurrency, and whether we need Snowflake Postgres

**Status:** Analysis + recommendation. **Owner:** Paddy Gardner.

## The blocker before any concurrency question: there is no user identity

The app has **no per-user identity at all**:

- `'FOI Officer'` is a hardcoded string literal on every write (`lib/queries.ts:660`, `:694`, `:706`).
- Officer names `'S. Begum'`, `'D. Marsh'` are hardcoded (`lib/queries.ts:3962`).
- No `middleware.ts`, no login, no session/cookie auth, no role gating anywhere.
- All Snowflake queries run as the **service identity** (owner's rights) via the SPCS session token.

**But identity is already available and unused.** SPCS passes `Sf-Context-Current-User` and
`sf-context-current-user-token` headers; they are read in `lib/snowflake.ts:556` / `:606` but only by
the diagnostic `/api/query` route.

Escalation is **impossible** without this — a sign-off chain, "assigned to", "who overturned this"
and per-contributor provenance all require knowing the actor. This is step one and it is cheap:
read the header, resolve to an officer, stamp it on every write and every `FOI_CASE_EVENT` row.

## Is Snowflake the right platform for this?

Split honestly by workload — the answer is different for each.

**Excellent fit (and this is most of the app's value):** the AI, retrieval over ~11,400 documents,
corpora, semantic search, analytics, reporting, statutory-deadline maths, immutable audit history.
None of this belongs anywhere else.

**Poor fit:** the transactional collaboration layer — case locks, assignment, presence, comment
threads, concurrent draft editing, a sign-off state machine. This is OLTP-shaped: many small
single-row read-modify-write operations.

Specifically, on Snowflake standard tables:
- DML takes **partition-level locks**; concurrent `UPDATE`s to the same table serialise and can queue
  or conflict. There is no row-level locking.
- No enforced primary keys or uniqueness → **two officers can both "claim" the same case**.
- Statement latency in the hundreds of milliseconds, plus warehouse queueing — acceptable for a page
  render, poor for an optimistic collaborative UI.
- The current code does `UPDATE FOI_CASE SET …` per action with **no version check** → classic
  **lost updates** with concurrent editors. Invisible at demo scale (one user); a real defect with ten.

**Frame the problem correctly for a customer:** FOI volumes are low. A large council handles a few
thousand requests a year — tens of concurrent users at most, a handful of writes per minute. This is
**not a throughput problem, it is a correctness problem** (lost updates, double-claim). Solve
correctness; do not over-engineer for scale that will never arrive.

## Three options

### (a) Snowflake Hybrid Tables (Unistore)
Row-store inside Snowflake: ACID, enforced PK/unique/FK, row-level locking, single-digit-millisecond
point lookups. Purpose-built for exactly this shape.

**Biggest advantage: no second system and no data movement** — hybrid tables join directly to the
analytical tables and Cortex output. Use for `FOI_CASE_ASSIGNMENT`, `FOI_CASE_LOCK`, `FOI_COMMENT`,
sign-off state, element claims.

### (b) Snowflake Postgres
A genuine managed Postgres.

**CORRECTION (2026-08-04): this project does NOT use Snowflake Postgres.** The account's
`POSTGRES_COMPUTE` spend (22.2 credits/60d) belongs to a single unrelated instance, **`AZ_GAME`**
(created 2026-04-01, `STANDARD_M`, PG 18, now SUSPENDED). It billed a *flat* ~0.427 credits/day with
no variation — i.e. an idle instance charging for existence — until it stopped around 27 July. It is
enabled on the account but has nothing to do with FOI Sentinel.

Full PG semantics: real transactions, indexes, `SELECT … FOR UPDATE`, triggers, `LISTEN/NOTIFY` for
realtime presence. Best fit if you want proper OLTP ergonomics, an ORM (Prisma/Drizzle alongside
Next.js), or a workflow engine.

**Cost:** two stores to keep coherent — read PG for live state, Snowflake for analytics and AI, with
`pg_lake`/Iceberg or a sync to bring state back for reporting. Note the fixed-floor lesson from
`AZ_GAME`: an idle instance still bills daily.

### (c) Standard tables + application-level concurrency control
Cheapest and, for the demo, almost certainly sufficient:
- Add an optimistic-concurrency `VERSION` / `UPDATED_AT` column and compare-and-set updates.
- Make assignment and stage changes **append-only** — insert events and derive current state, rather
  than updating in place.

## Recommendation

**For the demo: (c) plus real identity.** Do not bolt Postgres onto the demo — it adds a moving part
without changing what the demo shows, and doubles the deployment story right when you are also trying
to package this as a native app.

**If a customer presses on genuine multi-user concurrency:** *Hybrid Tables first* (no second system,
no coherence problem), *Snowflake Postgres* if they want full OLTP ergonomics, an ORM, or a workflow
engine.

**The append-only event model is the right design regardless** — because it is simultaneously the fix
for lost updates *and* the substrate for the learning loop. Every in-place `UPDATE` in this app is a
destroyed training example. One design decision solves both problems; see `07-learning-loop.md`.

## Escalation design (once identity exists)

- **Multi-owner cases** — segment a request into elements (shared substrate with
  `04-partial-s21-percentage-match.md`), assign each to the department holding the information, each
  with its own retrieval state, contributor and clearance status.
- **Consolidation** — merge contributions into one response retaining per-section provenance.
- **Sign-off chain** — configurable: case officer → team leader → monitoring officer, each transition
  an append-only `FOI_CASE_EVENT`.
- **Escalation triggers** — deadline risk, complexity threshold, vexatious flag, exemption dispute.
- **Grounding** — `FOI_INTERNAL_REVIEW` and `FOI_ICO_COMPLAINT` DDL already exists and is
  well-modelled; `V_ESCALATION_RISK` and `ICO_OUTCOME_BENCHMARK` already provide overturn rates.
  Fix the `OUTCOME_NOTE` overwrite bug first (see `07-learning-loop.md`).
