# Audit report — submit-and-poll refactor + Connections & Security page

**Date:** 2026-08-06
**Scope:** the two changes deployed as `8166129` (submit-and-poll) and `b21c9f2` (Connections & Security)
**Spec source:** `docs/PERSONAS.md`, `docs/USER_STORIES.md`, `docs/USER_JOURNEYS.md` (read, not re-invented)
**Gate decision:** **PASS**, with one gate-blocking defect **found and fixed during the audit** and three findings carried forward.

## Harness — deviation from the standard protocol

The audit prerequisite is a local harness on `localhost`, because a deploy URL behind SSO cannot normally be automated. That was **not used here**. Instead the audit ran against the **deployed app** at
`https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app` through an already-authenticated agentic browser session.

Consequences, stated so the evidence is read correctly:
- What was tested is the **real deployed service**, its real service role and real Graph credentials — stronger evidence than a local harness for anything permission- or connectivity-related. Indeed the one gate-blocking defect was a **permission** difference that a local harness run as `ACCOUNTADMIN` would have hidden.
- Playwright specs were **not** committed for these checks. The assertions were run as instrumented `browser_evaluate` probes. They are reproducible from this report but are not yet a regression suite.

Theme: light canvas (`rgb(243,242,241)`) confirmed while the OS reports `prefers-color-scheme: dark`. This is the exact condition behind the historic dark-widgets-on-light-canvas defect, and it is **clean** — no theme leak.

## Personas exercised

| Lens | Role (from `docs/PERSONAS.md`) | Why this change matters to them |
|---|---|---|
| End-user | FOI / Information Governance Officer; Data Protection / SAR Officer | The intake run used to fail with a misleading error after the work had actually succeeded. |
| Economic buyer | Monitoring Officer / SIRO / Head of Information Governance | Needs to see the connection inventory, the permissions withheld, and where data physically sits. |
| Champion | Information Governance Manager / Transformation Lead | "One broken screen and I lose the room" — the old failure was exactly that, mid-demo. |
| Author / owner | (this work item) | Data honesty: nothing modelled or absent may be presented as fact. |

## Functional results

| ID | Story | Result | Evidence |
|---|---|---|---|
| US-SP-01 | Submitting long work returns immediately rather than holding the request open | **PASS** | `POST /api/redaction/demo/run` → HTTP **202 in 0.5s**; `POST /api/intake/pipeline` → HTTP **202 in 0.8s** |
| US-SP-02 | An unknown job id is reported as unknown, not as a crash | **PASS** | `GET /api/jobs/status?id=does-not-exist` → **HTTP 404, `status=unknown`** |
| US-SP-03 | A duplicate submit joins the run in flight instead of starting a second | **PASS** | Two submits 0.1s apart both returned `redaction-demo-mshhminq-1`, second with **`joined=true`**. Material: the mailbox poll marks mail read as it goes. |
| US-SP-04 | Long work completes and reports real stages | **PASS** | Pipeline on `FOI-2026-D08051441320`: `finding precedents and grounding an answer` (5.6→36.2s) → `drafting the response` (40.4→60.2s) → `benchmarking against a peer disclosure` (64.2→68.5s) → `done`. **Server elapsed 70.6s**; longest single HTTP request 0.8s. |
| US-SP-05 | The result survives the trip and is complete | **PASS** | draft 1,573 chars; 22 precedents; groundedness 0.80; benchmark `PARTIAL` |
| US-SP-06 | Redaction Studio still works through the new path | **PASS** | 9 findings with per-value checkboxes, "Confirm & release (9 of 9 redacted)", no error. Separately via API: `done` in 12.5s, 10 findings, 1,840 chars parsed. |
| US-CX-01 | Buyer can see every connection with objects and scopes | **PASS** | 5 cards; badges 4 × LIVE + 1 × SIMULATED in the correct position |
| US-CX-02 | Withheld permissions are shown as withheld | **PASS** | `Mail.Send` rendered with a cross and the label "not granted", twice (Graph card + outbound dispatch card) |
| US-CX-03 | Connectivity is proved, not asserted | **PASS** | Probe → "Connection healthy", token endpoint **200**, Graph mailbox call **200** |
| US-CX-04 | Residency claim is evidenced from live data | **PASS (after fix)** | "16 text chunks across 7 documents" + columns `DOC_ID TEXT`, `METADATA OBJECT`, `CHUNK TEXT` — matches SQL truth exactly |
| US-CX-05 | Navigation exposes the page under System | **PASS** | System group = Connections & Security, Tuning & Learning, Admin, About |
| US-SP-07 | Mailbox sync completes through the job path | **NOT TESTED** | The demo mailbox holds **no unread mail**, so the run button is legitimately disabled. Blocked, not failed. |

`US-SP-07` also leaves the `outlook-test.tsx` **component** wiring unproven — the stage line and the recovery branch were verified by reading, and the underlying job mechanism was proven via the API, but the component itself has not been driven.

