# Statement of Work: FOI Sentinel — AI-Assisted Freedom of Information Case Management

### Powered by Snowflake AI Data Cloud

Version 1.0 — June 2026

---

## Executive Summary

UK public authorities are receiving more Freedom of Information (FOI) requests than at any point since the Act took effect, and those requests are growing in volume, complexity and legal sensitivity. In 2025, central government bodies alone received **94,526 FOI requests — a 14% rise on 2024 and the highest annual total since monitoring began in 2005**. Requests handled under the Environmental Information Regulations rose **45% year on year**. Every request carries a statutory clock: a substantive response is due within **20 working days**, with the regulator expecting authorities to answer at least **90% in time**.

The work itself is becoming harder. Officers must determine the correct legal regime, apply the right exemptions, run public interest tests, redact third-party personal data, draft a legally compliant response, and maintain a defensible audit trail — all within a fixed deadline, and all while volumes climb and teams stay the same size. Internal reviews and complaints to the Information Commissioner's Office (ICO) add a second tier of statutory work: in 2025 only **43% of internal reviews were completed within 20 days, down from 47%**, and known ICO complaints rose to **716**.

FOI Sentinel is an AI-assisted case-management platform built on Snowflake that manages the complete FOI lifecycle — intake, triage, deadline tracking, exemption assessment, redaction, response drafting, internal review and ICO escalation — and applies Snowflake Cortex AI to the tasks that consume officer time. The objective is straightforward: **use automation and learning to keep pace with rising demand, protect statutory compliance, and free skilled officers for the judgement-based work that genuinely needs them.**

---

## 1. The Problem

### 1.1 Demand is rising and will not slow

FOI demand has grown structurally, not cyclically. The 2025 central-government figures make the trend explicit:

- **94,526 requests received in 2025** — up **11,485 (+14%)** on 2024, the **largest annual total since the Act came into force in 2005**.
- **Environmental Information Regulations requests rose 45%** year on year (4,113 requests).
- Individual bodies absorbed disproportionate spikes — the Home Office alone received **2,382 more requests** than the previous year.

Local authorities are not part of the Cabinet Office's central-government monitoring, but they are bound by the same Freedom of Information Act 2000 and Environmental Information Regulations 2004, and they typically operate with smaller, less specialised teams. The pressure described in the national statistics is felt acutely at council level, where a single FOI officer may cover multiple regimes across every service area.

### 1.2 Requests are increasingly complex

The proportion of requests requiring careful legal judgement is growing. In 2025, of resolvable requests, **35% were withheld in full and 21% in part** — meaning more than half required an exemption decision rather than a simple release. Of all withheld requests:

- **26.6%** engaged the **cost limit (Section 12)** — requiring a defensible cost estimate against the £450 (local authority) / £600 (central government) appropriate limit.
- **2.7%** were refused as **vexatious or repeated (Section 14)** — requiring evidence of a pattern of behaviour.
- **70.7%** engaged **other exemptions (Sections 22–44)**, with **Section 40 (personal information)** the most commonly cited — the exemption most likely to require redaction and data-protection judgement.

Each of these is a distinct legal test. Applying them correctly, consistently and within deadline is skilled work that does not scale by adding more inboxes.

### 1.3 Statutory deadlines are strict and externally monitored

The 20-working-day deadline is a legal duty, not a service-level aspiration. Performance is published, benchmarked and regulated:

- The regulator expects authorities to answer **at least 90% of requests in time**; bodies below this threshold are actively monitored.
- In 2025, central government reached **87% in time** across all monitored bodies — still short of the 90% target despite improvement.
- Deadlines must be calculated in **working days excluding UK bank holidays**, with different rules for FOI (20 days), complex EIR requests (up to 40 days) and Subject Access Requests under the Data Protection Act 2018 (one calendar month).

### 1.4 The complaint and escalation burden compounds the problem

Dissatisfied requesters have two further statutory routes, each generating its own deadlined caseload:

