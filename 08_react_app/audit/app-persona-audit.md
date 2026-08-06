# FOI Sentinel v2 — Persona QA Audit (every asset clicked)

**Date:** 30 Jun 2026 · **Method:** live walkthrough of `http://localhost:3100` against real `FOI.FOI_SENTINEL_V2` data, clicking/​exercising every interactive asset on every page. Findings cross-checked against the DB. Assessed through the three g-stack persona lenses in `audit/personas.md` (End-user / Economic buyer / Champion).

**Scope covered:** 10 real pages + case detail (FOI + SAR variants) + 5 redirects + global nav/theme. Mutating actions on demo cases were tested where reversible and **fully reverted** (verified); irreversible-on-demo actions were confirmed *wired* without firing. No demo data left altered.

---

## 1. Headline verdict

The app is in strong shape. Both flagship "moments that matter" work end-to-end against live Cortex, every page renders real data, and the human-in-the-loop framing is consistent and honest. One genuine display bug (funnel under-count), one LA-language consistency slip (About page), and a handful of low-priority polish/enhancement items.

| Lens | Verdict | One-line |
|---|---|---|
| **End-user (FOI/IG Officer)** | ✅ Strong | Board → suggest-answer → s.17 draft → redaction → cost → s.21 deflection all work; only blemish is a cosmetic funnel count. |
| **Economic buyer (Head of Legal/SIRO)** | ✅ Strong | Reporting (timeliness vs 90% SLA, s.12 cost-of-processing), Triage Learning (63%→100%), Reviews & ICO posture, sector benchmarks + refusal drivers all credible. |
| **Champion (Transformation Lead)** | ✅ Strong | Intake→triage→board→draft→dispatch narrative is continuous, demo-marked honestly; About-page stage-name inconsistency is the one thing that "looks off". |

---

## 2. Prioritised findings

### P1 — Command Centre funnel under-counts open cases (32 shown vs 33 actual)
- **Symptom:** the two-tier funnel totals 32 open across phases (Receipt 3 · Triage 12 · Retrieval 7 · **Assess 4** · Sign-off 4 · Challenge 2); the KPI regime cards and the Board both correctly show **33**. The Assess phase shows **4** but should be **5** (Considering exemptions 2 + Public interest test 2 + Redaction 1).
- **Root cause:** `getPipeline()` computes `ON_TRACK = SUM(IFF(NOT(RAG='RED' OR WD_REMAINING<0),1,0))`. Case **FOI-2026-0124** (PIT) has a NULL `STATUTORY_DEADLINE` → NULL `WD_REMAINING` and `RAG='GREEN'`. `NOT(FALSE OR NULL)` → NULL → `IFF(NULL,…)` counts **0** in *both* on-track and at-risk, so the case vanishes from the funnel total. The Board is unaffected because it iterates cases rather than this aggregate.
- **Fix (one line):** `ON_TRACK = SUM(IFF(COALESCE(RAG='RED' OR WD_REMAINING<0, FALSE), 0, 1))` — or compute on-track as `total − at_risk`.
- **Secondary data note:** FOI-2026-0124 is a *real* (non-synthetic) open PIT case with **no statutory deadline set** and clock RUNNING. A PIT case should carry a 40-WD deadline; worth seeding one so the case shows a clock.
- **Persona impact:** End-user (the board they trust shows a slightly wrong headcount); Champion (a careful demo viewer can spot 32≠33).

### P2 — About page lifecycle uses old technical stage names (LA-language slip)
- The `/about` "lifecycle (17 stages)" list uses developer-style labels that disagree with the LA-friendly names used **everywhere else** (board, funnel, admin, case stage-picker):

  | About page says | Rest of app says |
  |---|---|
  | 3. Regime classification | Request categorisation (FOI / EIR / SAR) |
  | 7. Allocation | Allocated to service |
  | 10. Exemption identification | Considering exemptions |
  | 14. QA / sign-off | Sign-off & approval |
  | 16. Disclosure log publish | Publish |
