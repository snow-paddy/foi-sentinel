# 01 — Automated outbound email (send FOI responses via Microsoft Graph)

**Status:** Scoped, not built. **Sequence:** next.
**Owner:** Paddy Gardner. **Related backlog:** `08_react_app/BACKLOG.md` #1 (inbound counterpart).

## Goal

Make the "Dispatch / Send response" action actually transmit the approved FOI response letter to
the requester by email, via Microsoft Graph — reusing the plumbing already proven by the live
inbound intake. Today this action only changes state in Snowflake.

## Current state (verified 2026-07-10)

The dispatch path does **not** send email. It performs three Snowflake statements only:

- `dispatchResponse()` — `08_react_app/lib/queries.ts:846`
  1. `UPDATE FOI_RESPONSE SET DISPATCHED_AT = CURRENT_TIMESTAMP()`
  2. `UPDATE FOI_CASE SET STATUS='CLOSED', CURRENT_STAGE='DISPATCH', OUTCOME=…`
  3. `CALL SP_ADVANCE_STAGE(…)` (audit event)
- Batch equivalent: `batchDispatch()` — `08_react_app/lib/queries.ts:926` (loops the above)
- API routes: `app/api/response/dispatch/route.ts`, `app/api/response/batch-dispatch/route.ts`
- UI triggers: `components/studio/response-studio.tsx` (~L176), `components/cases/focus-deck.tsx` (~L137)

There is no Graph, SMTP, or `sendMail` call anywhere in the outbound path.

## What is already in place (reused, no new build)

The live inbound intake proves every hard dependency works. All of the following are reused as-is:

| Object | Purpose |
|--------|---------|
| `SECRET OUTLOOK_CLIENT_SECRET` | App-only client secret (client-credentials OAuth) |
| `NETWORK RULE OUTLOOK_GRAPH_RULE` | Egress allow-list — already permits `graph.microsoft.com` + `login.microsoftonline.com` |
| `EXTERNAL ACCESS INTEGRATION OUTLOOK_GRAPH_EAI` | Binds the rule + secret to the proc |
| Azure app registration (tenant `Exampleton`) | tenant and client IDs held in the deployment environment, not in this repo |
| Mailbox `foi@exampleton.onmicrosoft.com` | Licensed member mailbox (send-from address) |

## The one external dependency — `Mail.Send` consent

The Azure app registration currently holds `Mail.Read` / `Mail.ReadWrite` (application) with admin
consent. It does **not** hold `Mail.Send`. This is the only step outside Snowflake.

1. Entra admin centre → App registrations → the Exampleton FOI app → API permissions.
2. Add permission → Microsoft Graph → **Application permissions** → `Mail.Send`.
3. **Grant admin consent** for the tenant.
4. (Optional hardening) Scope the app to send only from `foi@…` via an ApplicationAccessPolicy,
   so the app cannot send from arbitrary tenant mailboxes.

## Build steps (Snowflake + app)

1. **New stored procedure `FOI.FOI_SENTINEL_V2.SP_SEND_OUTLOOK_MAIL`** — mirror of the inbox
   poller. Python + `EXTERNAL_ACCESS_INTEGRATIONS = (OUTLOOK_GRAPH_EAI)`,
   `PACKAGES = ('snowflake-snowpark-python','requests')`.
   - Params: `P_TO` (recipient), `P_SUBJECT`, `P_BODY_HTML`, optional `P_MAILBOX`
     (default `foi@exampleton.onmicrosoft.com`), optional `P_ATTACHMENT_STAGE_PATH`.
   - Acquire client-credentials token (same code path as `SP_POLL_OUTLOOK_INBOX`).
   - `POST https://graph.microsoft.com/v1.0/users/{P_MAILBOX}/sendMail` with body:
     ```json
     {
       "message": {
         "subject": "<subject>",
         "body": { "contentType": "HTML", "content": "<body html>" },
         "toRecipients": [ { "emailAddress": { "address": "<recipient>" } } ],
         "attachments": [
           { "@odata.type": "#microsoft.graph.fileAttachment",
             "name": "response.pdf", "contentBytes": "<base64>" }
         ]
       },
       "saveToSentItems": true
     }
     ```
   - Return `{ ok, status_code, graph_diagnostics }`. Log a `FOI_CASE_EVENT` row on send.
   - **Reuse the bind-parameter discipline** proven for the poller: never inline JSON via
     `PARSE_JSON('…')` — Snowflake reinterprets `\n` / `\"` in single-quoted literals and breaks on
     real letter bodies. Pass all content via Snowpark bind params.
2. **Wire `dispatchResponse()`** to `CALL SP_SEND_OUTLOOK_MAIL(...)` **before** the case-close
   updates, guarded by the dry-run flag below. On a real send failure, do **not** close the case —
   surface the Graph diagnostic to the officer.
   - Source the recipient from the case requester email; subject from the reference + title; body
     from the generated/approved response (`FOI_RESPONSE`); optional attachment = the redacted PDF
     produced by the Redaction Studio.
3. **Batch path** — `batchDispatch()` calls the same proc per case; aggregate per-case
   send status so a single failure does not silently close the rest.

## Safety — mandatory before this is ever live

Once real, a live demo could fire genuine email at real recipients. Two guards:

- **Dry-run flag** (env var, e.g. `FOI_EMAIL_SEND_ENABLED`, default `false`). When off,
  `dispatchResponse` behaves exactly as today (state change only) and the UI labels the action
  "Dispatch (simulated)". When on, it sends. This keeps recorded demos safe by default.
- **Recipient allow-list / test inbox.** Demo requester addresses are synthetic
  (`…@exampleton…`) and would bounce. When send is enabled, redirect all outbound to a controlled
  test inbox unless the recipient domain is on an explicit allow-list.

## Testing plan

1. Enable the flag in a dev context only; send to a real controlled inbox; confirm receipt,
   correct subject/body, and attachment renders.
2. Confirm the `FOI_CASE_EVENT` audit row and `DISPATCHED_AT` timestamp are written only on a
   `200`/`202` from Graph.
3. Force a Graph failure (bad recipient) and confirm the case is **not** closed and the error
   surfaces in the UI.
4. Batch: mix of valid + invalid recipients; confirm per-case status is accurate.

## Reviewer steps (manual — do these yourself)

- [ ] Confirm `Mail.Send` shows as **granted** (green tick) in Entra, not merely added.
- [ ] Send one real test email end-to-end and read it in the target inbox before declaring done.
- [ ] Verify the dry-run flag defaults to **off** in the deployed app so demos stay safe.
- [ ] Check no client secret or tenant/client ID has been added to app source (secrets stay in
      the Snowflake `SECRET`).

## Open questions

- Send-from address for a real deployment: shared `foi@…` mailbox vs a per-council address?
- Should the sent copy be filed against the case (store the Graph message id) for the audit trail?
- HTML letter template — reuse the on-screen response formatting, or a dedicated email template?
