# FOI Sentinel v2 — Inventory

**Account:** SFSEEUROPE-US_WEST_DEMO_PG · **Schema:** `FOI.FOI_SENTINEL_V2` · **Warehouse:** `FOI_WH`

## Objects
| Type | Count | Key objects |
|------|------:|-------------|
| Tables | 19 | FOI_CASE, FOI_CASE_EVENT, FOI_CASE_TASK, FOI_TRIAGE, FOI_COST_ESTIMATE, FOI_EXEMPTION_ASSESSMENT, FOI_REDACTION, FOI_RESPONSE, FOI_INTERNAL_REVIEW, FOI_ICO_COMPLAINT, FOI_DISCLOSURE_PUBLICATION, LIFECYCLE_STAGE, COUNCIL_CONFIG, UK_BANK_HOLIDAYS, CALENDAR, FOI_LEGISLATION, COUNCIL_POLICY_DOCS, DISCLOSURE_LOG, CAMDEN_FOI_RESPONSES |
| Views | 1 | V_CASE (working-days-remaining + RAG) |
| Procedures | 6 | SP_ADVANCE_STAGE, SP_STOP_CLOCK, SP_RESUME_CLOCK, SP_COST_ESTIMATE, SP_TRIAGE_CASE, SP_GENERATE_RESPONSE |
| Functions | 3 | FN_WORKING_DAYS, FN_ADD_WORKING_DAYS, FN_WD_REMAINING |
| Cortex Search | 3 | COUNCIL_POLICY_SEARCH (35), DISCLOSURE_SEARCH (5), CAMDEN_FOI_SEARCH (11,420) |

## Demo data
- **54 cases** (33 open across all 17 lifecycle stages, 21 closed), **86% in-time**, 1 overdue.
- Showcases: EIR (no cost limit), SAR redirect, s.21 duplicate, PIT→refusal, vexatious (s.14), internal review, ICO complaint, published disclosures.
- **157 audit events**, **54 triage records**. Knowledge bases migrated from v1 (incl. 11,420 real Camden responses).

## Build order (reproducible)
```
01_ddl/01_schema_and_case_model.sql
02_seed_data/01_migrate_knowledge_bases.sql
03_cortex/01_cortex_search_services.sql
04_procedures/01_working_day_functions.sql
04_procedures/02_stage_clock_cost_triage_response.sql
02_seed_data/02_seed_cases.sql        (base case rows)
02_seed_data/03_calendar_deadlines_view.sql   (calendar, deadlines, V_CASE)
   + artefacts / triage / events  (run in-session; see git history / setup notes)
06_spcs/infra.sql + deploy.sh        (SPCS deployment)
```

## Deployment status
- Schema, logic, data, Cortex services: **built & validated**.
- SPCS: compute pool `FOI_SENTINEL_POOL`, image repo `FOI.FOI_SENTINEL_V2.IMAGES`, roles `FOI_SENTINEL_SVC` / `FOI_REVIEWER`, Cortex grants: **created**.
- Container image build/push: **pending** (Docker Desktop org sign-in required on the build machine).
