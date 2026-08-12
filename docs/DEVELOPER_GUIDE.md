# FOI Sentinel

An AI-assisted case-management application for UK local-government information rights, built on Snowflake. FOI Sentinel handles Freedom of Information (FOI), Environmental Information Regulations (EIR) and Subject Access Requests (SAR) end-to-end: intake, triage, statutory-deadline tracking, grounded response drafting and SAR redaction, with a hash-chained audit trail.

The application runs as a Next.js service on **Snowpark Container Services (SPCS)** and does all of its reasoning with **Snowflake Cortex** (Cortex Search, Cortex Analyst and the AI SQL functions). No data leaves Snowflake.

---

## Overview

### What you will build

- A containerised **Next.js** application deployed to Snowflake via SPCS App Runtime.
- A governed Snowflake back end: case model, knowledge bases, precedent-matching, SAR redaction tables and Cortex Search services.
- A working demonstration of an FOI/SAR workflow driven by Cortex, from a citizen request through to an officer-approved, fully audited disclosure.

### What you will learn

- How to stand up a Cortex-powered data application on SPCS with `snow app deploy`.
- How Cortex Search grounds retrieval across multiple internal sources.
- How the AI SQL functions (`AI_CLASSIFY`, `AI_FILTER`, `AI_EXTRACT`, `AI_COMPLETE`, `AI_SIMILARITY`) triage, prioritise and draft responses.
- How SAR redaction combines `AI_PARSE_DOCUMENT`, `AI_EXTRACT` and `AI_REDACT` with an officer-in-the-loop review.

### Architecture

```
 Microsoft 365                Snowflake                         Governed output
 -------------                ---------                         ---------------
 Outlook (Graph)   ─┐                                           Officer review
                    ├─▶  FOI.FOI_SENTINEL_V2  ──▶  Cortex AI ──▶  and approval
 SharePoint         │      case model, KB,          Search /        │
 (Openflow)        ─┘      SAR tables, audit        Analyst /       ▼
                                                    AI SQL        Disclosure log
                          Next.js app on SPCS  ◀────────────┘     (hash-chained)
```

