# FOI Sentinel: FAQ and battlecard

A quick-reference card for live demos and follow-up conversations. Each question has a **short answer** (the line to say out loud) and **supporting detail** (the proof points if pressed). Written to the standing demo copy rules: professional British English, plain sentences.

---

## 1. How was the cost calculation reached? (the £137.50 on FOI-2026-0115)

**Short answer.** It mirrors the statutory FOIA fees rules. This case is estimated at 5.5 officer-hours, charged at the prescribed £25 per hour, giving £137.50, comfortably under the £450 appropriate limit for local government.

**Supporting detail.**
- The `SP_COST_ESTIMATE` procedure computes `total_hours = determine + locate + retrieve + extract`, then `total_gbp = total_hours × rate_per_hour`, and flags `exceeds = total_gbp > limit`.
- The two constants are pulled live from `COUNCIL_CONFIG`: rate `£25/hour`, limit `£450`. They are not arbitrary. They mirror the **Freedom of Information and Data Protection (Appropriate Limit and Fees) Regulations 2004**:
  - **£25/hour** is the prescribed rate (reg. 4(4)).
  - **£450** is the appropriate limit for local government (reg. 3), which is £25 × 18 hours, so the limit is effectively an 18-hour ceiling of chargeable officer time.
  - Only **four activities count** toward the limit (reg. 4): determining whether the information is held, locating it, retrieving it, and extracting it. Reading time, redaction, and considering exemptions are excluded by law.
- The engine is regime-aware. For **EIR** cases it sets no limit and `exceeds = false`, because the Fees Regulations do not apply to environmental information (there is no cost-limit refusal under EIR).
- Worth stating plainly: this is a **proportionality estimate**, the same test an officer applies today to decide whether a request can be refused under section 12 as too costly. The product simply makes it transparent and repeatable.

**If asked "why so cheap to run then?"** That £137.50 is the *manual* cost of a human working the request. The **AI cost card** on the same case shows the platform handled the triage, grounding, drafting, and self-check for roughly £0.11 of live-metered Cortex usage (the exact figure varies per run), which is on the order of a thousand times cheaper. The point is not that officers disappear, it is that their time moves to judgement rather than retrieval.

---

## 2. What is an FOI?

**Short answer.** A Freedom of Information request. Under the Freedom of Information Act 2000, anyone can ask a public authority for recorded information it holds, and the authority must respond within 20 working days.

**Supporting detail.**
- Governs **recorded information any authority holds**, regardless of who is asking or why.
- Statutory deadline is **20 working days** (s.10).
- Exemptions can apply (for example s.40 personal data, s.21 already published, s.14 vexatious or repeated), and cost can be a ground for refusal under s.12 once the £450 limit is exceeded.

---

## 3. What is a SAR?

**Short answer.** A Subject Access Request. Under UK GDPR Article 15 and the Data Protection Act 2018, a person asks for a copy of their **own** personal data, and the authority must respond within one calendar month.

**Supporting detail.**
- The key difference from FOI is scope: a SAR is about **the requester's own personal data**, not general information the authority holds.
- Deadline is **one calendar month** (extendable by two further months for complex requests).
- Identity must be verified before any data is released. In the demo the request is held pseudonymised until identity is confirmed out of band against the council's own records.
- Third-party personal data must be removed before release, which is what the Redaction Studio does. The requester keeps their own data, and third-party personal data is withheld under the UK GDPR Article 15 balancing test in the Data Protection Act 2018. It is never released automatically: an officer reviews and signs off each item. (Section 40 is the parallel FOIA exemption. For a SAR the correct basis is the Article 15 third-party balancing test, so we phrase it that way.)
- There is **no cost-limit refusal** for a SAR in the way FOIA has one.

---

## 3a. When you say the SAR redaction "learns from officer decisions", what actually happens?

**Short answer.** Two different things, and it matters to keep them apart. Today the app **remembers individual officer decisions** and re-applies them deterministically the next time the same detail appears. It does **not** retrain or fine-tune the AI model from those decisions. Model fine-tuning is a separate, optional, later step (see question 8).