- **Internal reviews** — in 2025, **4,720 reviews** were initiated on withheld requests; **28% overturned** the original decision fully or partially, and only **43% were completed within 20 days**.
- **ICO complaints** — **716 known complaints** to the Information Commissioner in 2025, up from 640 in 2024. An adverse decision notice is publishable and reputationally significant.

### 1.5 The resourcing gap

Demand is rising 14% a year; complexity is rising; statutory deadlines are fixed; and the regulator is watching. Teams cannot be scaled at the same rate. The only sustainable response is to **automate the repeatable work and apply learning to the judgement-heavy work** — triage, precedent retrieval, drafting and risk-flagging — so that officer time is concentrated where the law requires human decision-making.

---

## 2. Requirements

### 2.1 Functional requirements

| # | Requirement | Why it matters |
|---|-------------|----------------|
| F1 | **Multi-channel intake and case creation** | Requests arrive by email, web form and post; each must become a tracked case with a statutory clock. |
| F2 | **Automated triage and regime classification** | Determine FOI vs EIR vs SAR and route correctly — the first decision that sets the deadline and legal framework. |
| F3 | **Working-day deadline tracking** | Calculate and monitor the 20-day (and 40-day / 1-month) deadlines excluding bank holidays, with at-risk and overdue alerting. |
| F4 | **Exemption and cost-limit assessment** | Support Section 12 cost estimates and Section 22–44 exemption decisions with public interest tests. |
| F5 | **Redaction support** | Identify and redact third-party personal data (Section 40) before disclosure. |
| F6 | **Response drafting** | Generate legally structured, regime-correct draft responses grounded in precedent and guidance. |
| F7 | **Internal review and ICO workflow** | Manage the second-tier statutory caseload, outcome letters and ICO submission packs. |
| F8 | **Vexatious / repeat-requester detection (Section 14)** | Surface patterns of behaviour as an early prompt for officer judgement. |
| F9 | **Full audit trail** | Every action and decision logged for legal defensibility and regulator scrutiny. |
| F10 | **Council-agnostic configuration** | Cost limits, SLA targets, departments, lifecycle stages and bank holidays configurable per authority. |

### 2.2 Non-functional requirements

- **Automation by default** — repeatable steps (classification, deadline calculation, drafting) automated, with human gates where the law requires judgement.
- **Learning from precedent** — the system improves from the authority's own historical disclosures and a fine-tuned triage model.
- **Governance and security** — data remains in Snowflake; access is role-based; no information leaves the platform's governed boundary.
- **Transparency** — AI outputs are grounded in cited council and regulator guidance, never presented as unsourced fact.
- **Demonstrable compliance** — performance against the 90% target and statutory deadlines is measurable at any moment.

---

## 3. The Solution: FOI Sentinel on Snowflake

FOI Sentinel maps directly onto the problems above. It manages the full case lifecycle and applies Snowflake Cortex AI to the work that consumes officer time.

### 3.1 Full case lifecycle

A 17-stage lifecycle — from receipt, validity and classification through allocation, search, cost assessment, exemptions, redaction, drafting, QA, dispatch and publication to internal review — modelled as a single governed spine with a complete event-level audit trail. Deadlines are computed against a working-day calendar that excludes UK bank holidays, and each case carries a live RAG (red/amber/green) status against its statutory clock.

### 3.2 Cortex AI applied to the hard work

| Capability | Cortex feature | Problem addressed |
|------------|----------------|-------------------|
| **Triage and regime classification** | Cortex `COMPLETE` + a **fine-tuned classification model** | F2 — correct regime and routing at intake. Held-out accuracy improved from 62.5% (base) to 100% (tuned) on the evaluation set. |
| **Precedent retrieval** | **Cortex Search** over the authority's disclosure log and policy library | F4, F6 — ground decisions and drafts in what the authority has lawfully released before. |
| **Response drafting** | Cortex `COMPLETE` grounded in retrieved precedent | F6 — produce regime-correct, legally structured drafts for officer review. |
| **Sentiment and Section 14 signals** | Cortex `SENTIMENT` + repeat-requester analysis | F8 — flag persistently hostile, high-volume or repeated patterns for human assessment. |
| **Guidance assistant** | Cortex `COMPLETE` grounded in council and ICO guidance | Officer support — a page-aware, caseload-aware assistant for tailored advice. |