The application queries Snowflake as its own service identity (owner's rights) using the SPCS session token. All AI runs in-database.

---

## Prerequisites

- A non-trial Snowflake account in a region with native Cortex (Cortex Search, Cortex Analyst and the AI SQL functions), and access to the **ACCOUNTADMIN** role for the initial setup.
- The [Snowflake CLI](https://docs.snowflake.com/en/developer-guide/snowflake-cli/index) (`snow`) installed and a connection configured in `~/.snowflake/config.toml`.
- [Node.js](https://nodejs.org/) 20 LTS or later and npm (Next.js 16 requires a current LTS).
- The ability to create a database and warehouse. Step 1 creates `FOI` and `FOI_WH` for you via `00_bootstrap.sql` at the repository root.
- Generative Cortex features and any fine-tuned models require **cross-region inference** in regions that do not host them natively (for example, London provides extract and embed only). If a Cortex call reports a model is unavailable in your region, enable it with `ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = '<value>'` (a commented line is included in `00_bootstrap.sql`).

Optional, for the live Outlook and SharePoint integrations:
- A Microsoft 365 tenant with a mailbox for FOI intake and a SharePoint library for SAR documents.
- An External Access Integration and a Snowflake `SECRET` holding the Microsoft Graph client credentials (created in your own account, never committed to this repo).

---

## Repository layout

The SQL back end lives at the repository root in numbered directories, run in order. The application is in `08_react_app/`.

```
foi-sentinel/
  README.md                          repository overview
  docs/DEVELOPER_GUIDE.md            this guide (plus SOW, roadmap, data sources, architecture)
  00_bootstrap.sql                   create the FOI database, schemas and FOI_WH warehouse
  01_ddl/                            schema, case model, SAR, officers, cost, collaboration
  02_seed_data/                      knowledge bases, seed cases, WDTK corpus
  03_cortex/                         Cortex Search services
  04_procedures/                     working-day, clock, cost, triage, response, scrapers
  sar_sharepoint_seed/               sample SAR documents for the redaction demo
  notebooks/
    foi_engine_room.ipynb            back-end walkthrough of the full Cortex pipeline
    foi_demand_simulation_vqr.ipynb  Cortex Analyst tool; defines the FOI_CASE_ANALYTICS semantic view
  08_react_app/                      the Next.js application (deployed to SPCS App Runtime)
    app/                             routes, pages and API routes
    components/                      UI components
    lib/                             Snowflake access + queries (constants.ts holds the DB/schema names)
    semantic_models/                 Cortex Analyst semantic model definition
    snowflake.yml                    app deploy definition
    app.yml                          SPCS App Runtime spec
    demo_video/RESET_DEMO.sql        return demo state to baseline between runs
  07_inventory/                      object inventory + compliance matrix
```

---

## Step 1: Set up the Snowflake back end

Run the SQL scripts in a Snowsight worksheet (or with `snow sql -f`) in the order below, using a role that can create the objects (ACCOUNTADMIN, which the bootstrap and external-access scripts require). Each script is idempotent where practical.

**0. Bootstrap (`snowflake/00_bootstrap.sql`)** — creates the `FOI` database, its schemas (`FOI_SENTINEL_V2` for the data model, `APPS` for the app) and the `FOI_WH` warehouse. Run this first: every later script uses them.

**1. Data model and features (`01_ddl/`)** — run `01` through `13` in filename order:

```
01_schema_and_case_model.sql     case model, config, bank holidays (schema from step 0)
02_wdtk_model.sql                WhatDoTheyKnow public-corpus model
03_external_access.sql           OPTIONAL: network rule + External Access Integration (scrapers)
04_gla_ico_model.sql             GLA disclosure log + ICO decision-notice model
05_complaint_route_model.sql     complaint / appeal routing
06_precedent_match.sql           cross-authority precedent matching
07_sar_redaction.sql             SAR redaction tables + disclosure view
08_officers.sql                  officer records (the role roster used by the app)
08_sar_redaction_decision.sql    per-value officer redaction decisions
09_legislation_search.sql        legislation reference model
10_s21_duplicate_check.sql       section 21 "already answered" detection
11_corpus_summary.sql            corpus summary helpers
12_schema_reconciliation.sql     AI-usage, cost and fine-tune tables (Reporting + cost views)
13_collaboration.sql             assignment, sign-off and release procedures (the roles feature)
```

Run all of `01` through `13`. Scripts `12` and `13` are required: `12` backs the Reporting page and AI cost views, and `13` provides the case-assignment and sign-off procedures the app calls for the role-based workflow. Skipping them leaves those features non-functional.

`03_external_access.sql` (and the matching `03_web_scrapers.sql` in step 4) are only needed for the live GLA/ICO scrapers. The FOI, EIR and SAR walkthrough runs fully on the seeded data without them, so you can skip both on a first pass.

**2. Seed data (`snowflake/02_seed_data/`)** — run `01` through `04`:

```
01_migrate_knowledge_bases.sql   knowledge-base content
02_seed_cases.sql                demonstration caseload
03_calendar_deadlines_view.sql   statutory-deadline calendar view
04_load_wdtk.sql                 loads wdtk_raw.json into the WDTK model
```

**3. Cortex Search (`snowflake/03_cortex/`):**

```
01_cortex_search_services.sql    Cortex Search services over the corpora
```

**4. Procedures and functions (`snowflake/04_procedures/`)** — run `01` through `03`:

```
01_working_day_functions.sql     UK working-day / statutory-clock functions
02_stage_clock_cost_triage_response.sql   stage machine, cost, triage, response
03_web_scrapers.sql              OPTIONAL: server-side GLA/ICO scrapers (needs 03_external_access)
```

**5. SAR sample documents.** Upload the files in `sar_sharepoint_seed/` to the stage used by the SAR redaction flow (in production these arrive from SharePoint via Openflow). Use Snowsight stage upload or `snow stage copy`.

**6. Cortex Analyst semantic view (optional).** The `FOI_CASE_ANALYTICS` semantic view used by the reporting analytics and the companion agent is defined in `notebooks/foi_demand_simulation_vqr.ipynb` and `08_react_app/semantic_models/`, not in the numbered DDL. Create it from either source if you want the Cortex Analyst features; the core FOI and SAR walkthrough does not require it.

### Optional: the Outlook intake and SharePoint mirror

The live email intake calls a stored procedure (`SP_POLL_OUTLOOK_INBOX`) that authenticates to Microsoft Graph with the client-credentials flow through an External Access Integration and a Snowflake `SECRET`. That procedure and its secret are **not** included in this repository because they carry tenant-specific credentials. To enable live intake, create the `SECRET`, network rule and External Access Integration in your own account, then define the polling procedure against them. The application works fully for the FOI and SAR walkthroughs without this step, using the seeded data.

---

## Step 2: Explore the back end (optional but recommended)

Open `notebooks/foi_engine_room.ipynb` in a Snowflake Workspace or Snowsight notebook. It walks the full pipeline live against `FOI.FOI_SENTINEL_V2`: intake and triage, prioritisation, retrieval (RAG), grounded drafting, SAR redaction, cost and audit, and a per-task Cortex model bake-off.

`notebooks/foi_demand_simulation_vqr.ipynb` is a stability stress-test tool. It drives a weighted mix of analyst questions at the `FOI_CASE_ANALYTICS` semantic view and clusters the generated SQL to find where Cortex Analyst is unstable. It is a developer tool rather than a demo asset.

---

## Step 3: Deploy the application

The app deploys as a Snowflake App on SPCS App Runtime.

```bash
cd 08_react_app
npm install                 # first time only, for local checks
```

Review `08_react_app/snowflake.yml` and set the database, schema and app name for your account (the defaults install the app object into `FOI.APPS` and query `FOI.FOI_SENTINEL_V2` through `FOI_WH`).

> Important: the database and schema names are also hardcoded in the application code, not read from `snowflake.yml`. `08_react_app/lib/constants.ts` sets `SCHEMA = "FOI.FOI_SENTINEL_V2"` and `SAR_INGEST_SCHEMA = "FOI.SAR_INGEST"`, and `08_react_app/lib/queries.ts` refers to the `SAR_INGEST` schema by name. If you install under different database or schema names, update these values in code as well as in `snowflake.yml`. Changing `snowflake.yml` alone is not sufficient.

Then deploy:

```bash
snow app deploy --connection <your-connection>
```

To iterate locally against your Snowflake connection before deploying:

```bash
SNOWFLAKE_CONNECTION_NAME=<your-connection> npm run dev
```

---

## Step 4: Run the application

Retrieve the ingress URL for the deployed app. The `snow app deploy` output prints it, and it is also shown in Snowsight under **Projects → Apps**. Open that URL in a browser.

The application opens on the Command Centre. A suggested walkthrough:

1. **Command Centre and Cases** — pipeline health against the statutory clock, the triage board, and a case detail with its hash-chained audit trail.
2. **Intake and response** — an FOI request arrives, the Cortex triage pipeline classifies and prioritises it, and a grounded draft is prepared for officer review.
3. **SAR redaction** — a Subject Access Request is opened, Cortex Search finds every record across sources, and the redaction studio removes third-party personal data for officer approval before release.

### Reset between runs

The demo walkthrough mutates case state (advancing stages, closing quick wins). To return to the baseline:

```bash
snow sql -f 08_react_app/demo_video/RESET_DEMO.sql --connection <your-connection>
```

---

## How it works

- **Cortex Search** grounds retrieval across the internal knowledge bases and the SAR corpus, so drafted responses cite real source records.
- **AI SQL functions** run in-database over each request: `AI_CLASSIFY` for triage lanes, `AI_FILTER` and `AI_SIMILARITY` for precedent and duplicate detection, `AI_EXTRACT` and `AI_COMPLETE` for grounded drafting.
- **SAR redaction** uses `AI_PARSE_DOCUMENT` and `AI_EXTRACT` to find third-party personal data, `AI_REDACT` to remove it, and a per-value decision table so that an officer's choice is recalled when the same detail appears again. Third-party data in a SAR is withheld under the UK GDPR Article 15 balancing test, with an officer approving each item.
- **Audit** — case events are recorded in a hash-chained log so the disclosure trail is tamper-evident.

---

## Cleanup

To remove the application and its objects:

```sql
USE ROLE ACCOUNTADMIN;
DROP APPLICATION IF EXISTS FOI_SENTINEL_APP CASCADE;
-- to remove all data as well:
DROP DATABASE IF EXISTS FOI;
DROP WAREHOUSE IF EXISTS FOI_WH;
```

SPCS App Runtime bills for the compute the application service uses, so suspend or drop the application when you are not using it.

---

## Notes

- The application queries Snowflake with owner's rights via the SPCS service token. Role-based permissions (assignment, sign-off, and the action checks) are enforced in the application, not at the database level, and the acting-officer selection is a demonstration switcher rather than a security boundary. Effective access is therefore governed by who can reach the ingress endpoint, so control that first.
- The database, schema and warehouse names are currently hardcoded in the application (`08_react_app/lib/constants.ts` and `lib/queries.ts`), not read from configuration. Installing under different names requires the code edits described in Step 3.
- This repository is a working reference build intended to be redeployed in your own Snowflake account. Tenant-specific values (the demo mailbox, the Microsoft Graph client secret and account identifiers) must be supplied in your account, as described in the optional integration steps.
- FOI Sentinel is a demonstration build. Validate all legal wording and exemption handling against your authority's own policies before any production use.