**Supporting detail.**
- **What happens today (deterministic recall).** When an officer keeps or redacts a specific value in the Redaction Studio, that decision is written to a `SAR_REDACTION_DECISION` table (the value, the action of keep or redact, and a timestamp). The next time the same value is detected, the app looks up the most recent decision for that value and pre-applies it, so the officer is not asked the same question twice. This is a governed lookup, not machine learning. It is exact-match recall of a human decision, and it is fully auditable because every decision is stored with its timestamp.
- **Why we are careful with the word "learn".** The extraction model itself (`arctic-extract` behind `AI_EXTRACT`) is a fixed Cortex function. It does not change its weights because an officer made a decision. Saying "the model learns" would overclaim. The accurate phrasing is "the app remembers and re-applies officer decisions".
- **What "learning" in the model sense would require (the future step).** To actually improve the extraction model on a council's own document formats, you would fine-tune `arctic-extract` on labelled examples. That is a deliberate, offline training activity that runs in AWS Frankfurt in the EU, and the tuned model becomes a Frankfurt-region asset. It is available if a customer wants domain-specific accuracy gains, but the demo uses none of it. Full detail is in question 8.
- **The honest one-liner for the room.** "Every officer decision is remembered and re-applied automatically, and if you later want the model itself to get sharper on your documents, that is a separate fine-tuning step we can scope."

---

## 4. What is an EIR?

**Short answer.** An Environmental Information Regulations 2004 request. It is the parallel regime to FOI for environmental information such as air, water, land, and emissions, with a stronger presumption of disclosure.

**Supporting detail.**
- Covers **environmental information** (the state of the environment, emissions, measures affecting it, and related economic analyses).
- Same **20 working day** clock as FOI, but extendable to **40 working days** for complex or voluminous requests (reg. 7).
- **No cost-limit refusal.** The FOIA £450 limit does not apply, which is why the cost engine returns no limit for EIR cases.
- Stronger **presumption in favour of disclosure**, and exceptions are subject to a public-interest test.

---

## 4a. Do you show an EIR worked example in the demo?

**Short answer.** Not end to end. The demo works two requests in full, an FOI (senior-officer salaries) and a SAR (subject access with redaction). EIR is modelled as a first-class regime throughout, so you see it as a filterable regime on the caseload and it runs on the same pipeline, but we do not open and answer a single EIR case on screen.

**Supporting detail.**
- **Why it is safe to say the platform handles EIR.** EIR shares the intake, triage, precedent-matching, drafting and audit path with FOI. The differences are configuration, not a separate engine: no cost-limit refusal, a deadline extendable to 40 working days, and a stronger presumption of disclosure. The cost engine already returns no limit for EIR cases (see question 1).
- **Where you can see it in the demo.** On the caseload List view the FOI, EIR and SAR filter chips narrow the queue by regime, and the pipeline stages and glossary reference EIR directly.
- **The honest framing for the room.** We chose one FOI and one SAR as the two worked examples because they show the widest span of behaviour: a grounded disclosure with citations, and third-party redaction under the UK GDPR Article 15 balancing test. An EIR case would exercise the same path with the environmental-information rules applied. If a customer wants an EIR walkthrough, it is a scripting exercise on the existing pipeline, not new build.

---

## 5. How do we connect to Microsoft?

**Short answer.** Two governed connections, both landing directly in Snowflake with no middleware. Email arrives from Outlook through the Microsoft Graph API, and documents mirror from a SharePoint library through Openflow.

