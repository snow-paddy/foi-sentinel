# SAR Scope — "SARs on Snowflake" (A4, WI-10)

Discovery for turning FOI Sentinel's single-PDF SAR demo into a compelling **Subject Access
Request** story for UK local authorities. Research date 2026-07-03 (xo-discover, 3 parallel
angles + current-app review). Figures marked *(unverified)* come from practitioner consensus,
not authoritative published stats — confirm before quoting to a client.

---

## 1. Why SARs are a *new topic* (not just "FOI for one person")

SARs are legally and operationally distinct from FOI. An FOI team must learn these deltas —
and the product must encode them:

| Dimension | SAR (UK GDPR Art 15 / DPA 2018) | FOI (FOIA 2000) |
|---|---|---|
| Requested | The requester's **own** personal data | Any recorded information |
| Clock | **1 calendar month** (ICO advises 28-day internal target) | 20 working days |
| Extension | +2 months if complex/numerous (tell requester within month 1) | Public-interest-test only |
| Cost escape | **None** — no s.12-style limit; "manifestly excessive" is a high bar | s.12 £450/18h appropriate limit |
| Third-party data | **Balancing test** — disclose unless unreasonable; seek consent; redact | s.40(2) **absolute** exemption |
| Clock start | Pauses pending **ID verification / clarification / (rare) fee** | Starts on receipt |
| Extras | Must also give **supplementary info** (Art 15: purposes, recipients, retention, source, rights, automated decisions) | Just the information |

