# Audit Report — SAR reimagining + on-camera defect gate (2026-07-07)

**Type:** Delta re-audit (routing: "re-audit after changes") + pre-deploy gate.
**Scope:** the SAR queue→identity→workspace reimagining, plus regression spot-checks on the three defects fixed this session (audit-chain false positive, S.17 disclosure badge false negatives, markdown-table email). Not a full 15-page battery — prior audits cover the unchanged surface.
**Harness:** `http://localhost:3000` (Next dev), agentic-browser drive. **Theme:** light (production-pinned), harness matches.
**Personas / stories:** reused `audit/personas.md`; new SAR stories `US-SAR-01..03` added to `audit/user_stories.md`.

---

## Per-story results

| ID | Story (key use case) | Signal asserted | Result | Evidence |
|----|----|----|----|----|
| US-SAR-01 [KEY] | SAR queue is an officer's inbox, not one person | ≥2 rows, pseudonymised requesters, generic intro, no data-subject name on the queue | **PASS** | `/sar` screenshot: 3 rows (0107/0151/0152), "Anonymous Resident"/"Withheld pending ID", one-month due dates, intro names no individual |
| US-SAR-02 [KEY] | Named subject appears only after identity verification | "Identity verified" badge + "received as Anonymous Resident" + verified subject + 5-source records | **PASS** | `/sar?case=SAR-2026-0107`: header resolves to James Whitfield (claim HB-2026-55821), running one-month clock, federated 5-source table with third-party scan chips |
| US-SAR-03 [KEY] | Unverified request leaks no subject, spends no Cortex | awaiting-ID notice, no subject name, no findings/records table | **PASS** | `/sar?case=SAR-2026-0151`: "Awaiting identity verification" state, falls back to queue, no subject, no records; `getSarData` early-returns before any Cortex call |
| US-EB-04 [KEY] | AI evidence & audit trail — "Chain verified" | "Chain verified" badge, no tamper/broken state | **PASS** | `/cases/FOI-2026-0115` DOM: `chainVerified=true, chainBroken=false`. DB verifier (DECIDED_AT,SEQ order): N=10, links_ok=10, ALL_OK=TRUE |
| US-EU-03 (badge) [KEY] | S.17 disclosure badges honest | DISCLOSURE ≠ exemption-stated; refusal/partial = exemption-stated | **PASS** | DB: 25/25 DISCLOSURE with S17_EXEMPTION_STATED=FALSE; 6/6 REFUSAL/PARTIAL/S21_REUSE with =TRUE |
| Email tables | Grounded letter has no markdown tables/pipes | plain-prose letter body | **DEFERRED** | Prompt hardened (no tables/pipes/headings/asterisks/bullets); only provable on a fresh live send — verify during Phase 2 re-record |

## Visual / theme sweep (Phase 4b) — changed pages

| Page | Dark-surface probe | Contrast / clipping | Result |
|----|----|----|----|
| `/sar` (queue) | none — light canvas, white cards | readable; queue table clean | **PASS** |
| `/sar?case=SAR-2026-0107` (verified) | none | header chips, records table legible | **PASS** |
| `/sar?case=SAR-2026-0151` (awaiting-ID) | none | notice legible | **PASS (after fix)** |

### Defect found & fixed during this audit
- **Missing space in awaiting-ID notice** — rendered "Request SAR–2026–0151cannot be opened" (glued). JSX whitespace edge case between a `font-mono` `<span>` and following text. **Fixed** in `app/sar/page.tsx:118` with explicit `{" "}`; re-verified on screen ("…0151 cannot be opened").

## Persona coverage matrix (delta)

| Lens | Key use case touched | Result |
|----|----|----|
| End-user (FOI/SAR Officer) | UC5 SAR — queue, verify, workspace, redaction reachable | PASS |
| Economic buyer (IG Manager) | Auditability (chain), disclosure defensibility (S.17 badges) | PASS |
| Champion (demo) | SAR reads as a real caseload, not one named person; production illusion holds | PASS |

---

## Gate decision: **PASS (deployable)**

- Every key-use-case SAR story (US-SAR-01/02/03) PASS.
- Chain false positive and S.17 badge false negatives regression-clean at DB + UI.
- Visual sweep clean on all three SAR states after the whitespace fix.
- One item **deferred not blocking**: email-table prompt hardening is provable only on a live send — confirm during the Phase 2 re-record before treating it as closed.

**Deploy note:** SAR reimagining + the whitespace fix are NOT yet on SPCS (deferred per batching preference). This report clears them for the batched deploy.
