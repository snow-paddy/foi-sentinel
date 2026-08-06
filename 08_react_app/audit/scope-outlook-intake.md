# Scope — Outlook email → app intake integration (xo-discover)

**Status:** Scoped, not built. Backlog item #1. Produced with xo-discover (proportional: Observe → Orient → Plan; lightweight, no WI tree).

## Problem / intent
Show the *real* intake path in practice: a request landing in the council's shared Outlook/Exchange mailbox automatically becomes a triaged, demo-marked case — replacing the simulated Intake composer for the champion demo.

## Observe — what already exists
- The **Intake page already documents the production pipeline**: Microsoft Graph / Power Automate watches the shared mailbox → emails land in a Snowflake stage as `.eml` → Snowpipe ingests → a task runs Cortex triage → each becomes a classified case with the clock started. (`app/intake/page.tsx`, "How this works in production".)
- **Triage is reusable**: `SP_TRIAGE_CASE` + `createIntakeCase` already turn request text into a triaged, demo-marked case.
- **The app is React-on-SPCS** (Node server, web egress confirmed working).
- **Cortex** can parse email bodies/attachments (`AI_PARSE_DOCUMENT`) and triage (COMPLETE/SENTIMENT).
- Account: external access integrations + Snowflake SECRETs are available (ACCOUNTADMIN).

## Orient — candidate approaches
- **A. Power Automate → stage(.eml) → Snowpipe → task → SP_TRIAGE_CASE.** Lowest code; but a moving part outside Snowflake and hard to *show* live in-app.
- **B. Snowflake-native poll (external access).** A Python stored proc with an EXTERNAL ACCESS INTEGRATION calls Microsoft Graph (client-credentials) to read the demo mailbox, lands raw mail, parses, then calls the existing triage. Fully Snowflake-native; demoable via a "Sync mailbox now" button; consistent with the "one Snowflake-native system" thesis. **← recommended.**
- **C. Openflow connector.** Managed ingestion if a Graph/email source fits; heavier setup, less custom-demo value.
- **D. SPCS Node webhook.** Graph change-notification subscription → public SPCS endpoint → write + triage. Real-time and app-native, but needs public ingress + subscription lifecycle management.

### Recommendation
**B for the core (demoable now), with D as the later "real-time" evolution.** B keeps logic in Snowflake, is repeatable, and surfaces as a one-click "Sync inbox" action; D adds real-time push once B is proven.

## Plan (sequenced, when greenlit → xo-code)
1. **Azure (operator/IT):** app registration on a **dedicated demo mailbox**; `Mail.Read`/`Mail.ReadWrite` (app perms) + admin consent. Least privilege.
2. **Snowflake plumbing:** `SECRET` (tenant/client id/secret); `NETWORK RULE` for `graph.microsoft.com` + `login.microsoftonline.com`; `EXTERNAL ACCESS INTEGRATION`. Secrets live in Snowflake, never in the app.
3. **`SP_POLL_OUTLOOK_INBOX` (Python, external access):** OAuth client-credentials → Graph `/users/{mailbox}/messages?$filter=isRead eq false` → land raw into a `OUTLOOK_INBOX_RAW` table → mark read.
4. **Parse & normalise:** sender/subject/body (+ attachments via `AI_PARSE_DOCUMENT`) → request text.
5. **Reuse triage:** call `SP_TRIAGE_CASE` / `createIntakeCase` → demo-marked case, clock started.
6. **App surface:** Intake gains a **"Sync mailbox now"** button → `/api/intake/sync` → `CALL SP_POLL_OUTLOOK_INBOX`; list newly-created cases. Optionally a scheduled `TASK` every N minutes.
7. **Security/demo hygiene:** dedicated mailbox only; demo-mark every created case; document the consent + secret handling (route secrets via the `cortex-secrets` discipline).

## Confidence / unknowns
- **Well-understood:** the Snowflake side (mirrors the documented pipeline) and triage reuse.
- **Operator-dependent / uncertain:** Azure tenant access, app-registration permissions, and admin consent for a demo mailbox — this is the gating prerequisite. Also confirm whether IT prefers Power Automate (A) over a native poll (B).

## Route
When greenlit → **xo-code** (Snowflake proc + plumbing) then a small app increment (Intake button + `/api/intake/sync`). Prerequisite: Azure mailbox + consent (option B) or a Power Automate flow (option A).