- **Why it matters:** directly against the standing *"always prefer Local Authority language"* preference, and it's the one place a champion's audience sees two vocabularies for the same process.
- **Fix:** align the `/about` list to the LA names (single source: `lib/lifecycle.ts` stage labels).

### P3 — Escalation generator: backend confirmed, UI click unverified
- `/api/escalation` **works** — verified by curl happy-path (HTTP 200, creates internal-review + advances to REVIEW; I reverted it fully). But the on-screen "Generate escalation" button (Reviews & ICO → *Simulate an escalation*) produced no success/error message and no DB write across two automated clicks.
- **Most likely** an automation/iframe event quirk on that always-rendered island (other buttons, incl. the adjacent draft generator, fired fine), **not** a confirmed app bug. **Action:** a 5-second manual click in a real browser to confirm the green "…generated. Case reopened." appears.

### P4 — Filter chips lack `aria-current` (a11y consistency)
- On `/cases`, the risk/regime chips (At risk / Overdue / FOI / EIR / SAR) signal active state by colour/class only; the view toggle (List / Board / Reviews & ICO) correctly sets `aria-current="page"`. Add `aria-current` to the chips for screen-reader parity.

### P5 — Legislation library has no outbound deep-links (enhancement)
- `/guidance` → Legislation library renders 90+ static reference cards (S.21, S.23, …) grouped by Absolute / Qualified / Procedure with good plain-English summaries, but no links to legislation.gov.uk / ICO guidance. Linking each section would help the operator jump to source. Low priority — summaries are self-contained.

### P6 — Info / acceptable-as-is
- **Precedent search relevance is corpus-limited:** WDTK is only 54 rows, so some queries (e.g. "temporary accommodation for homeless families") surface loosely-related WDTK hits; Camden's large corpus carries relevance. Fine for demo.
- **Admin "External data sources"** lists the 4 sector corpora (GLA 38, Camden 11,420, WDTK events 54, WDTK authorities 16) but not the internal Council-policy corpus used in suggest-answer citations [S8]/[S9]. Minor completeness.
- **ICO posture** lives in Cases → Reviews & ICO, not in Reporting — a buyer might look for it on the Reporting page first.

---

## 3. Per-page asset checklist (every interactive element)

Legend: ✅ works · ⚠️ note/finding · 🔒 wired, deliberately not fired (irreversible demo mutation)

### Command Centre `/`
| Asset | Result |
|---|---|
| Nav: Command Centre / Cases / Intake / Knowledge Base | ✅ |
| KPI links: 9 at risk → `?risk=atrisk` (9), 4 overdue, 27 FOI, 5 EIR, 1 SAR | ✅ counts match DB (33 total / 9 / 4) |
| Two-tier funnel: 6 phase rows expand | ✅ |
| Funnel nested stage links → `/cases?stage=…` (LA-named) | ✅ |
| Funnel total | ⚠️ **P1** shows 32, should be 33 |
| "What people are asking about" word cloud | ✅ display-only (real corpus terms) |
| Requester patterns table + "Show all 10 / Show fewer" | ✅ shows volume, avg tone, s.14 count |

### Cases `/cases`
| Asset | Result |
|---|---|
| View toggle: List / Board / Reviews & ICO | ✅ (sets `aria-current`) |
| Risk filters: All open / At risk / Overdue | ✅ at-risk verified = 9 |
| Regime filters: FOI / EIR / SAR | ✅ (⚠️ **P4** no `aria-current`) |
| 33 case rows → `/cases/[ref]` | ✅ |
| **Board** kanban: 6 phase columns, header 33/9/4 | ✅ correct (board counts right) |
| Board cards: click-to-open | ✅ `role=button`, `tabindex=0`, accessible |
| Board cards: drag-to-advance | 🔒 dnd-kit wired → `/api/advance-stage` |
| Board card detail: ref, complexity band, regime·stage·days-left, SPOC, Cx, sentiment, % precedent match | ✅ |
| **Reviews & ICO** sub-tabs: Internal reviews / ICO complaints / Disclosure log | ✅ all three |
| Internal review: Uphold / Partially uphold / Overturn | 🔒 outcome-letter actions wired |
| ICO complaint: status dropdown + decision-notice URL + Record decision | 🔒 wired |
| Disclosure log: case picker + Topic + Publish (s.19) | 🔒 wired |
| Escalation generator: case/type/grounds + Generate escalation | ⚠️ **P3** endpoint 200, UI click unverified |

