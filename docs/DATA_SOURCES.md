# FOI Sentinel — Data Sources & Provenance

The single register of every dataset the platform uses: what it is, whether it is real or
synthetic, how it is refreshed, its legal/re-use basis, and where it is consumed in the app.
This is the source of truth for data provenance. Update it whenever a source is added or changed.

> Naming note: the WhatDoTheyKnow source is abbreviated **WDTK** throughout. Snowflake objects
> use the `WDTK_` prefix (standardised from an earlier `WTDK_` spelling).

---

## 1. Summary table

| Source | Real / Synthetic | Volume | Refresh | Legal / re-use basis | Consumed by |
|--------|------------------|--------|---------|----------------------|-------------|
| **Case board** (`FOI_CASE`, `FOI_CASE_EVENT`, cost/exemption/redaction/response artefacts) | **Synthetic** demo data (Bristol-branded) | 54 cases (33 open / 21 closed) | Static seed | Demo only — not a real caseload | Command Centre, Case Board, Case Workspace, Performance |
| **Internal review** (`FOI_INTERNAL_REVIEW`) | **Synthetic** stub | 1 row | Static seed | Demo only | Internal Review & ICO page |
| **ICO complaint** (`FOI_ICO_COMPLAINT`) | **Synthetic** stub | 1 row | Static seed | Demo only | Internal Review & ICO page |
| **Camden FOI corpus** (`CAMDEN_FOI_RESPONSES`) | **Real** | 11,420 responses | Static load | Camden published disclosure log (public, OGL/PSI) | `CAMDEN_FOI_SEARCH` — drafting precedent |
| **Council disclosure log** (`FOI_DISCLOSURE_*`) | Mixed (demo) | small | Static seed | Demo | `DISCLOSURE_SEARCH` — drafting precedent |
| **WDTK authorities + events** (`WDTK_AUTHORITY`, `WDTK_EVENT`) | **Real** | 16 authorities / 54 events | Operator-initiated (browser-mediated — see §3) | WhatDoTheyKnow / mySociety, CC-BY style attribution | Sector Trends, Command Centre benchmark, `WDTK_PRECEDENT_SEARCH` |
| **GLA disclosure log** (`GLA_DISCLOSURE_LOG`) | **Real** | recent ~12 months | On-demand scraper from Settings (§3) | london.gov.uk, OGL / Re-use of PSI Regs 2015 | `GLA_DISCLOSURE_SEARCH` — drafting/exemption precedent, Sector Trends spotlight |
| **ICO outcome benchmarks** (`ICO_EXEMPTION_PROFILE`, `ICO_OUTCOME_BENCHMARK`) | **Real, official statistics** | ~13 figures | Static, cited seed | Cabinet Office FOI statistics annual 2025; ICO published figures (OGL) | Escalation-risk flag, REVIEW-stage grounding |
| **ICO decision notices** (`ICO_DECISION_NOTICE`) | Reserved (empty) | 0 | Blocked — see §3 | ico.org.uk, OGL | Reserved schema for a future authorised feed |

**Honesty rule:** the case board and the internal-review / ICO tables are **synthetic demo
fixtures**. They must never be presented as a real caseload, and they are **not** used to infer
complaint routes or outcomes. Complaint-route intelligence is derived only from the real WDTK
escalation states and ICO decision notices.

---

## 2. What each real source gives us

### Camden corpus (11,420)
Structured request-and-response pairs. Every response carries the standard section 17(7) rights
-of-appeal footer (internal review + Information Commissioner), so ~99% mention those routes — this
is **boilerplate wording**, not escalation signal. Value: drafting precedent and the canonical
complaint-route wording. Not a source of who actually escalated or how it resolved.

### WDTK (WhatDoTheyKnow)
Cross-authority requests, outcomes, and — once the escalation dimension is ingested — per-thread
states including `internal_review` and ICO escalation. Value: peer benchmarking, cross-authority
drafting precedent, and the real signal for **how often requests of a given theme/exemption are
taken to review**.

### GLA disclosure log (london.gov.uk)
Full real request + "Our response" text with a reference number and response date per entry. The
cleanest request→response corpus we hold — drafting/exemption precedent and the evaluation gold-set.

### ICO decision notices (ico.org.uk)
The authoritative record of how a complaint resolved: public authority, exemption(s) at issue,
upheld / not-upheld, and reasoning. **Row-level notices are not server-side ingestable** — the
listing is a client-side Funnelback application and the search host (`icosearch.ico.org.uk`) returns
403 to server fetches, the same bot-protection wall as WDTK (confirmed by `SP_WDTK_EGRESS_TEST`).
Escalation-risk is therefore grounded in the **accredited published statistics** (Cabinet Office
FOI statistics annual 2025 — internal-review overturn rate 28%, in-time rate 43%, 716 known ICO
complaints; withheld composition s12 26.6% / s14 2.7% / other 70.7% with s40 most cited) held in
`ICO_OUTCOME_BENCHMARK` and `ICO_EXEMPTION_PROFILE`, blended with our real observed WDTK/GLA
outcomes in `V_ESCALATION_RISK`. `ICO_DECISION_NOTICE` remains as a reserved schema for a future
authorised feed.

---

## 3. Ingestion methods

| Method | Used for | Why |
|--------|----------|-----|
| **Server-side scraper** (Snowflake Python proc + External Access Integration `FOI_WEB_EAI`, `requests` + `beautifulsoup4`) | GLA | london.gov.uk is server-side reachable (200); robots permit paginated access. On-demand from the Settings page (`SP_SCRAPE_GLA_DISCLOSURE_LOG`). |
| **Browser-mediated, operator-initiated** | WDTK (events + escalation states) | WhatDoTheyKnow is behind a provider bot-protection challenge (Cloudflare); unattended server-side fetch returns 403. Events and the `ESCALATION_STATE` dimension are pulled by an operator and loaded. |
| **Static cited seed** | ICO outcome benchmarks | ICO row-level notices are blocked (Funnelback 403); the published accredited statistics are loaded as cited reference data. |
| **Static load** | Camden, demo fixtures | One-off published-data load / seed. |

`SP_WDTK_EGRESS_TEST()` records the live WDTK reachability result so the constraint is documented,
not assumed.

---

## 4. Governance & caveats

- All data and inference remain inside the authority's Snowflake account (SoW NFR: governance).
- AI outputs are grounded in cited sources and never presented as unsourced fact (SoW NFR:
  transparency) — every precedent surfaced in drafting carries its source and reference.
- Personal data: published disclosure logs and decision notices are already redacted at source;
  no additional PII is introduced. Re-use is under the Open Government Licence / Re-use of Public
  Sector Information Regulations 2015, with WDTK content attributed to mySociety / WhatDoTheyKnow.
