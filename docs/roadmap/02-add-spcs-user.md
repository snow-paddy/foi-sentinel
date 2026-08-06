# 02 — Add a new user to the SPCS app — ✅ DONE (2026-07-10)

**Status:** Done — `FOI_APP_DEMO` created with app-only access. **Owner:** Paddy Gardner.

## Goal

Give an additional user access to the running SPCS app (`FOI_SENTINEL_UI`) with the ability to use
**all parts of the app** but **no other Snowflake access** (no data, no SQL, no warehouse).

## Auth-model audit (authoritative finding, 2026-07-10)

The app authenticates to Snowflake **entirely via its own service identity** (owner's rights):

- Connection uses the SPCS session token at `/snowflake/session/token` → `authenticator: "OAUTH"`
  pool (`08_react_app/lib/snowflake.ts:51`, `:360-361`).
- All 36 API routes and every function in `lib/queries.ts` call `querySnowflake()` with the default
  `callersRights: false` — so queries run as the **service**, never the web user.
- **No `middleware.ts`, no login page, no session/cookie auth, no role or per-user gating** anywhere.
  Personas (`FOI_REVIEWER`, `CASE_LEAD`) are `FOI_OFFICER` table records for display, not access
  control. The only caller-identity code is `app/api/query/route.ts` — a diagnostic, non-blocking.
- Warehouse/DB/schema are fixed by the service spec (`FOI_WH`, `FOI.FOI_SENTINEL_V2`), not the user.

**Consequence:** a user who can merely reach the ingress endpoint can use **every** feature — and,
because there is no in-app authorisation, gets **full capability** (read, dispatch, edit config).
There is no read-only tier at the Snowflake layer; endpoint access is all-or-nothing.

## What was created

```sql
CREATE ROLE FOI_APP_USER
  COMMENT = 'App-only access to FOI_SENTINEL_UI SPCS endpoint; no data/warehouse privileges';

GRANT SERVICE ROLE FOI.FOI_SENTINEL_V2.FOI_SENTINEL_UI!ALL_ENDPOINTS_USAGE TO ROLE FOI_APP_USER;

CREATE USER FOI_APP_DEMO
  PASSWORD = '<generated temp>'
  MUST_CHANGE_PASSWORD = FALSE          -- app-only user should not need Snowsight
  DEFAULT_ROLE = FOI_APP_USER           -- no DEFAULT_WAREHOUSE by design
  FIRST_NAME = 'FOI Sentinel User';

GRANT ROLE FOI_APP_USER TO USER FOI_APP_DEMO;
```

Verified: `FOI_APP_DEMO` holds only `FOI_APP_USER` (+ `PUBLIC`); `FOI_APP_USER` holds only the
`ALL_ENDPOINTS_USAGE` service role. Nothing else.

- **App URL:** `https://e3zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app`

## Notes / options

- `MUST_CHANGE_PASSWORD` was set `FALSE` deliberately — forcing a change would require a Snowsight
  visit, which contradicts "app only". Rotate manually if desired.
- The user *can* technically open Snowsight but has zero warehouse/data grants, so cannot query or
  see anything there.
- To hard-block Snowsight/SQL entirely, attach an authentication policy (not done — minimal role
  deemed sufficient).
- If a genuinely restricted (e.g. read-only) app user is ever needed, that must be enforced
  **in the app**, since Snowflake grants cannot differentiate features behind the single endpoint.