### Case detail `/cases/[ref]` (FOI-2026-0095 + SAR-2026-0107)
| Asset | Result |
|---|---|
| **Suggest an answer** (Cortex) | ✅ **flagship** — grounded cited draft; SOURCES across WDTK [S1-3], GLA [S4-5], **Camden [S6-7]**, Policy [S8-9], all with working external links |
| Suggestion: Re-draft / Search the web | ✅ present (web-search → external EAI) |
| **Studio** outcome toggle: Released in full / Withheld under exemptions / Withheld-not held / Already accessible | ✅ LA-friendly labels |
| **Generate compliant draft** (Cortex) | ✅ **flagship** — wrote PARTIAL draft (verified in DB, then deleted); renders **s.17 badges: Exemption stated · Internal review · ICO route** |
| Draft: Save as final / Dispatch (close case) | 🔒 wired |
| **Cost estimate** → Recalculate cost | ✅ opens s.12 estimator (Determine/Locate/Retrieve/Extract @ £25/h) |
| **SAR redaction** (SAR case): Detect personal data (AI) ×N | ✅ s.40/DPA framing; one doc shows completed "Released · 9/9 redacted" |
| Stage picker (Click to change stage) | 🔒 17 LA-named stages, current preselected |
| Clock: reason dropdown + Stop clock | 🔒 wired → `/api/clock` |
| Precedent match → Use this precedent | 🔒 advances stage |
| AI triage → Mark reviewed | 🔒 wired |
| The request / Case history / Details / How AI triaged | ✅ display |

### Intake `/intake`
| Asset | Result |
|---|---|
| Subject / Message fields, tone selector, "Seed topic from Camden corpus" checkbox | ✅ |
| **Generate with AI** | ✅ regenerated Camden-seeded request (subject + body) |
| **Analyse message** (live Cortex triage) | ✅ **flagship** — regime/priority/complexity + reasons/tone/departments/effort; "advisory — a human officer confirms" |
| Send to FOI inbox (create case) | 🔒 wired; "-D reference + Demo intake badge" |
| Clear demo cases | 🔒 wired |
| "How this works in production" explainer | ✅ honest (Graph/Power Automate → stage → Snowpipe → Cortex) |

### Knowledge Base `/guidance`
| Asset | Result |
|---|---|
| Tabs: Guidance & precedent / Published information / Legislation library | ✅ |
| Guidance search + 8 quick chips (s.12, s.40, s.14, EIR, s.43, PIT, internal reviews, s.21) | ✅ returns policy guidance + WDTK precedent (accurate s.12 content) |
| Published: s.21 deflection "Check" | ✅ AI-drafted s.21 reply, cites Cabinet decision [S1], human-confirm |
| Published: document list (Cabinet/HR/PC decisions) | ✅ expandable |
| Legislation library | ✅ static cards; ⚠️ **P5** no deep-links |

### Reporting `/reporting` (display-only — board report)
| Asset | Result |
|---|---|
| Timeliness vs SLA: 85.7% / 90% (−4.3) | ✅ aligned to s.45 CoP 8.5 |
| Cost of processing: avg £240/FOI, 9.6h, median £225, annualised £12,960, 0% over s.12 | ✅ honest Frontier Economics benchmark note |
| Timeliness by regime / Outcomes (16/4/1) / Monthly volume / Dept workload | ✅ 6 SVG charts, real data |