**Supporting detail.**
- **Inbound email (Outlook).** Snowflake calls Microsoft Graph directly to read the shared FOI mailbox. Authentication is **app-only OAuth 2.0 (client-credentials)** with the **`Mail.ReadWrite` application permission** and tenant admin consent, against a licensed member mailbox (`foi@…`). The connection is defined by a Snowflake **External Access Integration** that binds a **network rule** (egress limited to `graph.microsoft.com` and `login.microsoftonline.com`) and the client secret held in a Snowflake **SECRET** object. A stored procedure polls for unread mail, lands it, and kicks off triage. There is no intermediate integration server to run or secure.
- **Documents (SharePoint).** The council's SharePoint document library is mirrored into Snowflake **continuously** using **Openflow**, Snowflake's managed ingestion service (built on Apache NiFi). It runs a change-data-capture connector, so when a file is saved it is pulled into Snowflake within minutes and made searchable. In the demo, saving a file in SharePoint surfaces it in the SAR findings on the next refresh.
- The headline for buyers: **Microsoft 365 stays the system of record for mail and documents.** The platform reads from it through Microsoft's own supported APIs, so there is no rip-and-replace and no shadow copy outside the governance model.

---

## 6. How secure is the connection?

**Short answer.** It uses Microsoft's standard OAuth with least-privilege permissions, no stored user passwords, secrets held in Snowflake's managed secret store, and outbound traffic locked to Microsoft's endpoints only. All processing happens inside the Snowflake governed boundary.

**Supporting detail.**
- **Modern auth, no passwords.** Connections use **OAuth 2.0 client-credentials** (app registrations in Entra ID). There are no service-account passwords stored anywhere in the app.
- **Least privilege.** The mailbox app has only **`Mail.ReadWrite`**, granted by explicit tenant admin consent. Permissions can be narrowed further (for example read-only) per customer policy.
- **Secrets are managed, not in code.** The client secret lives in a Snowflake **SECRET** object, referenced by an External Access Integration. It never appears in application code or query text.
- **Egress is allow-listed.** A Snowflake **network rule** restricts outbound calls to `graph.microsoft.com` and `login.microsoftonline.com` only. Snowflake cannot call arbitrary hosts.
- **Governed processing.** Retrieval, AI, and drafting all run inside Snowflake. Sensitive data is protected in the data layer through masking and row-access policies, and the SAR redaction path removes third-party personal data before release.
- **Auditable by design.** Every AI decision on a case is **hash-chained and tamper-evident**. Prompts are stored as hashes rather than raw personal data, which keeps the trail ICO-ready and deletion-compliant.
- **Customer-controlled identity.** The app registrations, consent, and secrets live in the customer's own Entra tenant, so the customer can rotate or revoke access at any time.

---

## 7. Does data leave the UK or EU?

**Short answer.** Your data at rest stays in the region you choose, for example AWS Europe (London). The nuance to be precise about is the AI. A few of the functions this app uses run natively in London today, and the generative ones do not, so you either keep everything in-region with a reduced model set, or you enable cross-region inference scoped to the EU, where the request is processed transiently inside the EU and no data is stored outside London.

**What runs natively in AWS Europe (London), eu-west-2, today.** Checked against the Snowflake regional-availability documentation:
- `AI_EXTRACT` (the `arctic-extract` model), which is the engine behind the SAR redaction path.
- The embedding models (`snowflake-arctic-embed`, `multilingual-e5-large`) that power Cortex Search retrieval.

**What is not native in London today, so needs cross-region inference.**
- `AI_COMPLETE` (used for triage reasoning, drafting, the "why this outcome" summary, and peer benchmarking).
- `SENTIMENT` and `AI_CLASSIFY`.
In the EU, these generative functions run natively only in **AWS Frankfurt** and **AWS Ireland**, not London.

**How cross-region inference protects residency.** It is a single account-level switch, `CORTEX_ENABLED_CROSS_REGION`, and you choose the boundary:
- Set it to **`AWS_EU`** and requests are only ever processed in AWS EU regions (Frankfurt or Ireland).
- Your customer data remains stored only in your home region (London). Only the transient inference payload (the prompt in, the answer out) travels, encrypted, to the processing region, and nothing is persisted there.
- Within one cloud provider the traffic stays on the provider's private backbone and never touches the public internet. There are no data-egress charges.

