# FOI Sentinel v2

AI-assisted **Freedom of Information case management** for UK local government, built on Snowflake.
A council-agnostic system that models the full FOI/EIR lifecycle (receipt → close → ICO), with
Cortex AI assisting at every stage and humans gating the legally sensitive decisions.

Default council: **Exampleton Council** (configurable in Settings). Precedent corpus: **11,420 real Camden Council FOI
responses**, plus real cross-authority data from **WhatDoTheyKnow (WDTK)** and the **GLA disclosure
log**. See [Data Sources](docs/DATA_SOURCES.md) for provenance.

## What's new vs v1
v1 was an intake **triage** tool. v2 is a full **case-management** system: each request becomes a
case that moves through 17 lifecycle stages, each with an owner and a statutory clock.

Headline improvements:
- Full lifecycle: validity (s.8), regime + SAR redirect, s.21 duplicate reuse, clock management,
  cost (4 activities), exemptions + PIT, redaction, drafting, QA, dispatch, publish, internal review, ICO.
- **Legal accuracy fixes:** EIR has no cost limit; bank-holiday-aware deadlines; £25/hr 4-activity cost;
  s.17(7)-compliant refusals; headline **% in 20 WD** SLA KPI.
- Council-agnostic via `COUNCIL_CONFIG`.
- Packaged for **SPCS** (repackageable as a Native App).

## Documentation (source of truth)
The `docs/` folder is the authoritative project record:
- [Statement of Work](docs/STATEMENT_OF_WORK.md) — objective, problem, requirements, architecture.
- [Roadmap](docs/ROADMAP.md) — forward-looking enhancements (precedent grounding, complaint-route intelligence, training signal).
- [Data Sources & Provenance](docs/DATA_SOURCES.md) — every dataset, real vs synthetic, refresh, legal basis, where consumed.
- [Demo Storyboard](docs/DEMO_STORYBOARD.md) — walkthrough script.
- [Inventory](07_inventory/INVENTORY.md) · [Compliance Matrix](07_inventory/COMPLIANCE_MATRIX.md) — object inventory and legal traceability.

## Structure
```
01_ddl/         schema, case model, config, bank holidays, lifecycle stages, WDTK model
02_seed_data/   knowledge-base migration, 54-case demo backlog, calendar/deadlines/view, WDTK load
03_cortex/      Cortex Search services
04_procedures/  working-day functions; stage engine, clock, cost, triage, response; web scrapers
05_app/         Streamlit app — sis_main.py + app_pages/
06_spcs/        SPCS container deployment (Dockerfile, spec, infra.sql, deploy.sh)
07_inventory/   inventory + legal/compliance traceability matrix
docs/           Statement of Work, Roadmap, Data Sources, Demo Storyboard
```

## App pages
Command Centre · Intake & Triage · Case Board · Case Workspace · Response & Refusal Studio ·
Internal Review & ICO · Performance Reporting · Sector Trends · Knowledge & Guidance ·
Admin & Config · About.

## Deploy
See `06_spcs/README.md`. In short: run `06_spcs/infra.sql`, then `./06_spcs/deploy.sh latest`,
then open the public endpoint URL.

> The same app also runs as Streamlit-in-Snowflake from `05_app/sis_main.py` (no container needed).