### 3.3 Delivery

The platform is delivered as a Streamlit application on **Snowpark Container Services**, deployed entirely within the authority's Snowflake account. There is no separate data estate to secure: case data, the precedent corpus, the AI models and the application all sit inside one governed boundary.

---

## 4. Value Delivered

| Problem | FOI Sentinel response | Value |
|---------|----------------------|-------|
| Demand rising 14% a year | Automated intake, triage and deadline tracking | Capacity scales with automation, not headcount. |
| Increasing legal complexity | Exemption support, cost estimates, precedent retrieval | Faster, more consistent and more defensible decisions. |
| Strict 20-day deadlines, 90% target | Working-day clocks, at-risk/overdue alerting, live performance against target | Compliance is visible and managed before breaches occur. |
| Inconsistent decisions | Grounding in the authority's own precedent and guidance | Consistency across officers and over time. |
| Internal review and ICO burden | Dedicated second-tier workflow, outcome letters, ICO packs | Reduced escalation effort and stronger position on appeal. |
| Audit and scrutiny | Event-level audit trail on every case | Defensible record for the regulator and the tribunal. |

The strategic outcome: **skilled officers spend their time on the legal judgement the Act requires, while the platform absorbs the repeatable, deadline-driven work that rising volume would otherwise make unmanageable.**

---

## 5. Architecture Summary

- **Data model** — a case spine (`FOI_CASE`, `FOI_CASE_EVENT`) with artefact tables for cost, exemptions, redaction, response, internal review, ICO complaint and publication; a 17-stage lifecycle; and a working-day calendar including UK bank holidays. Council-agnostic configuration is held in a dedicated configuration table.
- **Cortex services** — a fine-tuned triage model; Cortex Search services over council policy, the disclosure log and the historical FOI response corpus; and Cortex `COMPLETE` / `SENTIMENT` for drafting, advice and signal detection.
- **Application** — a multi-page Streamlit app (Command Centre, Cases, Reviews & ICO, Knowledge & Guidance, intake and configuration) deployed on Snowpark Container Services, with a global AI assistant available on every page.
- **Governance** — all data and inference remain within the authority's Snowflake account under role-based access control.

---

## Appendix A: Legal Framework

- **Freedom of Information Act 2000** — 20-working-day deadline; Section 12 (cost limit); Section 14 (vexatious/repeated); Section 17 (refusal notices); Sections 21–44 (exemptions, including Section 40 personal information).
- **Environmental Information Regulations 2004** — environmental information; up to 40 working days for complex requests; no cost-limit refusal.
- **Data Protection Act 2018** — Subject Access Requests; one-calendar-month deadline; redaction of third-party personal data.
- **Regulatory oversight** — the Information Commissioner's Office monitors timeliness (90% expectation), investigates complaints and issues decision notices; Section 50 sets out the complaint route.

## Appendix B: References

- Cabinet Office, *Freedom of Information statistics: annual 2025* (published 29 April 2026) — request volumes, timeliness, outcomes, exemptions, internal reviews and ICO complaints. https://www.gov.uk/government/statistics/freedom-of-information-statistics-annual-2025
- Cabinet Office, *Freedom of Information statistics* (collection). https://www.gov.uk/government/collections/freedom-of-information-statistics
- Freedom of Information Act 2000. https://www.legislation.gov.uk/ukpga/2000/36/contents
- Environmental Information Regulations 2004. https://www.legislation.gov.uk/uksi/2004/3391/contents
- Information Commissioner's Office. https://ico.org.uk/

---

*All statistics cited are drawn from the Cabinet Office's accredited official statistics for central government and are used here as the authoritative public benchmark for FOI demand and performance. Local authorities are bound by the same legislation but are not part of central-government monitoring.*
