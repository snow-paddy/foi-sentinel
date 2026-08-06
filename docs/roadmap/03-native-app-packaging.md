# 03 — Package FOI Sentinel as a distributable Native App

**Status:** Roadmapped. **Sequence:** larger initiative; the prerequisite (repo cleanup + GitHub)
comes first. **Owner:** Paddy Gardner.

## Goal

Repackage FOI Sentinel v2 (today a first-party SPCS App Runtime app) as a distributable Snowflake
**Native App**, publishable via a listing so other Snowflake accounts can install it.

## Key reframe

App Runtime (`snow app`, `APPLICATION SERVICE` in your own account) is **not** the same as the
Native App Framework (a distributable package that installs into a consumer's account). This is a
**repackage** into the SPCS-in-a-native-app pattern, not a re-share.

## Confirmed scope decisions (2026-07-10)

- **Audience:** other Snowflake orgs (external) → highest portability bar; nothing tenant-specific
  may be hardcoded.
- **External dependencies:** ship fully working → the consumer supplies their own credentials via a
  `configuration_callback` + EAIs + security integrations; the app performs live
  Outlook/SharePoint/Cortex.

## Privilege reality (verified on the publish account `UMB05080`)

`ACCOUNTADMIN` holds `CREATE LISTING` and `CREATE ORGANIZATION LISTING`. `ORGADMIN` is **not**
accessible (`SHOW ROLES LIKE 'ORGADMIN'` returns nothing).

| Sharing target | Feasible today? |
|----------------|-----------------|
| Named accounts, same region (`AWS_US_WEST_2`) | ✅ Yes — private listing |
| Named accounts in other regions/clouds | ❌ Needs cross-region auto-fulfilment → `ORGADMIN` |
| Any account via public Marketplace | ❌ Needs approved-provider onboarding + `ORGADMIN` |

Publishing beyond same-region named accounts requires org-level enablement raised with whoever
administers the organisation.

## Prerequisite — repo cleanup + GitHub (do first)

"Ship fully working" means live tenant credentials are wired in today, and external distribution
means the code leaves the building. Before any packaging:

1. **Secret scrub** — no mailbox, Azure app-registration IDs, Graph client secret, PATs, or
   connection tokens in tracked files. These move to Snowflake secrets / consumer-supplied config.
2. **`.gitignore`** — exclude `.env`, `connections.toml`, `secrets*`, build artefacts,
   `node_modules`, and recording assets (`demo_video/out/*.mp4`).
3. **Structure + README** — a clean home for the eventual native-app layout.
4. **Push to GitHub** — confirm the target remote/identity first.

## Phases

| Phase | Work | Sub-skill |
|-------|------|-----------|
| 0. Inventory | Enumerate services, EAIs, Cortex calls, secrets, data; decide ship/stub/configure per dependency | — |
| 1. Package scaffold | Application package, `manifest.yml`, setup script, staged artefacts | `setup-app` |
| 2. Containerise | Service spec, compute pool, `container_services`, `default_web_endpoint`, launch via `version_initializer` | `add-containers` |
| 3. External wiring | Manifest-requested EAI (Graph egress), Cortex/account privileges, references, security integration (Azure OAuth), secrets; `configuration_callback` for consumer creds | `request-external-access-integration`, `request-account-privilege`, `request-object-access`, `request-security-integration` |
| 4. Data content | Ship seed FOI cases so the UI/AI work on install | `shared-data` |
| 5. Deploy + install-test + debug | Install into a clean test consumer account and iterate | `deploy-test`, `debug-app` |
| 6. Version + release + listing | Register a version, set a release directive/channel, create the listing | `app-version-release`, `publish-listing` |

## Notes for Phase 0

- `FOI_SENTINEL_UI` shows **no external access integrations attached to the service itself** — the
  Graph/Outlook egress and Cortex calls run through other objects (procs/tasks/services). Each must
  be traced, because each becomes a manifest-requested EAI/privilege in the packaged app.
- Data residency is a **customer-facing** consideration (the battlecard), not a runtime constraint
  on the demo, which runs in a full-Cortex US region.