**So the honest position for a London customer.**
- For the **full pipeline**, enable cross-region inference scoped to **`AWS_EU`**. Data at rest stays in the UK, and inference is processed transiently within the EU (which may be Frankfurt or Ireland, so EU but not strictly UK-only), with nothing stored outside London.
- For **strict UK-only** processing, set the parameter to `DISABLED`. You then keep to what is native in London (redaction extraction and search), and the generative drafting features would need a different design. This is the trade-off to put in front of the customer's information-governance and security teams.
- **Microsoft 365 residency** is set on the customer's own tenant (UK data residency is available for M365), and the platform only reads from those services.
- **Demo caveat, stated plainly.** The live demo runs in a US West Snowflake region because it is an internal account, so it is not a residency reference. The customer's answer is the region they choose.

---

## 8. Can we fine-tune or customise the models, and where does that run?

**Short answer.** Yes, Snowflake Cortex Fine-tuning is generally available, and in Europe it runs only in AWS Frankfurt. It is a separate activity from inference, and a fine-tuned model cannot be reached through cross-region inference, so the training and the serving both have to be handled deliberately by region.

**What the product can fine-tune.**
- Base chat models: `llama3-8b`, `llama3-70b`, `llama3.1-8b`, `llama3.1-70b`, `mistral-7b`, `mixtral-8x7b`.
- `arctic-extract`, the model behind `AI_EXTRACT`. This is the most relevant one for this app, because it is the engine that finds third-party personal data in SAR documents. Fine-tuning it on council document formats could sharpen redaction accuracy.

**Where it runs (checked against the docs).** Cortex Fine-tuning is GA in four regions only: AWS US West 2 (Oregon), AWS US East 1 (N. Virginia), **AWS Europe Central 1 (Frankfurt)**, and Azure East US 2 (Virginia). In the EU that means **Frankfurt is the only option**, which matches the expectation that tuning is a Frankfurt exercise.

**The catch that shapes the architecture.** Cross-region inference does **not** support fine-tuned models. Inference on a tuned model must happen in the same region where the model object lives. To use a Frankfurt-trained model from another region, you replicate the model object there using database replication, and the target region must natively support the base model's `COMPLETE`. In practice a customised model is a Frankfurt-region asset, served either from Frankfurt or from another EU region it is replicated into (for example Ireland), and it is not something a London-only account can call through the cross-region switch.

**Where this leaves the demo.** The current app uses **no fine-tuning**. Everything is base models, prompt engineering, and retrieval-augmented grounding, which is deliberately the lower-cost, faster-to-deploy path. Fine-tuning is available as a later step if a customer wants domain-specific accuracy gains, and it would be scoped as a Frankfurt activity with a replication plan for serving.

---

## 9. Can Microsoft Dynamics be included in the workflow or pipeline?

**Short answer.** Yes, and it is a realistic production requirement, though it helps to be precise about what Dynamics actually powers. In UK councils, Microsoft Dynamics 365 is most often the CRM and case-management layer (customer service, complaints, contact history), which is exactly the kind of data an FOI or SAR pipeline benefits from. The committee and democracy portals are usually a different product, commonly Modern.gov by Civica, so a production app may need to interface with both.

**A quick accuracy note on democracy portals.** Westminster's committee and councillor pages, for example, run on **Modern.gov** (the councillor lookup sits at `committees.westminster.gov.uk/mgFindMember.aspx`, and the `mg…aspx` pages are the Modern.gov signature), which is Civica's democratic-services software rather than Dynamics. So the pattern to describe to a customer is: Dynamics for CRM and case management, Modern.gov or a CMIS product for committee and democracy content, and the platform can ingest from either.

**How Dynamics would connect.** Through the same governed, API-based pattern already used for Outlook and SharePoint. Dynamics 365 and its underlying **Dataverse** expose data through the **Dataverse Web API (OData)**, **Microsoft Graph**, and **Azure Synapse Link for Dataverse**. Openflow can ingest from these APIs, or Synapse Link can land data in storage that Snowflake reads. Authentication is the same modern OAuth model, with least-privilege scopes and secrets held in Snowflake.

