# FOI Sentinel — User Journeys (xo-audit, Phase 1b)

End-to-end journeys per persona. Each maps **trigger/entry → steps & pages → decision points → exit/success**, and cross-references the acceptance stories in [USER_STORIES.md](USER_STORIES.md) and the personas (job-title-led) in [PERSONAS.md](PERSONAS.md).

Journeys describe the *path through the product*; stories assert the *signals at each step*. A journey is "covered" when each of its steps has at least one [KEY] story.

Pages referenced: **Command Centre**, **Cases** (board + case detail tabs: Priority signals · Precedent · Redaction · Exemptions · Timeline), **Settings**.

---

## J1 — FOI / Information Governance Officer: triage to defensible response
**Trigger:** New/open requests against the 20-working-day clock; officer starts their day.

1. **Entry — Cases board** (`/cases`). Filter to **My cases** to see only owned work (US-SPOC-01 mechanic). Cards are ordered by priority within each phase; HIGH band + complexity chip visible. → *US-ENDUSER-01*
2. **Decision — what to work next.** Officer reads the top-of-phase HIGH cards. *Decision point:* trust the AI ordering or not.
3. **Open a case.** Header shows the **Priority signals** strip (complexity / sentiment / urgency) with a "set at triage" explainer. *Decision point:* **Confirm priority** or **Override** (HITL) — either writes a timeline event. → *US-ENDUSER-02*
4. **Check for precedent.** "Closest past clean response" panel shows a similarity % and **Use this precedent / Reviewed**. *Decision point:* reuse the clean precedent or draft fresh. → *US-ENDUSER-03*
5. **Draft the response.** Draft shows s.17 route checks (internal review / Commissioner routes). → *US-ENDUSER-05*
6. **Advance the stage** by dragging the card (or the in-detail "Advance stage" control if dnd is unreliable). → *US-ENDUSER-04*
7. **Verify the audit trail.** Timeline tab shows every AI + human action for the case. → *US-ENDUSER-05 / US-BUYER-02*

**Exit / success:** Case advanced with a confirmed priority, a defensible draft, and a complete timeline — officer knew what to do next and why.

---

## J2 — Data Protection / SAR Officer: release own data, protect third parties
**Trigger:** A Subject Access Request (1 calendar month, DPA 2018) with internal docs containing third-party PII.

1. **Entry — Cases board**, open the SAR case (e.g. SAR-2026-0107).
2. **Open the Redaction tab.** AI detects third-party names/addresses/phones/emails and shows an original-vs-redacted view with placeholder tokens (e.g. `[NAME]`).
3. **Decision — per-span verify.** Officer must **Verify** each detected span; the released bundle is gated on verification (HITL). *Decision point:* accept, edit, or reject each span. → *US-SAR-01*
4. **Produce the redacted bundle** once every span is verified.

**Exit / success:** Requester's own data released; every third-party span was caught and human-verified before release — and logged. → *US-BUYER-02*

---

## J3 — Service contact (SPOC): receive and action the right cases
**Trigger:** A request needs a search/retrieval in the SPOC's service (Planning / Adult Social Care / Finance).

1. **Entry — Cases board**, filter **My cases**. Only cases assigned to this role appear; the assignee is shown on each tile. → *US-SPOC-01*
2. **Open an assigned case** to see what is needed and by when.
3. **Decision — is this mine / is it clear?** If misassigned, the case-detail **Reassign** control routes it to the correct role (assignee stored by name, displayed as a job title).
4. **Do the search** and hand back, advancing the stage.

**Exit / success:** SPOC works only their queue, with a clear statement of what's needed and the deadline.

---

## J4 — Senior / Independent Reviewer: second look on refusals
**Trigger:** A refusal or internal review on a case with exemptions.

1. **Entry — Cases board**, open the case under review.
2. **Open Exemptions & public interest.** An **Escalation-risk** panel shows an overturn-rate figure grounded in published ICO/Cabinet Office stats. *Decision point:* uphold, vary, or release. → *US-REVIEWER-01*
3. **Read the Timeline** for the full decision history (AI + human actions). → *US-BUYER-02*

**Exit / success:** Reviewer gives an independent, evidence-grounded second look with the full history and escalation risk in view.

---

## J5 — Monitoring Officer / SIRO (economic buyer): prove compliance, prove defensibility
**Trigger:** Board/ICO accountability — "are we on target, and is the AI safe?"

1. **Entry — Command Centre** (`/`). KPI chips show **NN% in time** against the 90% regulator target, plus **at risk** / **overdue** counts, with a statutory/target reference strip distinguishing target from actual. → *US-BUYER-01*
2. **Decision — exposure.** Buyer reads in-time performance vs target and at-risk volume. *Decision point:* where to direct resource / escalate.
3. **Spot-check defensibility.** Open any case → Timeline shows ACTOR_TYPE = AI and HUMAN for the same case (every AI step has a human check). → *US-BUYER-02*

**Exit / success:** Buyer can show the board they're on-target and demonstrate every AI step is human-checked and logged.

---

## J6 — Information Governance Manager (champion): land the internal demo
**Trigger:** Selling FOI Sentinel internally; the demo must land cleanly.

1. **Entry — Cases board.** Show prioritised tiles; the ordering is obviously priority-driven. → *US-CHAMPION-01*
2. **Flagship moment.** Point to a tile carrying a **★ NN% match** badge (precedent clean-match). *Decision point:* this is the "win the room" beat. → *US-CHAMPION-01*
3. **Council identity check.** Header, intake address and drafting all read **"Exampleton Council"** — no stray placeholder authority name. → *US-CHAMPION-02*
4. **Settings.** Open Settings: config is grouped with friendly labels and typed inputs (Authority identity / Cost limits / Statutory deadlines / Performance & automation) + a summary band — looks configured, not raw. → *US-CHAMPION-03*

**Exit / success:** The board prioritisation and the ★ match badge win the room; nothing is broken and the council name is ours.

---

## Journey ↔ story coverage

| Journey | Persona (role) | Stories |
|---------|----------------|---------|
| J1 Triage→response | FOI / IG Officer | US-ENDUSER-01/02/03/04/05, US-BUYER-02 |
| J2 SAR redaction | Data Protection / SAR Officer | US-SAR-01, US-BUYER-02 |
| J3 Assignment | Service contact (SPOC) | US-SPOC-01 |
| J4 Review | Senior / Independent Reviewer | US-REVIEWER-01, US-BUYER-02 |
| J5 Compliance | Monitoring Officer / SIRO | US-BUYER-01/02 |
| J6 Demo | IG Manager / Transformation Lead | US-CHAMPION-01/02/03 |
