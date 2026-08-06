# FOI Sentinel — Delivery Roadmap

Centralised home for **delivery and operational** initiatives (infrastructure, integrations,
packaging, access). This complements — it does not replace — the two existing planning docs:

- [`../ROADMAP.md`](../ROADMAP.md) — forward-looking **product/feature** enhancements
- [`../BACKLOG.md`](../BACKLOG.md) and [`../../08_react_app/BACKLOG.md`](../../08_react_app/BACKLOG.md) — captured feature ideas

Where a delivery item overlaps a feature backlog entry, this folder is the authoritative spec and
links back to the backlog.

## Initiatives

| # | Initiative | Status | Sequence |
|---|-----------|--------|----------|
| [01](01-email-automation.md) | Automated outbound email (send FOI responses via Microsoft Graph) | Scoped, not built | **Next** |
| [02](02-add-spcs-user.md) | Add a new user to the SPCS app (`FOI_APP_DEMO`) | ✅ Done (2026-07-10) | — |
| [03](03-native-app-packaging.md) | Package FOI Sentinel as a distributable Native App | Roadmapped | Larger initiative; prerequisite = repo cleanup + GitHub |
| [04](04-partial-s21-percentage-match.md) | Partial s.21 with element-level % match | Designed | Phase 0 (persist existing score) is a free win |
| [05](05-multi-user-escalation-and-postgres.md) | Multi-user escalation: identity, concurrency, Postgres/Hybrid Tables | Analysed | Blocked on adding real user identity first |
| [06](06-ai-cost-model.md) | AI cost: measured spend replacing the modelled £0.12 constant | Analysed | Measured figures captured 2026-08-04 |
| [07](07-learning-loop.md) | Learning loop: what the app can actually learn from | Analysed | Loop 0 (stop destroying data) is free and urgent |

## Confirmed context (verified 2026-07-10)

- The SPCS app (`FOI_SENTINEL_UI`) runs on **PG-SNOWFLAKE / `UMB05080` / `AWS_US_WEST_2`**, in
  database `FOI`, schema `FOI_SENTINEL_V2`. This is the publish account for any native app.
- Inbound Outlook intake (`SP_POLL_OUTLOOK_INBOX`) is **genuinely live**; outbound sending is
  currently **simulated** (see 01).
- `ACCOUNTADMIN` holds `CREATE LISTING` / `CREATE ORGANIZATION LISTING`; `ORGADMIN` is **not**
  available, which gates cross-region auto-fulfilment and public Marketplace publishing (see 03).
