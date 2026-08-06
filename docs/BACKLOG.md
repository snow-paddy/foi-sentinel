# FOI Sentinel v2 — Backlog

Single source of truth for **open and deferred work** on the current release. This reconciles
the page-by-page audit findings, deploy/reproducibility hygiene, and waived checks into one list.
Forward-looking **feature** ideas live separately in [ROADMAP.md](ROADMAP.md) and are not repeated here.

- **Last reviewed:** 2026-06-29 (page-by-page user-flow audit)
- **Gate status:** PASS (functional + visual). See [../audit/AUDIT_REPORT.md](../audit/AUDIT_REPORT.md).
- **Legend:** P1 = fix before next demo · P2 = polish when convenient · P3 = nice-to-have

## Recently closed (this session)

| Item | Notes |
|------|-------|
| Command Centre KPI "buttons" looked peculiar | Redesigned the 4 drill chips from loud solid pills to **soft tinted stat chips** (status dot + label + `›` drill affordance); single line, no wrap. `05_app/app_pages/_shared.py`. |
| Active filter segment was invisible | After drilling into a filtered Cases view, the active segment looked identical to inactive ones. Added the `segmented_controlActive` selector → active segment now accent-blue/bold. `_shared.py`. |
| Stray "Bristol" in user-facing case data | FOI-2026-0109 request text + board title, and requester orgs on EIR-0104 / FOI-0106 / FOI-0119 → Exampleton-consistent. Fixed in live DB **and** seed source (`02_seed_cases.sql`), DDL `COUNCIL_NAME` default, intake placeholder, README. (US-CHAMPION-02.) |

## Open — visual / UX polish (non-blocking)

| Pri | Page | Finding | Suggested fix |
|-----|------|---------|---------------|
| P2 | Sector Trends | Exampleton's own bar is not highlighted among the grey peer bars, so the "how do we compare" story is weaker than it could be. | Render Exampleton's bar in `--accent`; keep peers grey. |
| P2 | Case detail | The `RUNNING` status badge (top of detail) is ambiguous on its own — "running" what? | Relabel to "Clock running" (and "Clock stopped" / "Extension" for the other states). |
| P3 | About · Email Intake · Triage Learning | Real data-provenance names appear in copy: "11,420 real **Camden** FOI responses", **GLA**/london.gov.uk, **WhatDoTheyKnow**, and "our **HM Land Registry** project". Honest on a technical/architecture page, but a champion demoing *Exampleton* may want these genericised or framed purely as provenance. | Decide per audience: keep as provenance, or soften the cross-project reference ("a prior public-sector deployment"). |

## Open — reproducibility / deploy hygiene

| Pri | Item | Notes |
|-----|------|-------|
| P1 | `FOI_CASE.SUBJECT` (board card titles) is populated **out-of-band** | The column is not created or populated by any numbered DDL/seed script — only `email_intake.create_case` writes it at runtime. A fresh rebuild from `01_ddl` + `02_seed_data` leaves seeded card titles NULL → "Untitled request". Capture the SUBJECT enrichment (likely an `AI_COMPLETE` summarise over `REQUEST_TEXT`) into a numbered seed step so the board is reproducible. |
| P3 | `01_ddl/02_wdtk_model.sql` comment "(Bristol vs peer medians)" | Cosmetic. The benchmark *home* authority is intentionally mapped from the real WDTK slug `bristol_city_council` (`sector_trends.py`) — real public stats shown under the Exampleton name. Not user-visible; leave the mapping, optionally update the comment. |
| P1 | Propagate harness fixes to SPCS | `deploy.sh` regenerates `06_spcs/app_pages` from `05_app` via `cp -R`, so the chip + filter CSS ships automatically on `./deploy.sh latest`. Just re-run deploy; do not hand-edit `06_spcs`. |

## Deferred / waived checks (require the real SPCS deploy)

The harness cannot drive these (OAuth/passkey-gated, or automation limits). Run them manually post-deploy:

- [ ] Drag a card between phases → confirm it advances and persists after refresh (US-ENDUSER-04, waived in automation).
- [ ] Floating AI assistant answers on each page.
- [ ] "Generate compliant draft" produces s.17-compliant text with internal-review + ICO routes.
- [ ] "Exampleton Council" appears in header, intake To-address, and drafting salutations.
- [ ] Precedent refresh updates the "★ match" badges.

## Where things live

- **Feature roadmap (future capabilities):** [ROADMAP.md](ROADMAP.md)
- **Audit evidence + gate decision:** [../audit/AUDIT_REPORT.md](../audit/AUDIT_REPORT.md)
- **Personas / user stories (audit lens):** [PERSONAS.md](PERSONAS.md) · [USER_STORIES.md](USER_STORIES.md)
- **Data provenance:** [DATA_SOURCES.md](DATA_SOURCES.md)