**What it would add.**
- Ground answers on the council's own **case, complaint, and contact records** held in Dynamics, so a response reflects the real operational history.
- **Write FOI and SAR outcomes back** into Dynamics, so the case-management system of record stays current and officers keep one worklist.
- Pull **committee and decision content** from Modern.gov or a CMIS product where a request touches democratic-services information.

**Governance stays consistent.** Because the data lands in Snowflake, the same masking, row-access, and audit controls apply, so adding Dynamics or Modern.gov does not create a new ungoverned path.

**Honest framing for the room.** None of these connectors are in the current demo. The architecture is designed to add Microsoft and council-sector sources through the same governed approach, so Dynamics is an integration exercise on the roadmap rather than a redesign.

---

## 10. How does the system decide a case's lane (Quick wins / Needs review / Complex)?

**Short answer.** Cortex triages every case and sorts it into one of three work lanes by how much officer judgement it needs. The split is rule-based and explainable, and a human always confirms.

**Supporting detail.**
- **Quick wins** - a strong precedent match (85% or higher) at low complexity, or information already published (s.21). The AI has pre-drafted a reply, so the officer reviews and sends the batch.
- **Needs review** - the everyday middle. The AI has triaged the case and, where a close precedent exists, drafted a reply. The officer checks and confirms before it goes.
- **Complex** - flagged for human judgement when the case is potentially vexatious (s.14), scores high on complexity, engages a public-interest balancing test, or applies two or more exemptions. The AI does **not** pre-draft these. Each complex card shows the concrete driver plus the AI complexity factors, so the reason is on screen.
- Complexity is scored zero to ten by Cortex with the drivers shown. It is advisory. An officer always makes the final call.

## 11. What makes a case "At risk"?

**Short answer.** It is a deadline signal, kept separate from complexity. A case is At risk when it has five or fewer working days to its statutory deadline, or is already overdue.

**Supporting detail.**
- Every case runs on the statutory clock: 20 working days for FOI and EIR, one calendar month for a SAR.
- The traffic-light status is **RED** at five or fewer working days remaining, **AMBER** at ten or fewer, **GREEN** beyond that. "At risk" means RED or overdue.
- Deadline urgency and the work lane (effort) are independent axes, so a case can be At risk in any lane. The queue floats the most urgent cases to the top automatically.

## 12. How does the system decide what to withhold, and why is something a "partial"?

**Short answer.** Each exemption the officer considers is recorded with a decision, either apply (withhold) or disclose (release), and a reason. A partial is a case where some information is released and some is withheld under an exemption.

**Supporting detail.**
- Worked example, FOI-2026-0115 (staff grievances): the aggregate yearly totals are released, because they identify no one, and the year-by-year outcome breakdown is withheld under **s.40(2)**, because low cell-counts could identify individual employees.
- The reasoning is shown in plain English in the Response Studio's **"Why this is a partial disclosure"** panel (what we release, what we withhold and why), grounded in the recorded exemption assessments rather than AI narration.
- **s.40(2)** (third-party personal data) is an absolute exemption, so no public-interest test applies. Qualified exemptions that do require a public-interest balancing test push a case into the **Complex** lane for human judgement, which keeps that decision with an officer.

## 13. Where do the five pipeline stages on the Command Centre come from, and is this typical council practice?

**Short answer.** They are our five-step roll-up of the full statutory FOIA lifecycle, keyed to the sections of the Act and the s.45 Code of Practice. Councils do not all publish an identical "five stages", so this is a representative, configurable model rather than a fixed legal standard.

**Supporting detail.**
- Under the hood we track 17 granular lifecycle stages. The Command Centre rolls them into five process phases so a manager sees the shape of the backlog at a glance, then expands any phase to the detailed stages.
- The five phases map directly to the law: **1. Receipt and logging** (s.8 valid request, s.10 twenty working days), **2. Triage and allocation** (s.16 duty to advise and assist), **3. Retrieval and cost** (s.12 appropriate cost limit), **4. Review, redaction and PIT** (s.40 and s.43 exemptions, s.45 Code on handling), **5. Sign-off and disclosure** (s.17 refusal notice content). A sixth **Challenge** step covers s.50 internal review and ICO.
- This mirrors how the ICO, the LGA and IRMS describe good practice: receive and log, clarify and route, locate and retrieve, consider exemptions and redaction, respond, then handle any review. The wording and grouping vary council to council, which is why phases and stages are held as editable configuration.

