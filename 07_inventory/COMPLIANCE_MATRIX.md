# FOI Sentinel v2 — Legal & Compliance Traceability Matrix

Every lifecycle stage and feature mapped to its statutory/regulatory basis and source.
Sources: legislation.gov.uk, ico.org.uk, gov.uk (s.45 Code of Practice).

## Lifecycle stages → legal basis
| Stage | Legal basis | Notes |
|-------|-------------|-------|
| Receipt & logging | FOIA s.8; s.45 CoP Part 8.5 | Valid request must be in writing with name, address, description |
| Validity check | FOIA s.8 | Confirms a valid request; else advise & assist (s.16) |
| Regime classification | FOIA / EIR 2004 / UK GDPR | FOI vs EIR vs SAR determines deadline & rules |
| SAR redirect | FOIA s.40(1); DPA 2018 | Own personal data is exempt from FOI → handle as SAR (1 month) |
| Duplicate / s.21 | FOIA s.21 | Information reasonably accessible by other means |
| Clarification | FOIA s.1(3); EIR reg.9 | Stops the clock until clarification received |
| Allocation | s.45 CoP | Best practice — route to owning service area |
| Search & retrieval | FOIA s.1(1)(b) | Must search all reasonable locations |
| Cost assessment | FOIA s.12; Fees Regs 2004 (SI 2004/3244) reg.3–5 | £450/18h LA, £600/24h central; 4 activities at £25/hr; **EIR has no cost limit** |
| Exemptions | FOIA Part II; EIR reg.12 | Absolute vs qualified |
| Public interest test | FOIA s.2(2)(b) | Qualified exemptions only — **human decision**; up to 40 WD |
| Redaction | FOIA s.40 / s.43 | AI-suggested, **human-verified** (highest risk) |
| Drafting | FOIA s.1, s.17 | Disclosure / partial / refusal |
| QA / sign-off | s.45 CoP | Senior officer sign-off |
| Dispatch | FOIA s.10 | Within 20 working days |
| Publish | FOIA s.19; s.45 CoP | Publication scheme / disclosure log |
| Internal review / ICO | s.45 CoP; EIR reg.11 (statutory); FOIA s.50 | Fresh reviewer; 20 WD (max 40); ICO complaint route |

## Accuracy fixes vs v1
| Item | v1 behaviour | v2 behaviour | Basis |
|------|--------------|--------------|-------|
| EIR cost limit | 18h/£450 warning fired for all regimes | **No cost limit for EIR**; 40 WD complex extension | EIR 2004 reg.7, reg.8 |
| Working-day deadline | Weekends only | Excludes **UK bank holidays** too | gov.uk/bank-holidays |
| Cost model | Single "estimated_hours" | **Four prescribed activities** × £25/hr | Fees Regs 2004 reg.4 |
| Refusal notices | Free-text prose | **s.17(7)-compliant**: exemption + internal review + ICO route | FOIA s.17(7) |
| SAR | Classified only | **Redirect to DPA / 1 month** | FOIA s.40(1); DPA 2018 |
| Headline KPI | Approval rate | **% answered within 20 WD** | s.45 CoP Part 8.5; ICO monitoring ~90% |

## AI vs human gates
- **AI assists:** classification, s.21 duplicate matching, routing, search, cost estimation, exemption flagging, response drafting, sentiment/urgency scoring.
- **Human-only (gated):** public interest test, s.36 qualified-person opinion, final exemption decisions, redaction verification, QA sign-off, internal review.

## Source URLs
- FOIA 2000: https://www.legislation.gov.uk/ukpga/2000/36/contents
- EIR 2004: https://www.legislation.gov.uk/uksi/2004/3391/contents/made
- Fees Regs 2004: https://www.legislation.gov.uk/uksi/2004/3244/contents/made
- s.45 Code of Practice: https://www.gov.uk/government/publications/freedom-of-information-code-of-practice
- ICO FOI/EIR guidance: https://ico.org.uk/for-organisations/foi/
