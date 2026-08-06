# FOI Sentinel — Architecture Summary

FOI / EIR / SAR case management and statutory-deadline command centre for UK local government,
built and run entirely on Snowflake. Handles a request from arrival in the council mailbox through
triage, retrieval, exemption assessment, redaction, drafting and sign-off.

**Status key:** **LIVE** = built and working · **SIMULATED** = demonstrated, not transmitting ·
**PLANNED** = specified, not built.

## Architecture at a glance

A React / Next.js application deployed as a **Snowflake App (App Runtime) on Snowpark Container
Services**, reached over a Snowflake-authenticated HTTPS endpoint. All data, AI and integration
logic run inside Snowflake; there is no external application host, no middleware tier and no
customer data at rest outside Snowflake. The application queries Snowflake using its own service
identity (owner's rights, via the SPCS session token), so end users need only endpoint access.

## Microsoft integration surface

| Component | What it does | Auth / permission | Status |
|---|---|---|---|
| **Entra ID** (Azure AD) | App registration issuing credentials for all Graph calls | App-only OAuth 2.0 **client credentials**; no user delegation, no user tokens | **LIVE** |
| **Microsoft Graph** | Single integration point for all Microsoft traffic | Egress restricted to `graph.microsoft.com` + `login.microsoftonline.com` | **LIVE** |
| **Exchange Online / Outlook** — inbound | Polls the council's shared FOI mailbox; each new message becomes a logged, triaged case with a statutory deadline | `Mail.Read` / `Mail.ReadWrite` (**Application**), admin-consented | **LIVE** |
| **Exchange Online / Outlook** — outbound | Issue the response letter to the requester by email | Requires `Mail.Send` (**Application**) + admin consent — **not yet provisioned** | **SIMULATED** |
| **SharePoint Online** | Ingests council case-file documents for Subject Access Requests into a searchable index | Snowflake Openflow connector | **LIVE** |
| **M365 licensing** | App-only Graph mail requires a **licensed member mailbox** in the same tenant as the app registration; guest or consumer accounts cannot be read | — | Constraint |

Credentials are held in a Snowflake `SECRET`; outbound calls are made by a Python stored procedure
bound to a Snowflake `EXTERNAL ACCESS INTEGRATION` and `NETWORK RULE`. No secret, token or tenant
identifier is present in application code.

### Not touched in the Microsoft estate

No Dynamics · no on-premises Exchange · no Power Automate or Logic Apps (intake is a
Snowflake-native poll, avoiding a separate automation tier) · no Azure compute, storage or hosting ·
no write-back to SharePoint · no directory synchronisation.

## Snowflake platform components

Snowpark Container Services (application runtime) · Cortex AI · Cortex Search · Openflow ·
External Access Integration, Network Rules and Secrets (controlled egress) · Python / Snowpark
stored procedures and tasks · stages with directory tables · role-based access control.

## Application capabilities

- **Intake and triage** — request classified, FOI/EIR regime determined, complexity ranked, owning
  department assigned; 20-working-day statutory clock started on a working-day calendar.
- **Lifecycle** — 17 operational stages presented as the five-step statutory process plus challenge,
  with a full audit event trail on every transition.
- **Grounded drafting** — suggested responses cite the council's own records first, then peer
  precedent and regulator decisions, with inline references and an evidence-comparability check.
- **Exemptions and public-interest test** — exemption identification, refusal-reason analysis and
  sector-wide patterns in why comparable requests were refused.
- **Redaction (SAR)** — selectively removes **third-party** personal data while deliberately
  retaining the requester's own data, which a Subject Access Request must disclose.
- **Reporting** — answered-in-time performance, outcome mix, workload and processing-cost analysis.

## Evidence base

Real published open data — a borough disclosure log of c.11,400 responses, a regional authority
disclosure log, cross-authority request threads from WhatDoTheyKnow, and regulator and policy
guidance — indexed for semantic retrieval. The council's own internal holdings and all personal data
used in Subject Access Request demonstrations are **synthetic**.

## Security and governance

- Application endpoint is gated by Snowflake authentication; access granted by role, and a
  least-privilege role can be issued that permits the application and nothing else.
- All Microsoft traffic is outbound-only from Snowflake through an explicit egress allow-list; no
  inbound connection into the customer network and no open ports.
- Application-permission model means Graph access is scoped and auditable at tenant level rather
  than dependent on any individual's mailbox permissions.
- Every case action is written to an immutable audit event table.

## Data residency

The demonstration environment runs in a region with full Cortex AI availability. For a UK-resident
deployment, document extraction and embedding run natively in London; generative inference
currently requires cross-region processing within the EU, and model fine-tuning is available in a
single EU region. This is a deployment-planning consideration, not an application constraint.

---

# Roadmap — how we could extend this

Three areas raised for future support. **None are built today**; each is described with the intended
approach and the main considerations.

## 1. Integration with Microsoft Dynamics 365

**Why.** Many councils run customer service and case management on Dynamics 365. FOI cases
frequently need to be associated with an existing contact or service case — to establish requester
identity and to spot repeat or linked requesters.

**How.** Dataverse Web API over OData, reusing the **same Entra ID app registration and app-only
OAuth client-credentials pattern already proven for Graph**. Snowflake reaches it via an additional
External Access Integration and Network Rule scoped to the tenant's Dataverse endpoints. Initial
scope: read-only enrichment — resolve the requester against Dynamics contacts, surface related
service cases, flag repeat requesters and potential vexatious patterns. Optional phase two writes
FOI case status back so front-line staff see progress without a second system.

**Considerations.** Dataverse needs an application user with an explicit security role, so
table-level permissions should be least-privilege. **Dynamics is not universal in this sector** —
democratic-services and committee functions are often run on Modern.gov instead. The connector
should therefore be optional and pluggable, with the same enrichment interface able to sit in front
of a different system of record.

## 2. Escalation and collaborative responses

**Why.** Requests rarely sit with one officer. They span departments, need review before release,
and can escalate to internal review then the regulator. The internal-review and complaint tables
exist today only as demonstration stubs.

**How.** Multi-owner cases: a request is segmented into elements, each assigned to the department
holding the information, with its own retrieval state, contributor and clearance status. A
consolidation step merges contributions into one response, retaining per-section provenance so the
reviewer sees who supplied what. A configurable sign-off chain moves the draft from case officer to
team leader to monitoring officer, each transition recorded in the existing audit event trail.
Escalation triggers fire on deadline risk, complexity threshold, a vexatious flag, or disagreement
over an exemption.

**Showcase.** An escalation-risk indicator at the exemption/drafting step, derived from published
escalation outcomes and regulator decision notices by exemption and theme — so the officer sees
where comparable requests were later overturned and drafts more defensibly. Internal reviews are
grounded in comparable regulator decision notices rather than drafted from scratch.

## 3. Partial section 21 — split between reuse and net-new, with percentage match

**Why.** Section 21 covers information already reasonably accessible by other means, which should be
signposted rather than re-answered. The difficult and very common case is a request **partly**
covered by an existing published response and **partly** new. Today this is an all-or-nothing
judgement.

**How.** Segment the incoming request into discrete askable elements, then match each element
independently against the disclosure log and previous responses, returning a **similarity score per
element**. Classify each element as **covered** (reuse and cite the published source), **partial**
(previously answered but now out of date — figures need refreshing), or **net new** (requires
retrieval).

**Showcase.** An element-level coverage panel showing a **% match per element** plus an overall
coverage figure — e.g. *"68% of this request is already answered"*. The draft is assembled as a
**hybrid response**: s.21 signposts with links for covered elements, newly retrieved content for the
remainder, outcome recorded as mixed rather than forced into one category.

**Considerations.** A threshold policy is needed to decide what level of match justifies relying on
s.21, and the judgement must remain with the officer — s.21 requires the information to be
reasonably accessible **to that particular applicant**. The overall coverage percentage also becomes
a useful efficiency measure, quantifying how much incoming demand is already met by published
material.