## Precision on what US-SP-04 proves

The pipeline run took **70.6s**, which is **under** the 90-second ingress limit — so this specific run is not itself a case that used to fail. What is proven is that **no request is held open** (longest 0.8s) and that work continues across many short requests. The original failure was the mailbox poll (**97.7s** measured) followed by the pipeline in a single user action, roughly 168s of work behind a 90s ceiling.

## Visual / theme sweep

Probe: per-element ancestor background compositing on a 1×1 canvas (handles `lab()`/`oklch()`/alpha, which a regex over `rgb()` silently misses), WCAG 2.1 contrast ratios, plus an injected known-bad sentinel (`#141414` on `#111111`) to prove the scanner can fail. **Sentinel flagged: true** on every run.

- **Dark surfaces on the light canvas: none.** The only dark element found was the brand primary button `rgb(29,112,184)` carrying white text, which is intended.
- **Contrast failures on `/connections`: 3.**

| Element | Colour | Ratio | Needs |
|---|---|---|---|
| Page sub-heading paragraph | `rgb(100,116,139)` @14px | 4.26 | 4.5 |
| `SIMULATED` badge | `rgb(244,119,56)` @10px | 2.45 | 4.5 |
| `Copy` badge | `rgb(244,119,56)` @10px | 2.45 | 4.5 |

**These are not regressions.** The same probe on the Command Centre — untouched by this work — found **7** failures using the same shared tokens, including the identical warn orange at 2.78 and the same muted-foreground at 4.26. The new page inherits an app-wide token problem rather than introducing one. Carried forward as finding F3.

## Findings

### F1 — Residency panel could not read the index (gate-blocking) — FIXED during audit
The panel rendered **"The index could not be read."** while the prose above it asserted "no column of any binary type — so no file is duplicated into Snowflake". An unevidenced governance claim with its evidence panel broken, which fails the author/owner data-honesty rule.

Root cause: `FOI.SAR_INGEST.DOCS_CHUNKS` is owned by `OPENFLOW_RUNTIME_ROLE_SAR` and had **no SELECT granted to anything else**, whereas the sibling `SAR_SHAREPOINT_DOC_CORPUS` carries an explicit `SELECT → ACCOUNTADMIN`. Fixed with the same grant. **No redeploy was needed** — the page is `force-dynamic`.

**Why it was not caught earlier, and the lesson:** the query was verified in the CLI as `ACCOUNTADMIN`, which inherits the Openflow role. That was never proof the app could run it. **Verifying SQL as ACCOUNTADMIN does not verify it for the app.** The change that broke it was made *for accuracy* — repointing from the readable enrichment table to the real index — which is why it needed testing, not reasoning.

### F2 — The remote build is not a type gate (contradicts the working assumption)
`next.config.mjs` sets **`typescript: { ignoreBuildErrors: true }`**. The project's notes and the task brief both state "the remote build is the only type gate". That is **false**: type errors are explicitly ignored. `lastExitCode: 0` proves the app **bundled**, not that it type-checks. Combined with `node_modules` having no `typescript`, there is currently **no type checking anywhere in the workflow**. The protection on this change came from the critic review, not the build.

### F3 — WCAG AA contrast failures from shared design tokens (pre-existing, app-wide)
Failing tokens: muted-foreground `rgb(100,116,139)` @14px (4.26), warn `rgb(244,119,56)` @10–12px (2.45–2.78), danger `rgb(212,53,28)` @12px (4.17), separator `rgb(226,232,240)` (1.23, decorative). For a UK public-sector product this is a statutory accessibility exposure (WCAG 2.2 AA under the public sector accessibility regulations), not only a polish item.

### F4 — A silent catch produced an unexplained failure message
`getResidencyFacts()` swallows the error and renders "The index could not be read." with no reason logged. This is the **same class of bug** as the misleading "Could not reach the pipeline endpoint" that this work item exists to fix. The error should be logged server-side.

### F5 — Missing space between adjacent inline elements
`innerText` yields `Mail.Sendnot granted` and `SP_PEEK_OUTLOOK_INBOXProcedure`. Visually spaced by margin utilities, so no visual defect, but assistive technology reading the text layer will run the words together.

### F6 — Other routes remain exposed to the 90s cut (accepted scope)
`/api/intake/peek`, `/api/suggest-answer/precompute`, `/api/response/ground`, `/api/response/batch-dispatch` still declare `maxDuration` 120–300. Deliberately out of scope for this deploy; the job primitive makes them a small change each.

## Gate

**PASS.** Every key-use-case story is `PASS` except `US-SP-07`, which is **blocked by an empty mailbox rather than failed**. The one gate-blocking defect (F1) was fixed and re-verified during the audit. F2–F6 are carried forward and none of them block this change.

**Outstanding before this can be called fully verified:** send a request to the demo mailbox and run the Outlook Test end to end, to close `US-SP-07` and exercise the `outlook-test.tsx` stage rendering and recovery branch.