**Council-specific legal weight (must not miss):**
- **Special "serious harm" regimes** for **social work / health / education** data (DPA 2018 Sch 3) — a *higher* bar than the general third-party test; social care is where this bites.
- Exemptions councils lean on: crime & taxation (fraud/revenues), legal professional privilege, confidential references, management forecasts, negotiations.
- **ID & authority**: verify requester; agents (solicitors, claims firms) need written authority; children (Gillick competence); capacity (LPA/deputy). Each pauses the clock.
- Get it wrong → ICO complaint/reprimand/enforcement (right-of-access is the ICO's largest public complaint category), s.167 court order, s.168 compensation (distress, no financial loss needed), s.173 criminal offence for concealment.

---

## 2. Where the data lives + current tooling (the pain to disrupt)

**Data is scattered across silos** — a SAR must search all of them:
- **Microsoft 365**: SharePoint Online, OneDrive, **Exchange/Outlook email**, Teams. (Often only ~30-40% of in-scope data.)
- **Line-of-business**: adult/children's **social care** (Mosaic, LiquidLogic, Eclipse), housing (Civica Cx, NEC), revenues & benefits, education/SEN (Capita ONE, Synergy), HR/payroll (iTrent).
- **Network file shares, legacy EDRMS, paper/scanned records.**

**Effort epicentre (the wedge): social care.** ~30-50% of SAR volume but ~70%+ of effort; complex children's/care-leaver SARs run **80-200+ hours**, 2,000-10,000+ pages *(unverified)*.

**Current tools & their ceiling:**
- **Microsoft Purview eDiscovery** — searches M365 only; **no redaction, no third-party detection, no non-M365 sources, no dedupe**; needs E5; built for litigation, not SAR disclosure.
- **Case management**: Civica **iCasework** (market leader), Jadu/Granicus, OneTrust; smaller councils on **Excel + Outlook** *(unverified)*.
- **Redaction**: **Objective Redact** dominant, Adobe Acrobat; **manual redaction is the #1 cost** — a legal judgement page by page that today's tools barely automate.

**The gap in one line:** no single federated search across all sources + no AI third-party detection/redaction + no cross-source dedupe + no SAR-specific audit. That is exactly the Snowflake opportunity.

---

## 3. The compelling Snowflake story

**Positioning: "One governed place to find, review, redact and disclose a data subject's records across the whole estate — with the AI doing the first-pass third-party review."** Beats Purview because it is *not* M365-only and it *does* redact.

**Reference architecture (all GA unless flagged):**
1. **Ingest** → **Openflow SharePoint connector (GA)** incl. a **Cortex Search + ACL** variant that auto-parses docs and builds the search service. OneDrive uses the same SharePoint API. **Exchange/email has NO GA connector** → interim: Purview eDiscovery export → Azure Blob/ADLS → **external stage**. LOB structured data → COPY/Snowpipe.
2. **Process** → **AI_PARSE_DOCUMENT (GA)** layout/OCR; **AI_CLASSIFY (GA)** to tag doc type/exemption; **SYSTEM$CLASSIFY / auto-tagging (GA, Enterprise+)** to discover PII columns in structured data (custom classifiers for NI/NHS/UPRN).
3. **Find the subject** → **Cortex Search (GA)** across all sources by name/identifiers, ACL-filtered — the federated search Purview can't do.
4. **Extract & redact** → **AI_EXTRACT (GA, scores=>TRUE)** selective third-party detection (our existing pattern) + **AI_FILTER** "does this mention <third party>?"; human-in-the-loop review of low-confidence hits.
5. **Govern the structured tier** → **tag-based masking + row-access policies (GA)**: subject's own rows disclosable, third-party rows/cols masked; disclosure bundle visible only to the assigned officer.
6. **Disclose + audit** → governed bundle export; **ACCESS_HISTORY / QUERY_HISTORY** = full ICO-defensible provenance.

**Reuse from FOI Sentinel (big):** AI_PARSE_DOCUMENT pipeline ✓, AI_EXTRACT selective redaction ✓ (already live in /redaction), Cortex Search ✓, **A5 FOI_AI_USAGE cost metering ✓** (add SAR_ID). Search layer + redaction engine are the same — SAR queries by *data subject*, FOI by *topic*.

**Honest gaps/risks:** no GA Exchange connector (email via eDiscovery export); AI redaction must stay human-reviewed (use scores to flag); **residency** — our demo account is us-west-2, a real UK deployment wants a UK/EU region (Openflow SharePoint + Cortex available in EU); classification/auto-tag needs Enterprise+.

---

## 4. Pricing — bake it in properly

Per-SAR cost = **variable** (Cortex per document) + **platform fixed** (search serving, Openflow, storage):

| Lever | Unit | Estimate method |
|---|---|---|
| AI_PARSE_DOCUMENT | credits/page | avg docs×pages per SAR (social care = thousands) |
| AI_EXTRACT | credits/page (~970 tok/pg) + output tokens | questions × docs; pre-estimate with `AI_COUNT_TOKENS` |
| AI_REDACT / AI_FILTER | input+output tokens | disclosure text volume |
| Cortex Search | serving credits/GB-month + query compute | corpus GB / SARs per month (AUTO_SUSPEND to cut idle) |
| Warehouse + storage + Openflow runtime | credits/sec, $/TB, runtime | usually small vs Cortex |

**Method:** profile a representative SAR (docs/pages/questions) → `AI_COUNT_TOKENS` → credits via the Consumption Table → add pro-rata serving. **Reuse A5**: extend `FOI_AI_USAGE` with `SAR_ID`/source and reuse `FOI_AI_COST_ROLLING` for a **measured per-SAR cost** the same way we did for FOI. The buyer story writes itself: manual SAR **£300-£5,000+** (social care) *(unverified)* vs a **measured** Cortex cost per SAR.

---

## 5. Current app state (what exists to build on)
- `/redaction` Redaction Studio: single staged PDF (`SAR_STAGE/sar_casefile.pdf`), `SAR_CASE_SUBJECT` (James Whitfield). `runRedactionDemo` = AI_PARSE_DOCUMENT LAYOUT + AI_EXTRACT selective (keep requester, redact third parties, switchboard allow-list) + confidence chips. This proves the **unstructured** tier only, one source, one doc.
- Missing for the SAR story: multi-source **federated search**, the **structured tier** (masking/row-access + PII classification), SAR-specific **legal framing** (1-month clock, third-party balancing, supplementary info, extensions), **per-SAR cost**, cross-source dedupe.

---

## 6. Approach options (Orient)

- **A — Full production SAR module** (ingest M365+LOB, workflow, case mgmt). Pros: complete. Cons: huge; Openflow/Exchange infra; not a demo.
- **B — Demo slice that tells the whole story (RECOMMENDED).** Extend the Redaction Studio into a "SAR across the estate" demo: (1) **federated search** — Cortex Search over a SharePoint-style unstructured corpus + a structured LOB table, find all of a subject's records; (2) **structured-tier governance** — a synthetic social-care/CRM table with tag-based masking + row-access + AI_CLASSIFY PII tagging, showing subject rows disclosed / third-party masked; (3) **legal framing** — 1-month clock, third-party *balancing* (vs FOI absolute), supplementary-info checklist; (4) **measured per-SAR cost** via A5 metering. Reuses parse/extract/search/metering. Pros: compelling, honest, buildable, differentiates vs Purview. Cons: synthetic data (label clearly); email tier stays "via eDiscovery export" narrative.
- **C — Ingestion-only** (Openflow SharePoint connector live). Pros: real ingestion proof. Cons: infra-heavy, least visual, needs an M365 tenant.

**Recommendation: B**, optionally with a later C add-on (wire the real Openflow SharePoint connector) once the story lands.

## 7. Suggested build phases (for when we execute — NOT now)
1. Synthetic multi-source corpus: a SharePoint-style docs set + a structured social-care/CRM table for one subject (+ third parties), clearly synthetic.
2. Federated **Cortex Search** across sources; subject-centric "find everything about X" view.
3. Structured-tier governance: `AI_CLASSIFY`/auto-tag PII, tag-based masking + row-access; subject-vs-third-party demo.
4. SAR legal framing in the UI (clock, balancing test, supplementary info, exemptions incl. social-care serious-harm).
5. Per-SAR cost: extend `FOI_AI_USAGE` (SAR_ID) + reuse rolling view.
6. Route: `xo-code` for the app/DB build; `snowflake-notebooks` if we want a SAR "engine room" too.

## Crystallise
Durable finding worth a knowledge article later: **Openflow SharePoint connector is GA (incl. Cortex Search + ACL variants); Exchange has no GA connector (eDiscovery export path)** — reusable across any M365-ingestion pitch. Recorded here; defer formal article until after a build validates it.
