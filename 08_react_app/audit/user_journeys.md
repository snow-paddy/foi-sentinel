# FOI Sentinel v2 — User journeys (xo-audit Phase 1b)

One journey per persona: trigger → steps/pages → human-in-the-loop decision points → success (tied back to the problem statement). Each step notes the page it happens on. Phase 2 stories (deferred to pre-deploy gate) will assert the UI signal at each step.

---

## Journey A — FOI Officer: "what do I work next, and is my refusal watertight?"

- **Trigger / entry**: starts the day on **Command Centre** (KPIs: open/overdue, RAG mix).
- **Steps & pages**:
  1. **Command Centre** → scan overdue/red cases → click into **Cases (board)**.
  2. **Cases (board/list)** → prioritise by RAG + complexity + sentiment; open a risky case → **Case detail**.
  3. **Case detail** → read triage ("how AI triaged this"), check **complexity tooltip** (how the score is derived) and precedent match.
  4. **Decision point (HITL)**: accept the **precedent** → case auto-advances to DRAFTING.
  5. **Case detail → Response & Refusal Studio** (now full-width) → generate a compliant draft → review s.17 badges.
  6. **Decision point (HITL)**: edit → **Save as final** → **Dispatch (close case)**.
  7. Branch — if it's already public: **Published information** → confirm it's published → s.21 deflection.
- **Success**: the right case worked first, a defensible response dispatched, clock met. (Addresses "which to work next / is my refusal watertight".)

## Journey B — Head of Legal/Governance: "what's our exposure and is it defensible?"

- **Trigger / entry**: preparing a performance/risk update for members → **Reporting**.
- **Steps & pages**:
  1. **Reporting** → timeliness vs **90% SLA**, by regime, by outcome, monthly trend, departments.
  2. **Reporting → cost-of-processing** (NEW) → modelled £ per FOI vs the **s.12 basis** + sector comparator.
  3. **Cases → Reviews & ICO** → internal-review and ICO-complaint posture; disclosure-log completeness.
  4. **Triage Learning** → tuned-vs-base triage accuracy (1.0 vs 0.625) → "the AI is measured, not trusted blindly".
  5. **Sector Trends** → benchmark against WDTK/GLA peers.
- **Decision point**: fund/continue? The numbers + recognised standards make the case.
- **Success**: a board-ready, defensible risk-and-cost picture. (Addresses "I can't see our exposure or cost until it's a problem".)

## Journey C — Transformation Lead: "show SLT that AI helps without ungoverned decisions"

- **Trigger / entry**: live demo to SLT → start at **Intake**.
- **Steps & pages**:
  1. **Intake** → AI-generate or paste an inbound request → live **Cortex triage** (sentiment/complexity/category) → create a demo-marked case.
  2. **Cases (board)** → the new case appears classified, clock started.
  3. **Case detail** → triage reasoning + precedent → **Studio** draft → s.17 badges → **Dispatch**.
  4. Aside: **SAR** case → **redaction before/after two-pane** (NEW) → AI detects PII, human releases.
  5. Aside: **Published information** (NEW) → "we don't even open a case — it's already published."
  6. Close on **Reporting** → "and here's the governance and cost story for the buyer."
- **Decision points (HITL, emphasised throughout)**: every AI output is confirmed by a human; synthetic data is demo-marked.
- **Success**: one continuous narrative, an obvious flagship moment, nothing broken/accidentally fake. (Addresses "convince a risk-averse SLT it won't make ungoverned decisions".)

---

## Journey ↔ key-use-case coverage (gaps to close in this build)

| Step | Page | Covered today? | This build |
|---|---|---|---|
| Prioritise by complexity | Cases | partial (chip only) | **Task 3** adds the "how it's calculated" tooltip |
| Draft response | Case detail | yes (Studio embedded) | **Task 2** promotes it to full-width for clarity |
| Reviews & ICO in the case flow | was `/review`, `/escalations` | separate pages | **Task 4** moves them into Cases (tabs) |
| "Already published" deflection | none dedicated | gap | **Task 5** new Published information section |
| SAR redaction before/after | panel exists | single-pane | **Task 6** before/after two-pane |
| Cost per FOI for the buyer | none | gap | **Task 7** cost-of-processing in Reporting |

Deferred (pre-deploy gate): xo-audit Phases 3–5 turn each journey step into a Given/When/Then story with a UI signal, then a Playwright + visual-theme sweep gates deployment.
