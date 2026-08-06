# FOI Sentinel v2 — New-flows persona audit (xo-audit, g-stack)

**Date:** 2026-06-30 · **Harness:** http://localhost:3100 (Next.js dev, live Snowflake) · **Theme:** light (GOV.UK palette)
**Scope:** the flows added this session — the **Focus work-queue lanes** (Quick wins / Needs review / Complex), **batch send**, **pre-computed quick-win drafts**, and the **Snowflake Intelligence companion agent** — assessed against the stated value proposition. Personas reused from `audit/personas.md` (not re-invented).

---

## The value proposition under test

> 1. **Cut through the noise.** FOI requests are rising in volume and complexity (more legalese). Give councils **automated, repeatable** processes to respond **effectively, on time, with a human in the loop, to Gov standards**.
> 2. **Learn from triage.** Analyse the similarity of previously **"successful"** replies (closed and *not* internally reviewed or re-raised / ICO-complained) and **signpost to published website content** where appropriate.

Each new flow is graded against these two claims through the three persona lenses (end-user FOI/IG Officer, economic buyer Head of Legal & Governance/SIRO, champion Transformation Lead). Grades: **PASS** (delivers), **FLAG** (works but a gap vs the value/Gov-standard), **GAP** (value claimed but not yet supported by data/flow).

---

## 1. Focus lanes — triage that cuts through the noise

**Flow:** `/cases` defaults to Focus, splitting the 33 open requests into **Quick wins (4)**, **Needs review (18)**, **Complex (11)** via `laneOf()` (precedent ≥85% + complexity ≤4 → quick; vexatious or complexity ≥7 → complex; else review).

| Lens | Verdict | Finding |
|---|---|---|
| End-user | **PASS** | The officer sees "what to work next and why" without scanning a 33-row list. Quick wins are front-loaded; complex/vexatious are quarantined with a reason chip and routed to the full case (no auto-draft) — correct HITL posture for hard cases. |
| Buyer | **PASS** | Lanes are a defensible, repeatable triage policy (deterministic thresholds, not a black box). The "Complex → human-led, no auto-draft" rule is exactly the "AI won't make ungoverned decisions" assurance the SIRO needs. |
| Champion | **PASS** | Clear demo arc: "easy ones batched, medium ones reviewed one-by-one, hard ones escalated to a human." Lane counts (4/18/11) read instantly. |

**FLAG (value 1 — repeatable):** lane thresholds are hard-coded constants in `focus-deck.tsx`. For a *repeatable, council-configurable* process the buyer would expect these to be policy settings (Admin), not code. Minor for the demo; note for productisation.

## 2. Batch send + pre-computed drafts — automation vs HITL tension

**Flow:** Quick-wins lane pre-selects all 4 cases (real Cortex pre-drafts shown as a 2-line preview), one **"Send 4 responses"** button → `/api/response/batch-dispatch` → save + dispatch + close each.

| Lens | Verdict | Finding |
|---|---|---|
| End-user | **PASS** | Genuine time-saver: the repeatable, low-risk disclosures (senior pay, fly-tipping fines, parking revenue, school appeals) are exactly the right candidates to batch. |
| Buyer | **FLAG → GAP** | **This is the most important finding.** "Send 4 responses" is a **single click with no review-affirmation step**, and the card shows only a **2-line clamped preview** with **no inline edit**. That sends four AI-drafted statutory responses the officer may not have read in full. Against the **HITL / Gov-standard** claim this is the weakest point: the per-case Studio has a confirm step, but **batch send bypasses it**. |
| Champion | **FLAG** | A demo risk: if asked "did a human read each of those before they went to the requester?", the honest answer today is "not necessarily." |

**Recommendation (P1, HITL):** before batch dispatch, require an explicit review gate — e.g. each quick-win row must be expanded/opened (or an "I have reviewed these N drafts" affirmation ticked) before "Send" enables; and/or a confirmation dialog summarising recipients + response types. Log the affirmation to `FOI_CASE_EVENT` so the buyer can evidence human sign-off per Gov standards. This keeps the automation while restoring the defensible HITL spine.

## 3. Snowflake Intelligence companion — `SNOWFLAKE_INTELLIGENCE.AGENTS.FOI_SENTINEL_COMPANION`

**Flow:** a Cortex Agent (Cortex Analyst over `FOI_CASE_ANALYTICS` + 5 Cortex Search tools: GLA, Camden, Brentwood, WDTK, policy) on the mobile-accessible SI surface.

| Lens | Verdict | Finding |
|---|---|---|
| End-user | **PASS** | Verified live: "open overdue by regime, exclude synthetic" → 9 RED (FOI 8/EIR 1/SAR 0). Lets an officer interrogate the backlog and precedent corpora conversationally, on mobile. |
| Buyer | **FLAG** | Two precision gaps from the thin FastGen model: (a) the agent reads "overdue" as RAG=RED (9) rather than strictly past-deadline (`WD_REMAINING<0` = 4); (b) `STATUS`/synthetic handling relies on prose instructions, not verified queries. Sharpen with custom instructions + 2–3 VQRs before it's put in front of members. |
| Champion | **PASS** | A second surface ("ask the data on your phone") that reuses the same governed semantic layer — strong narrative, no second app to maintain. |