## 14. What formats do councils typically receive FOI, EIR and SAR requests in?

**Short answer.** Mostly by email to a central information-governance inbox, through the council's online request form, via the WhatDoTheyKnow website, and by post. The rules on format differ by regime.

**Supporting detail.**
- **FOI** must be made in writing (s.8 FOIA), so the common channels are email, the council web form, letter, and WhatDoTheyKnow (mySociety), which emails the request into the council FOI inbox and publishes both request and reply.
- **EIR** requests can be made verbally as well as in writing, because the regulations do not require a written request, so a phone call or a counter enquiry can count.
- **SAR** requests can be made verbally or in writing and through any channel, including social media, and the requester does not have to mention the DPA or use the words "subject access".
- In practice the dominant volume arrives by email and the online form, with WhatDoTheyKnow a significant share of FOI, which is why the demo models the Outlook mailbox and web-portal intake paths.

## 15. What is the s.12 cost limit, and how much is the maximum?

**Short answer.** Under section 12 FOIA an authority can refuse a request if answering it would exceed the "appropriate limit". For a local authority that limit is **£450, which is 18 hours of work at the statutory flat rate of £25 per hour**. For central government it is higher at £600 (24 hours).

**Supporting detail.**
- The limit is set by the Freedom of Information and Data Protection (Appropriate Limit and Fees) Regulations 2004. Only four prescribed activities count towards it (reg. 4): determining whether the information is held, locating it, retrieving it, and extracting it.
- Reading time, redaction, considering exemptions and legal advice do **not** count towards the s.12 limit.
- If the estimate exceeds the limit the authority may refuse, or offer to proceed if the requester pays for the work above it. A duty to advise and assist (s.16) means the officer should suggest how to narrow the request to bring it under the limit.
- **EIR has no cost limit.** For environmental information the Fees Regulations do not apply; instead the deadline can be extended to 40 working days for complex or voluminous requests (reg. 7).
- In the demo the limit, rate and hours are held in `COUNCIL_CONFIG` (`COST_LIMIT_GBP`, `COST_LIMIT_HOURS`, `COST_RATE_PER_HOUR`) and `SP_COST_ESTIMATE` applies the four-activity test, so an authority can switch to the central-government figures without code changes.

## 16. How does the system spot an s.21 "already published" duplicate?

**Short answer.** At triage the request is compared with the council's own already-published answers using Cortex `AI_SIMILARITY`. When the closest match scores 85 per cent or higher, the case is auto-flagged as a likely s.21 duplicate and an s.21 reuse reply is pre-selected that points the requester to where the information is published.

**Supporting detail.**
- s.21 FOIA exempts information that is already reasonably accessible to the applicant, which includes anything the authority has itself published. The check therefore runs only against **this council's own** published corpus (its disclosure log and prior clean disclosures), not other authorities.
- The match threshold is configurable (`S21_SIMILARITY_THRESHOLD`, default 0.85). Raising it reduces false positives; lowering it catches more near-duplicates.
- It is a triage-stage signal. Cases already past retrieval are not re-flagged, and a human always confirms before an s.21 response is sent.
- s.21 is a FOIA provision, so the check is limited to FOI. EIR handles already-available information separately under reg. 6.

## One-line regime cheat-sheet (for quick recall)

| Regime | Law | What it covers | Clock | Cost limit |
| --- | --- | --- | --- | --- |
| **FOI** | FOIA 2000 | Any recorded information the authority holds | 20 working days | Yes, £450 (18h) under s.12 |
| **EIR** | EIR 2004 | Environmental information | 20 working days, up to 40 for complex | No |
| **SAR** | UK GDPR Art. 15 / DPA 2018 | The requester's own personal data | 1 calendar month | No |
