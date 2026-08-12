# FOI Sentinel — User Stories & Acceptance Criteria (xo-audit, Phase 2)

Given/When/Then stories per persona × key use case. Each names the **UI signal** Playwright asserts (Phase 4). Stories tagged **[KEY]** are gate-blocking; **[ADV]** are advisory.

Personas: [PERSONAS.md](PERSONAS.md). Harness: `SNOWFLAKE_CONNECTION_NAME=<your-connection> npm run dev` (in `08_react_app`) → http://localhost:3000.

---

## End-user

### US-ENDUSER-01 [KEY] — Triage drives board priority
- **As** the FOI / Information Governance Officer
- **Given** open cases with differing complexity and sentiment from triage
- **When** I open the Cases board
- **Then** cards are ordered by a visible priority, and the highest-priority cards show a **HIGH** band
- **UI signal:** in the Kanban iframe, the first card in a phase shows a priority band pill; a HIGH-band card carries a red/`HIGH` pill and a complexity chip.

### US-ENDUSER-02 [KEY] — Priority is explained and overridable (HITL)
- **Given** I open a case
- **When** I read the case header
- **Then** I see a "Priority signals" strip (complexity / sentiment / urgency) with a one-line "set at triage" explainer and **Confirm priority** / **Override** controls
- **UI signal:** text "Priority signals" + buttons "Confirm priority" and "Override" visible in the case detail; clicking one writes a timeline event.

### US-ENDUSER-03 [KEY] — Precedent clean-match is usable
- **Given** a case similar to a past complaint-free response
- **When** I open the case
- **Then** I see the closest past clean response with a similarity % and a **Use this precedent / Reviewed** action
- **UI signal:** "Closest past clean response" panel + a percentage + a "Use this precedent" button.

### US-ENDUSER-04 [ADV] — Drag to advance a stage
- **Given** a card on the board
- **When** I drag it to another phase
- **Then** the case advances
- **UI signal:** card moves column. (Harness dnd may be unreliable → WAIVE + verify via the in-detail "Advance stage" control; manual human check.)

### US-ENDUSER-05 [KEY] — Compliant draft + audit trail
- **Given** a case needing a response
- **When** I generate a draft and open the Timeline tab
- **Then** the draft shows s.17 route checks and the timeline shows every AI + human action
- **UI signal:** "Internal review route" / "Commissioner route" badges + a populated Timeline dataframe.

## SAR officer

### US-SAR-01 [KEY] — SAR third-party redaction with per-span verify
- **As** the Data Protection / SAR Officer
- **Given** a SAR case (e.g. SAR-2026-0107) with internal docs containing third-party PII
- **When** I open the Redaction tab
- **Then** AI detects third-party names/addresses/phones/emails and I must verify each span before the redacted bundle is produced
- **UI signal:** original-vs-redacted view with placeholder tokens (e.g. `[NAME]`), per-span **Verify** controls, and a released-bundle action gated on verification.

## Service SPOC

### US-SPOC-01 [KEY] — Cases are assigned to the right person
- **As** the Service contact (SPOC)
- **Given** the caseload
- **When** I filter the board to **My cases**
- **Then** I see only cases assigned to me, with assignee shown on each tile
- **UI signal:** a "My cases" filter option + assignee initials/name on tiles + a case-detail assignee with reassign control.

## Senior reviewer

### US-REVIEWER-01 [ADV] — Escalation risk on exemptions
- **As** the Senior / Independent Reviewer
- **Given** a case with exemptions
- **When** I open Exemptions & public interest
- **Then** I see an escalation-risk panel grounded in published ICO/Cabinet Office stats
- **UI signal:** "Escalation risk" panel with an overturn-rate figure.

## Economic buyer

### US-BUYER-01 [KEY] — SLA story is visible and credible
- **As** the Monitoring Officer / SIRO
- **Given** the live caseload
- **When** I open the Command Centre
- **Then** I see in-time performance against the 90% regulator target, plus at-risk/overdue counts
- **UI signal:** KPI chips "NN% in time", "N at risk", "N overdue", and a statutory/target reference strip distinguishing target from actual.

### US-BUYER-02 [KEY] — Every AI step is human-checked and logged (defensibility)
- **Given** any AI suggestion (triage priority, redaction, draft)
- **When** I inspect a case timeline
- **Then** the AI action and the human confirm/override/verify are both recorded
- **UI signal:** Timeline rows showing ACTOR_TYPE = AI and HUMAN for the same case.

## Champion

### US-CHAMPION-01 [KEY] — Flagship moment: prioritisation + ★ match land
- **As** the Information Governance Manager
- **Given** I demo the board
- **When** I show prioritised tiles and a high-similarity case
- **Then** the priority ordering is obvious and a **★ NN% match** badge is visible on the tile
- **UI signal:** Kanban tile shows a `★ NN% match` badge; top-of-phase cards are the high-priority ones.

### US-CHAMPION-02 [KEY] — It's our council, not Bristol
- **Given** the deployed app
- **When** I look at the header, intake address and drafting
- **Then** the authority name reads "Exampleton Council" everywhere
- **UI signal:** header service line + Settings summary show "Exampleton Council"; no stray "Bristol" in user-facing chrome.

### US-CHAMPION-03 [ADV] — Settings look configured, not raw
- **Given** the Settings page
- **When** I open it
- **Then** config is grouped with friendly labels and typed inputs (not snake_case text boxes)
- **UI signal:** section headings (Authority identity / Cost limits / Statutory deadlines / Performance & automation) + a summary band.

---

## Coverage matrix (target)

| Use case \ Lens | End-user | Economic buyer | Champion |
|-----------------|----------|----------------|----------|
| Triage→board priority | US-ENDUSER-01/02 | US-BUYER-02 | US-CHAMPION-01 |
| Precedent clean-match | US-ENDUSER-03 | — | US-CHAMPION-01 |
| SAR redaction | US-SAR-01 | US-BUYER-02 | — |
| Drafting + audit trail | US-ENDUSER-05 | US-BUYER-02 | — |
| Settings / rename | — | — | US-CHAMPION-02/03 |
| Assignment / My cases | US-SPOC-01 | — | — |
| Command Centre SLA | — | US-BUYER-01 | — |