---

## 4. Triage-learning & signposting — the headline analytical finding

Your idea: *learn from previously successful replies (closed, not reviewed/re-raised) and signpost to published content.* I probed the data to see how far the app supports this today.

**Data probe (real, FOI.FOI_SENTINEL_V2, synthetic cases excluded):**

| Signal | Value | Reading |
|---|---|---|
| Closed cases | 21 | The historical base to learn from |
| "Successful" (closed, **no** internal review or ICO complaint) | **21 / 21** | The success label is computable and clean |
| Reviewed / ICO-complained | 2 | …but both are on **open** challenge cases, not the closed set |
| Closed cases with a **dispatched reply stored** | **0** | **No reply text exists to embed or reuse** |
| Closed cases with a **precedent match** | **0** | Precedent matching never ran on the closed/historical set |
| Closed cases that used an **s.21 "already published" signpost** | **0** | Signposting capability exists (`/published`) but is unused in outcomes |
| Precedent matches by source (open cases) | This council 23 · GLA 4 · WDTK 4 | Matching is against external/published sources + open-case rows, **not** the council's own *sent successful* replies |

**Interpretation — the loop your value statement describes is not yet closed:**

- The **success signal** (closed AND not reviewed/complained) is well-defined and trivially queryable — **21/21 closed are "clean."** Good raw label.
- But there is **no corpus of the council's own successful sent replies** to learn from: closed cases carry an `OUTCOME` but **no stored response text**, so nothing to embed.
- Precedent today points **outward** (WDTK/GLA/Camden/published) and to open-case rows — it does **not** rank an incoming request against *"how we successfully answered a near-identical request before, and it was never challenged."*
- **Signposting** is a built feature (`searchPublished`, s.21) but **0 closed outcomes** used it — so we can't yet show "X% of requests deflected to already-published content."

**Recommendation (P1, value 2 — the triage-learning flywheel):**
1. **Persist sent replies.** Ensure every dispatch writes the final reply text (and response type) to `FOI_RESPONSE`/an outcomes table — including a back-fill of the 21 historical closes with representative reply text. Without this there is nothing to learn from.
2. **Label success.** Add a derived `WAS_SUCCESSFUL = closed AND NOT (internal_review OR ico_complaint)` flag at case level (the probe above is the definition). This becomes the training/ranking signal.
3. **Build an intra-authority "successful reply" search corpus** (Cortex Search over successful sent replies, mirroring the Camden/GLA/Brentwood pattern) and add it as a precedent source ranked **above** external matches — "we answered this before, it stuck."
4. **Close the signpost loop.** When a successful prior reply (or policy/published doc) covers an incoming request, surface the **s.21 signpost** as the suggested action and **measure deflection rate** (a buyer KPI: requests answered by pointing to published content = cheapest possible response).
5. Feed (2)+(3) back into the **Quick-wins lane gating** — a request matching a *successful, never-reviewed* prior reply is the highest-confidence quick win and the safest to batch (which also de-risks finding P1 in §2).

This turns triage from "match to anything similar" into "match to what *worked* for us" — directly serving "automated, repeatable, on-time, to Gov standards."

---

## 5. Visual / theme (light mode)

Spot-checked the new Focus lanes in light mode (user's mode). GOV.UK palette applied: priority chips (HIGH=red `#d4351c`, MED=amber `#f47738`, LOW=slate), green quick-win accents, red RAG accent border on the review card. Contrast reads AA-adequate; no dark-surface leak observed on the lanes, rail, or cards. No clipped text. **PASS** (full per-overlay sweep not re-run — not gating for this flow-focused audit).

---

## Persona coverage matrix (new flows)

| Use case (value claim) | End-user | Buyer | Champion |
|---|:--:|:--:|:--:|
| Triage cuts through noise (lanes) | PASS | PASS | PASS |
| Automated batch response | PASS | **FLAG (HITL)** | FLAG |
| On-time / repeatable process | PASS | FLAG (config) | PASS |
| Conversational backlog/precedent (companion) | PASS | FLAG (precision) | PASS |
| Learn from successful replies | — | **GAP** | — |
| Signpost to published content | — | **GAP** | — |

## Prioritised findings

- **P1 (HITL, gate-relevant):** batch "Send N" has no per-draft review gate and only a 2-line preview — add a review affirmation + confirm dialog + event log before dispatch (§2).
- **P1 (value flywheel):** the "learn from successful replies + signpost" loop is not closed — persist sent replies, label success, build an intra-authority successful-reply corpus, measure s.21 deflection (§4).
- **P2:** companion precision — add custom instructions + VQRs so "overdue" = `WD_REMAINING<0` and synthetic exclusion is enforced (§3).
- **P3:** lane thresholds hard-coded — move to Admin config for a repeatable, council-tunable policy (§1).

## Gate decision

**CONDITIONAL PASS for demo.** The new flows land well for end-user and champion and tell a strong "cut through the noise" story. **Before this is positioned as Gov-standard HITL**, address **P1 (batch review gate)** — it is the one place the AI-with-human-in-the-loop spine is currently bypassed. The triage-learning flywheel (P1 value) is the highest-value *next build*, not a regression, and is honestly a GAP today rather than a broken feature.
