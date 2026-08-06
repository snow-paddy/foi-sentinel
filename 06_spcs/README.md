# FOI Sentinel v2 — SPCS Deployment

A containerised Streamlit UI for the FOI Sentinel case-management system, running on
**Snowpark Container Services**. Reads and writes the `FOI.FOI_SENTINEL_V2` schema directly
(no data sharing required). Designed to be repackaged later as a Snowflake Native App with SPCS.

## Files
| File | Purpose |
|------|---------|
| `spcs_main.py` | Container entry — builds a Snowpark session from the SPCS OAuth token, runs the multi-page app |
| `Dockerfile` | Python 3.11 + Streamlit image, served on port 8080 |
| `service-spec.yaml` | SPCS service spec (image, env, public endpoint) |
| `infra.sql` | Compute pool, image repository, service & reviewer roles, Cortex grants |
| `deploy.sh` | Build → push → (re)create service |
| `app_pages/` | Copied from `../05_app/app_pages` at build time |

## Prerequisites
- Docker running
- Snow CLI logged in (connection `PG-SNOWFLAKE`)
- The `FOI.FOI_SENTINEL_V2` schema built (run `01_ddl`, `02_seed_data`, `03_cortex`, `04_procedures`)

## Deploy
```bash
# 1. One-off infrastructure (compute pool, image repo, roles, Cortex grants)
snow sql --connection PG-SNOWFLAKE -f infra.sql

# 2. Build, push and create/replace the service
SNOWFLAKE_CONNECTION=PG-SNOWFLAKE ./deploy.sh latest

# 3. Get the public URL (open in a browser; log in with your Snowflake user)
snow sql --connection PG-SNOWFLAKE -q \
  "SHOW ENDPOINTS IN SERVICE FOI.FOI_SENTINEL_V2.FOI_SENTINEL_UI;"
```

## Cost control
- Compute pool `FOI_SENTINEL_POOL`: `CPU_X64_XS`, 1 node, **auto-suspends after 120s** idle.
- Triage for the seeded backlog is pre-computed; live Cortex calls happen only on the
  Intake, Response Studio and Guidance pages.

## Operate
```sql
-- Status / logs
SELECT SYSTEM$GET_SERVICE_STATUS('FOI.FOI_SENTINEL_V2.FOI_SENTINEL_UI');
SELECT SYSTEM$GET_SERVICE_LOGS('FOI.FOI_SENTINEL_V2.FOI_SENTINEL_UI', 0, 'foi-sentinel', 100);
-- Suspend / resume (save credits)
ALTER SERVICE FOI.FOI_SENTINEL_V2.FOI_SENTINEL_UI SUSPEND;
ALTER SERVICE FOI.FOI_SENTINEL_V2.FOI_SENTINEL_UI RESUME;
```

## Repackaging as a Native App
The same container image and `service-spec.yaml` can be referenced from a Native App
manifest (`artifacts.container_services.images`). The case-management schema would then be
shared as application content or recreated by the setup script. See the plan's Phase 7 notes.
