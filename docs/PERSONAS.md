# FOI Sentinel — Personas (xo-audit, Phase 1)

The audit covers three lenses. Each is instantiated below for a UK local-government FOI / information-governance context.

Personas are identified by **job title / role, not personal name** — the organisation's users read as roles throughout the app and the methodology (personal names bias the audit, date quickly, and obscure the role's goals). Each persona carries an explicit **problem statement** (the job to be done / what is broken today) that the goals and use cases must address. These personas drive the user stories in [USER_STORIES.md](USER_STORIES.md), the journeys in [USER_JOURNEYS.md](USER_JOURNEYS.md), and the in-app case-assignment workflow (the `PERSONA` column of `FOI_OFFICER` holds these titles).

---

## Lens 1 — End-user (the operators)

| Role | Problem statement (today) | Context | Goals | Key use cases | What success looks like |
|------|---------------------------|---------|-------|---------------|-------------------------|
| **FOI / Information Governance Officer** (primary) | "I'm juggling 20–30 live requests against a 20-working-day clock with no reliable way to know which to work next — so the risky ones surface late." | Handles ~20–30 live requests against the statutory clock | Triage fast, prioritise the risky ones, draft defensibly, never miss a deadline | Triage→board prioritisation, drafting + audit trail, assignment | "I open the board and instantly know what to work on next and why" |
| **Data Protection / SAR Officer** | "Releasing a requester's own data risks exposing third-party personal data; manual redaction is slow and easy to get wrong." | Owns Subject Access Requests (1 calendar month, DPA 2018) | Release the requester's own data while protecting third parties | SAR AI redaction | "Third-party names are caught and I verify each one before release" |
| **Service contact (SPOC)** | "Requests land on me with no clear statement of what's needed or by when, so searches stall and deadlines slip." | Sits in Planning / Adult Social Care / Finance; does the search & retrieval | Be told clearly what is needed and by when | Allocation / assignment, search | "I'm assigned the right cases and see what's expected" |
| **Senior / Independent Reviewer** | "On a refusal or internal review I can't quickly see the full decision history or the escalation risk, so the independent second look is shaky." | Conducts internal reviews; liaises with the ICO | Independent second look on refusals | Drafting + audit trail, reviews & ICO | "I can see the full decision history and the escalation risk" |

## Lens 2 — Economic buyer (the funder)

| Role | Problem statement (today) | Context | Goals | Key use cases | What success looks like |
|------|---------------------------|---------|-------|---------------|-------------------------|
| **Monitoring Officer / SIRO / Head of Information Governance** | "I'm accountable for statutory compliance and ICO exposure but can't show the board we're on-target, and I can't prove every AI step was human-checked." | Accountable for statutory compliance and ICO exposure; signs off the budget | Reduce regulatory/reputational risk, hit the 90%-in-20-working-days target, defensible audit trail, control cost-per-request | Command Centre SLA story, drafting + audit trail, SAR redaction defensibility | "I can show the board we're on-target and every AI step is human-checked and logged" |

## Lens 3 — Champion (the internal advocate)

| Role | Problem statement (today) | Context | Goals | Key use cases | What success looks like |
|------|---------------------------|---------|-------|---------------|-------------------------|
| **Information Governance Manager / Transformation Lead** | "I have to sell this internally, but the demo has to land cleanly — one broken screen or stray placeholder council name and I lose the room." | Between the officers and the buyer; runs the demo internally | A demo that lands: a clear flagship moment, nothing broken or accidentally fake | Triage→board prioritisation, precedent clean-match (flagship), Settings/rename | "The board prioritisation and the ★ match badge win the room; the council name is ours, not a placeholder" |

---

### Key use cases (the moments that matter)
1. Triage → board prioritisation (complexity + sentiment → priority band, HITL confirm/override)
2. Precedent clean-match (★ NN% match to a past complaint-free response + HITL use)
3. SAR AI redaction (detect third-party PII → per-span verify → redacted bundle)
4. Compliant drafting + audit trail (s.17 routes, full timeline)
5. Settings / council-agnostic config + rename (Exampleton Council)
6. Assignment / "My cases" (operational workflow)
7. Command Centre KPI / SLA story (for the economic buyer)
