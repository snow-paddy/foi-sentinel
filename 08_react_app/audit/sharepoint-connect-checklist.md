# Connect real SharePoint to Snowflake for SAR — setup checklist

Follow-on track for the SAR demo. Swaps the synthetic `SAR_DOC_CORPUS` for a **live feed** from
your enterprise Microsoft 365 tenant using the **Openflow Connector for SharePoint (GA)**. Steps
split by who does them: **[MS admin]** in Azure/M365, **[Snowflake]** in the account.

> Scope note: the connector covers **SharePoint Online + OneDrive for Business** (OneDrive is a
> SharePoint document library under the hood). **Exchange/Outlook email has no GA connector** — for
> email, export via Purview eDiscovery → Azure Blob/ADLS → external stage (separate mini-track).

---

## A. Microsoft 365 / Entra ID prerequisites  **[MS admin]**
1. **Register an Entra ID (Azure AD) app** for the connector (App registrations → New registration).
2. Grant **Microsoft Graph application permissions** (admin consent required):
   - `Sites.Selected` — least-privilege access to only the sites you nominate (preferred over `Sites.Read.All`).
   - `GroupMember.Read.All` and `User.ReadBasic.All` — needed only if using an **ACL/permissions** variant so Snowflake mirrors who-can-see-what.
3. **Authorise the specific SharePoint sites** the SAR corpus should cover (Graph `Sites.Selected` grant per site) — e.g. Housing, Adult Social Care, Complaints.
4. Create credentials for the app: a **client secret** and (recommended) a **certificate**. Record tenant ID, client ID, secret/cert.

## B. Choose the connector variant  **[Snowflake + MS admin agree]**
Four GA variants — pick per how much you need in Snowflake:
| Variant | Gives you | Use when |
|---|---|---|
| Simple Ingest, no ACLs | Files → stage + file metadata | Fastest; governance handled in Snowflake |
| Simple Ingest, **document ACLs** | + SharePoint permissions mirrored | Need source ACLs preserved |
| **Cortex Search, no ACLs** | + auto-parse (AI_PARSE_DOCUMENT) + auto-built Cortex Search service | **Recommended for SAR** — search-ready on arrival |
| Cortex Search, **document ACLs** | + permission-filtered search | Search must respect source permissions |

**Recommended: "Cortex Search, no ACLs"** — it lands parsed, searchable text and builds the search service, matching what our `/sar` page already consumes.

## C. Openflow runtime + connector  **[Snowflake]**
1. Ensure an **Openflow deployment/runtime** exists in the account (or create one — Openflow is Snowflake's managed NiFi-based integration service).
2. Deploy the **SharePoint connector** into the runtime; supply tenant ID, client ID, secret/cert from step A.
3. Point it at the authorised sites/document libraries; set the **destination database/schema** to `FOI.FOI_SENTINEL_V2`.
4. Confirm **CDC** is active — the connector uses `CaptureSharepointChanges` for incremental sync (adds, deletes, permission changes) so the corpus stays current.

## D. Wire it into the SAR app  **[Snowflake]**
1. The connector lands a documents table (+ chunks) and, in the Cortex Search variant, **its own search service**. Two options:
   - **Repoint**: change `SAR_CORPUS_SEARCH` (or `getSarData`'s search target) to the connector-created service.
   - **Union**: keep `SAR_DOC_CORPUS` shape and `INSERT`/view over the connector's landed table so the page code is unchanged.
2. Re-run the one-time `AI_CLASSIFY` third-party flag over newly landed docs (or make it a scheduled task).
3. Per-SAR cost metering already fires (`stage='sar'`) — no change.

## E. Governance & residency  **[Snowflake]**
- Apply the same masking/row-access pattern to any **structured** LOB exports (social care/housing/revenues) you load alongside.
- **Residency**: this demo account is `AWS_US_WEST_2`. For a real UK deployment, run the account/Openflow in a **UK/EU region**; Cortex functions + Cortex Search are available in EU (and cross-region inference can be pinned to `AWS_EU`).

## F. Validate
1. Confirm docs from each nominated site appear in the landed table (row counts by site).
2. Run the `/sar` federated search — real SharePoint records should surface alongside (or replacing) the synthetic set.
3. Check `AI_CLASSIFY` flags populate and masking holds on the structured tier.

---
**Effort:** A–B are the gating steps (need your MS/Entra admin). C–F are Snowflake-side and largely
config. Nothing in the app code needs rewriting — only the data source behind `SAR_CORPUS_SEARCH`.
