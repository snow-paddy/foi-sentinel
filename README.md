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
- Deployed to **Snowflake SPCS App Runtime** as a Next.js application (`snow app deploy`).

## Documentation (source of truth)
The `docs/` folder is the authoritative project record:
- [Statement of Work](docs/STATEMENT_OF_WORK.md) — objective, problem, requirements, architecture.
- [Developer Guide](docs/DEVELOPER_GUIDE.md) — how to set up the back end and deploy the application.
- [Roadmap](docs/ROADMAP.md) — forward-looking enhancements (precedent grounding, complaint-route intelligence, training signal).
- [Data Sources & Provenance](docs/DATA_SOURCES.md) — every dataset, real vs synthetic, refresh, legal basis, where consumed.
- [Demo Storyboard](docs/DEMO_STORYBOARD.md) — walkthrough script.
- [Inventory](07_inventory/INVENTORY.md) · [Compliance Matrix](07_inventory/COMPLIANCE_MATRIX.md) — object inventory and legal traceability.

## Structure
```
00_bootstrap.sql  create the FOI database, schemas and FOI_WH warehouse
01_ddl/           schema, case model, config, bank holidays, lifecycle, SAR, officers, cost, collaboration
02_seed_data/     knowledge-base migration, demo caseload, calendar/deadlines view, WDTK load
03_cortex/        Cortex Search services
04_procedures/    working-day functions; stage engine, clock, cost, triage, response; web scrapers
07_inventory/     inventory + legal/compliance traceability matrix
08_react_app/     the Next.js application (deployed to SPCS App Runtime)
docs/             Statement of Work, Developer Guide, Roadmap, Data Sources, Demo Storyboard
notebooks/        back-end pipeline walkthrough; Cortex Analyst tooling
```

## Application sections
Command Centre, Cases (intake, triage, case workspace, response drafting and SAR redaction),
Connections & Security, Reporting, and the Knowledge Base.

## Deploy
The application deploys to Snowflake SPCS App Runtime. See the [Developer Guide](docs/DEVELOPER_GUIDE.md)
for the full setup: run the Snowflake back end in order, then `cd 08_react_app && snow app deploy`.
