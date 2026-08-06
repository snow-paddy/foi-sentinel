# Retro — why the SAR single-subject flaw and the three on-camera defects slipped past multiple pre-demo audits

**Date:** 2026-07-07 · **Trigger:** operator caught, on the eve of recording, that `/sar` "is all about James Whitfield" and that three defects (audit-chain false positive, S.17 disclosure badge false negatives, markdown-table email) reached the camera despite several prior audits.

This is a blameless retro. The prior audits were good at what they were designed to check. The misses cluster into **three blind spots** in what "audited" meant.

---

## What the prior audits were optimised for (and did well)

Evidence: `demo-readiness-audit.md`, `AUDIT_REPORT.md`, `livepaths-audit-results.json`, `user_stories.md`.

- **Route-200 + render + console-clean sweeps** across every demo surface.
- **Functional live-path proof** — Outlook round-trip real, redaction real, chain badge present, KPIs numeric.
- **Persona coverage** — end-user / buyer / champion stories in Given/When/Then with a UI signal.
- **Visual/theme sweep** — light theme, Snowflake-blue accents, no dark-on-light.

They caught real things (funnel under-count, HITL gate gap, mailbox noise, un-prettified titles). The method was sound. The **acceptance criteria were the wrong shape** for the four things that slipped.

---

## The three blind spots

### Blind spot 1 — "renders / works" was asserted; **semantic value-correctness** was not
Stories asserted *presence* ("the audit-trail panel renders", "Chain verified badge"), never *truth of the specific value*.

- **Audit-chain false positive.** `US-EB-04` asserted the "Chain verified" badge appears — and on the sampled demo case (FOI-2026-0088/0115) it *did* verify, so the story passed. The false-positive **broken** state lived only on the one forked eval row created by seed scripts reusing explicit `SEQ` values. No story said "verify the chain on *every* row, including seeded/edge rows" so the collision row was never in the audit's sample.
- **S.17 badge false negatives.** No story encoded badge *semantics* — that a DISCLOSURE letter must **not** claim an exemption while a REFUSAL/PARTIAL must. The panel rendered badges, the story passed on render. The badges were simply *wrong* for 25 disclosure drafts, and "wrongness" was never an assertion.

**Root pattern:** presence-checks pass on rendered UI even when the data behind them is semantically false. Happy-path case sampling hides edge-row data bugs.

### Blind spot 2 — the audit is **bounded by the localhost harness**; the email left it
- **Markdown-table email.** The audit drives `localhost:3000`. The *sent* artefact — the email as rendered in Outlook — is off-harness. `user_stories.md:10` (US-EU-04b) even records the limitation: the animated pipeline consumes the email, "so the automated audit asserts /intake renders + peek works rather than firing a live send." The letter *body formatting* was therefore never in any audit's field of view. It could only surface by reading a real received email — which is exactly when the operator hit it.

**Root pattern:** anything whose final form renders outside the driven surface (email clients, exported bundles, downstream systems) is invisible to a harness-only audit.

### Blind spot 3 — realism/production-illusion was **not an audit dimension**; the flaw was designed in and then *affirmed*
This is the big one, and it wasn't a "miss" — it was a **framing error carried from discovery through audit**.

- `scope-sar.md:86` scoped SAR around a single staged subject: "`SAR_CASE_SUBJECT` (James Whitfield) … one source, one doc." Recommended Option B (`scope-sar.md:94`) was "extend the Redaction Studio into a SAR across the estate demo" — for that **one** subject. Single-subject was the *design*, not an accident.
- `demo-readiness-audit.md:26` **PASSED** `/cases/SAR-2026-0107`, and `:70` praised "the James Whitfield SharePoint note" as a strength. The auditor **saw the named individual on the page and scored it a positive**, because the persona story was "can the officer redact a SAR document" (functional) — a lens under which a hard-coded subject is *fine*.
- No story asked: "does this screen read as a real council caseload, or does a named individual sitting on a synthetic page break the production illusion for the buyer/champion?" The champion lens existed (`personas.md:17`) but its stories checked *narrative flow and no-broken-surfaces*, not *does-this-look-like-a-real-system-of-record*.

**Root pattern:** functional and visual audits both pass a page that is *narratively unrealistic*. "Convincing as production" is a distinct axis from "works" and "looks right", and nothing tested it.

---

## Why several audits in a row all missed the same things
1. **They re-used the same story set.** Each re-audit inherited the presence-based acceptance criteria, so the same blind spots propagated. (This retro's fix: the new `US-SAR-01..03` are the first stories written as *negative/realism* assertions — "no data-subject name on the queue", "leaks no subject", "spends no Cortex".)
2. **Happy-path sampling.** Chain/badge bugs lived on specific rows; audits sampled the *good* demo case.
3. **Harness boundary un-owned.** No one owned "verify the artefacts that leave the app."
4. **Realism never operationalised.** The champion lens was about flow and polish, not "is this believable as a live system."

---

## Concrete changes to the audit method (actionable)

1. **Add a "semantic correctness" story class.** For any badge/flag/derived value: assert the value is *correct for its inputs*, not just present. Where practical, verify at the data layer (as this audit did: 25/25 disclosure = no exemption; 6/6 refusal = exemption; chain N=10 ALL_OK). *Do this for every case/row, not one sampled case.*
2. **Add an "off-harness artefact" checklist.** Anything that renders outside `localhost` — sent emails, exported disclosure bundles, SharePoint docs — gets an explicit manual check step in the report, flagged DEFERRED until proven on the real surface (as the email item is here).
3. **Add a "production-illusion" story per demo surface.** For each screen a viewer sees: "Would a UK council officer believe this is their live system? Any hard-coded individual, placeholder, or single-record page that only makes sense as a demo prop?" This is the story that would have caught James-on-the-SAR-page. Anchor personas to *roles*, and test that subjects/records read as a *population*, not a fixture.
4. **Edge-row seeding discipline.** Seed scripts must not reuse autoincrement key values (`SEQ`); the chain bug was a seed-data hygiene failure. Add a data-integrity probe (chain verify, orphan check) to every audit, not just render checks.
5. **Don't inherit stories blindly on re-audit.** Each re-audit adds at least one *adversarial* story aimed at what changed, phrased as "prove it does NOT leak / does NOT lie / does NOT look fake."

---

## One-line takeaway
The audits proved the app **worked and looked right**; they never proved it was **semantically true, complete beyond the harness, or believable as production** — and those three are exactly where the four defects lived. The fix is not more audits, it is three new *dimensions* of assertion, now seeded as `US-SAR-01..03` and the method changes above.