### Sector Trends `/sector-trends`
| Asset | Result |
|---|---|
| Disclosure rate vs peers / Overdue rate vs peers / Exemption-theme mix | ✅ benchmarks |
| "Why requests get refused across the sector" (refusal drivers) | ✅ s.12×6 · s.43×4 · s.21×2 with example reasons |
| GLA disclosure-log spotlight (38) + Camden spotlight (11,418) | ✅ working external links |
| Precedent search (WDTK + GLA + Camden) | ✅ merged results; ⚠️ **P6** WDTK relevance corpus-limited |

### Triage Learning `/learning` (display-only)
| Asset | Result |
|---|---|
| Confidence-routed triage: 7 auto-accepted (13%) / 47 to human (87%) @ 90% | ✅ |
| Fine-tune comparison: base mistral-7b 63% vs TRIAGE_TUNED 100% (n=16) | ✅ buyer trust metric |

### Admin `/admin`
| Asset | Result |
|---|---|
| Identity / Cost limits (450/18/25) / Deadlines (20/40) / Performance (90/0.90) fields | ✅ |
| Save configuration | 🔒 wired (config write, not fired) |
| Departments in use / External data sources (incl Camden 11,420) / Lifecycle stages (17, AI-assisted/human-gated) | ✅ |

### About `/about` (display-only)
| Asset | Result |
|---|---|
| Lifecycle (17 stages) | ⚠️ **P2** technical names, not LA names |
| AI assists / Humans decide / Snowflake features / Legal basis | ✅ |

### Redirects & global
| Asset | Result |
|---|---|
| `/board` → `/cases?view=board` | ✅ |
| `/studio` → `/cases` | ✅ |
| `/review` → `/cases?view=reviews` | ✅ |
| `/escalations` → `/cases?view=reviews` | ✅ |
| `/published` → `/guidance?tab=published` | ✅ |
| Nav "More" menu (Insight: Reporting, Sector Trends · System: Triage Learning, Admin, About) | ✅ grouped |
| Theme toggle (light ⇄ dark) | ✅ both directions |

---

## 4. Persona walkthrough

**End-user — "I open the board and instantly know what to action next; I draft a s.17 response in one click and confirm it."** Delivered: Board prioritises by RAG/clock/complexity with precedent-match badges; one click each gives a cited suggested answer and a s.17-complete refusal draft (badges green); SAR redaction is detect→verify→release with a worked example; s.12 cost and s.21 deflection are both present. Only friction: the Command-Centre headline count is off by one (P1) — but the board they actually work from is correct.

**Economic buyer — "Timeliness vs our 90% SLA, ICO posture, refusal completeness and cost per FOI are visible and tied to a standard."** Delivered: Reporting shows timeliness vs 90% (aligned to s.45 CoP 8.5), modelled cost-of-processing on the s.12 basis with an honest external benchmark, and outcomes; Triage Learning proves tuned-vs-base (63%→100%); Sector Trends adds peer benchmarks + refusal drivers. Minor: ICO posture is under Cases → Reviews & ICO rather than on Reporting.

**Champion — "End-to-end story flows, the moment is obvious, synthetic data is honestly labelled."** Delivered: Intake → live triage → board → draft → dispatch is continuous; every AI output says "advisory / officer confirms"; demo cases are isolated (`-D` reference + "Demo intake" badge + Clear demo cases); the production explainer is honest about the simulated steps. The one thing that breaks the polish: About-page stage names disagree with the rest of the app (P2).

---

## 5. Appendix — deliberately not fired (to keep demo data pristine)
Advance-stage (board drag, Use this precedent, Click-to-change-stage, Internal review/ICO), Stop clock, Mark reviewed, Save as final, Dispatch, Record ICO decision, Publish to disclosure log, Send to FOI inbox, Clear demo cases, Save configuration. All confirmed *present and wired*; the escalation endpoint was additionally curl-tested on the happy path and reverted (see P3). FOI-2026-0095 test draft and FOI-2026-0101 escalation were both created during testing and **deleted/reverted** — DB verified back to baseline.
