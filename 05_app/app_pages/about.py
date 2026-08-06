"""About & Architecture — what the app does, how it maps to Snowflake, legal basis."""
import streamlit as st
from app_pages import _shared

_shared.inject_css()
st.title(":material/info: About FOI Sentinel")
st.caption(f"AI-assisted Freedom of Information case management for {_shared.council_name()}")

st.markdown("""
**FOI Sentinel** manages the complete UK local-government FOI/EIR lifecycle — from receipt to closure,
internal review and the ICO — with AI assisting at every stage and humans gating the legally sensitive decisions.
""")

st.subheader(":material/conveyor_belt: The lifecycle")
st.markdown("""
Each request becomes a **case** that moves through 17 stages, each with an owner and a statutory clock:
Receipt → Validity (s.8) → Regime (FOI/EIR/SAR) → SAR redirect → Duplicate/s.21 → Clarification →
Allocation → Search → Cost → Exemptions → **Public interest test** → **Redaction** → Drafting →
**QA/sign-off** → Dispatch → Publish (s.19) → Internal review / ICO (s.50).
""")

st.subheader(":material/smart_toy: Where AI assists vs. where humans decide")
c1, c2 = st.columns(2)
c1.success("**AI assists:** classification, duplicate/s.21 matching, routing, search, cost estimation, "
           "exemption flagging, response drafting, sentiment & urgency scoring.")
c2.warning("**Humans decide (gated):** public interest test, s.36 qualified-person opinion, "
           "final exemption decisions, **redaction verification**, QA sign-off, internal review.")

st.subheader(":material/database: Snowflake features used")
st.markdown("""
- **Cortex `COMPLETE` (mistral-large2)** — classification and response drafting
- **Cortex `SENTIMENT`** — requester tone / escalation risk
- **Cortex Search** — RAG over council/ICO guidance, past disclosures, and 11,420 real Camden FOI responses
- **Sector benchmarking** — peer FOI performance and cross-authority precedent from **WhatDoTheyKnow** (mySociety), reused under the Re-use of Public Sector Information Regulations 2015
- **GLA disclosure log** — full real request/response text scraped from london.gov.uk under the Open Government Licence; grounds drafting, exemption and evaluation
- **Escalation-risk** — grounded in the **ICO / Cabinet Office** accredited FOI statistics (annual 2025) blended with observed peer outcomes
- **Stored procedures** — stage engine, bank-holiday-aware clock, cost model, response generator
- **Append-only event log** — full audit trail for ICO defensibility
- Packaged as a **Snowflake Native App** for distribution to any authority
""")

st.subheader(":material/mail: Email & systems integration")
st.markdown("""
A real council does **not** key requests in by hand. The Freedom of Information shared mailbox feeds an
automated pipeline, and FOI Sentinel sits alongside existing systems as the **intelligence and analytics layer**.
""")
st.graphviz_chart("""
digraph G {
  rankdir=LR; bgcolor="transparent";
  node [shape=box style="rounded,filled" fontname="sans-serif" color="#b1b4b6" fillcolor="#f3f2f1" fontcolor="#0b0c0c"];
  edge [color="#505a5f" fontname="sans-serif" fontsize=10 fontcolor="#505a5f"];

  mailbox [label="FOI shared mailbox\\n(Outlook / Gmail)" fillcolor="#eef4fa"];
  connector [label="Microsoft Graph /\\nPower Automate"];
  portal [label="Web portal /\\nWhatDoTheyKnow" fillcolor="#eef4fa"];
  stage [label="Snowflake stage\\n(.eml + attachments)"];
  pipe [label="Snowpipe +\\nTask (auto-ingest)"];
  triage [label="Cortex triage\\n(classify, route, clock)" fillcolor="#e9f3ee"];
  board [label="Case board\\n(officers work it)" fillcolor="#e9f3ee"];
  records [label="Records / EDRMS\\n(SharePoint, etc.)" fillcolor="#fdeede"];

  mailbox -> connector -> stage;
  portal -> stage;
  stage -> pipe -> triage -> board;
  records -> triage [label="search & retrieve" style=dashed];
}
""")
st.markdown("""
- **Inbound:** the shared mailbox (and web/portal channels) deliver requests as `.eml` files into a Snowflake stage;
  **Snowpipe** ingests and a **task** runs Cortex triage automatically — the statutory clock starts on arrival.
- **Alongside existing systems:** records management (SharePoint / EDRMS), the corporate case system and finance
  systems keep their role; Snowflake adds the **AI triage, duplicate detection, deadline automation and analytics**
  that storage-only systems lack — analysing the whole request corpus in place (themes, trends, requester patterns).
- **Outbound:** responses and disclosure-log publication can flow back to the website and mailbox via the same connectors.
""")
st.caption("The Testing area includes an Email Intake demo that simulates steps 3–4 of this pipeline live.")

st.subheader(":material/balance: Legal basis")
st.markdown("""
- **Freedom of Information Act 2000** — s.1 (right of access), s.10 (20 working days), s.12 (cost limit),
  s.14 (vexatious), s.16 (advice & assistance), s.17 (refusal notices incl. internal-review + ICO routes),
  s.19 (publication scheme), s.21 (information accessible by other means), s.40 (personal data), s.50 (ICO complaints)
- **Environmental Information Regulations 2004** — EIR; no cost limit; 40-working-day extension for complex requests; statutory internal review (reg.11)
- **Data Protection Act 2018 / UK GDPR** — Subject Access Requests (1 month)
- **Fees Regulations 2004 (SI 2004/3244)** — £450/18h (local authority), £600/24h (central gov), four prescribed activities at £25/hr
- **s.45 Code of Practice** — request handling and performance reporting (Part 8.5)
""")
st.caption("This tool supports officers; it does not replace statutory decision-making. All withholding decisions require human sign-off.")
