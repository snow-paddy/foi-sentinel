# FOI Sentinel — Demo Video Script

**Audience:** conference and prospective customers (Brentwood first).
**Runtime target:** ~14 min. **Mode:** silent-with-captions (captions double as a speaker script, and you add live audio).
**App:** record on `http://localhost:3000` (simplest for the automated pass) OR the deployed app `https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app`. The deployed SPCS build was persona-audited 2026-07-06 and behaves identically (sign in via Snowflake SSO before capture).

## Recording approach
- **Sections 1-5 (in-app):** one continuous automated Playwright pass over localhost:3000 (the skill's `record_demo.py`).
- **Section 6 (SharePoint integration):** external authenticated site plus Openflow CDC latency, so capture it as a **manual, headed screen recording** (open the URL, sign in manually), then stitch after Section 5. See `upload-and-verify.md`.
- **Context & architecture (post insert):** the title card is followed by an architecture slide and a short context overlay (Section 0), spliced in during editing, not captured in-app. Deck: `FOI Sentinel — Microsoft 365 to Snowflake Architecture`.
- Keep **Outlook and SharePoint browser tabs** open and signed in during capture, ready for Sections 3 and 6.
- Captions burned in one libass pass at assembly. Section 1-6 beat timings are relative to the continuous in-app cut. At assembly, offset them by Section 0's length.

## Pre-record checklist
- [ ] `HOME=/Users/pgardner SNOWFLAKE_CONNECTION_NAME=PG-SNOWFLAKE npx next dev -p 3000` is up, and `/`, `/cases`, `/intake`, `/guidance`, `/sar` all return 200. (`/redaction` now **redirects to `/sar`**. The Redaction Studio is embedded as Section 3 of the SAR flow, and there is no standalone Redaction page or nav item.)
- [ ] **Reset the redaction learning state** if you want the "first run" to show no prior decisions:
      `DELETE FROM FOI.FOI_SENTINEL_V2.SAR_REDACTION_DECISION WHERE SOURCE='studio';`
      (Leave it populated instead if you want to open on the "Learned from N" moment.)
- [ ] The SAR seed doc **`2026-04-02_ASC-2026-04021_file_note.docx`** (an Adult Social Care / Housing Options file note about James Whitfield's own data, naming one third party: his neighbour Mrs Sarah Quinn) is ready to upload but **not yet uploaded** (that's the live moment in Section 6).
- [ ] The intake seed email (senior officer salaries over £100k) is ready to send to `foi@exampleton.onmicrosoft.com` from a **cleared** mailbox (poller ingests every unread message).
- [ ] Light theme, window ~1280 wide, browser zoom 100%.

---

## Title card (intro) — 0:00-0:12
`FOI Sentinel` / `AI-assisted FOI, EIR and SAR handling on Snowflake` / accent = brand blue.

---

## Section 0 — Context & architecture (post-production insert) — 0:12-1:00
**On screen (spliced in editing, not captured in-app):** the architecture slide (Microsoft 365 -> Openflow -> Snowflake -> officer), then a short context overlay.

**Captions / speaker beats:**
- 0:12: "Every council must answer FOI, EIR and SAR requests, on a 20-working-day statutory clock."
- 0:25: "Today that means manual triage, line-by-line redaction and audit by spreadsheet, under rising demand."
- 0:40: "It is carried by two people: the FOI/SAR officer who does the work, and the Information Governance manager accountable for it."
- 0:52: "One governed pipeline. Microsoft 365 in, Cortex AI in Snowflake, defensible disclosure out."

**Explainer (deeper than captions):** The problem is structural: statutory deadlines, third-party redaction risk under s.40, and an audit burden that falls on small teams facing rising request volumes. FOI Sentinel is built for the **FOI/SAR Officer** (primary user: triage, drafting, redaction) and the **Information Governance Manager** (economic buyer: accountable for timeliness, defensibility and the ICO relationship), with an IT/data champion who values that it all sits inside Snowflake. The architecture: **Outlook/Exchange** and **SharePoint** flow in via **Microsoft Graph** (app-only) and the **Openflow** SharePoint connector (CDC). Everything lands in **Snowflake**, where **Cortex** parses, extracts, classifies, grounds and searches, all under **masking and row-access policies** and a **hash-chained AI audit**, and the officer works in a **React app on SPCS**. Nothing leaves the governed boundary.

---

## Section 1 — Command Centre (`/`) — 0:12-2:00
**On screen:** land on `/`. Let the scorecard, SLA gauge and peer benchmark render, then slow-scroll to the "Intelligence, powered by Snowflake Cortex" section (word cloud and requester patterns). The word cloud is de-skewed (requester names and signatures stripped) and **clickable**, so you can click a theme to jump to the cases behind it.

**Captions / speaker beats:**
- 0:12: "Every FOI, EIR and SAR request, one live view."
- 0:25: "The statutory clock: 20 working days. At-risk and overdue, up front."
- 0:45: "An SLA gauge against the regulator's in-time target."
- 1:05: "And how we compare to peers on WhatDoTheyKnow."
- 1:25: "Cortex reads the inbox: what people are asking about."
- 1:35: "Click any theme, and see every request behind it." (click a word-cloud term -> filtered Cases list)
- 1:50: "Repeat requesters and campaigns surfaced automatically, including possible s.14. Requester identities stay pseudonymised."

**Explainer (deeper than captions):**
- **Peer benchmark:** the comparison uses *real* data from WhatDoTheyKnow (mySociety): published FOI performance for 16 authorities, ingested into Snowflake (`WDTK_AUTHORITY`) and served via `V_WDTK_BENCHMARK`. It is pre-loaded rather than live because the source is Cloudflare-gated. Exampleton's own in-time rate is computed live from its cases and ranked among the real authorities.
- **Same intelligence, several formats:** the scorecard, the word cloud and the most-frequent-words chart present the same demand signal in different ways, so you can read it at a glance or drill in.
- **Repeat requesters:** this targets a real pain: officers manually spotting linked or coordinated requests, which drives workload spikes and inconsistent handling of s.14(1) (vexatious) and s.12 (cost limit). Surfacing patterns automatically lets the team apply exemptions consistently and plan resource, while requester identities stay pseudonymised.

---

## Section 2 — Cases: complexity, priority, precedent (`/cases`) — 2:00-4:45
**On screen:** open `/cases` in Focus view. Show the "Quick wins / Needs review / Complex" lanes, then hover a `Cx n` complexity chip and a `★ n% match` precedent pill (tooltips). Switch to List view to show the columns. Then open one case (`/cases/[reference]`): show the "How AI triaged this case" panel and the right-hand "Precedent match" card with "Use this precedent".

> **Precedent honesty (pick your case deliberately):** the similarity % is a real Cortex `AI_SIMILARITY` measurement, but the *corpus* mixes real disclosures with synthetic comparators. 23 of 31 open cases currently top-match a **synthetic** precedent, which the card labels with an amber **"Illustrative example"** badge. For the main precedent beat, either (a) open a **real-match** case (e.g. `FOI-2026-0115`) so the comparator is a genuine authority, or (b) open a synthetic-match case (e.g. `FOI-2026-0114`) and use the badge as a trust moment: "the score is real. The example is clearly labelled illustrative." Do not narrate a synthetic match as a real authority's disclosure.

**Captions / speaker beats:**
- 2:00: "Cases triaged into quick wins, needs-review, and complex."
- 2:20: "Complexity scored 0-10 by Cortex, with the drivers shown."
- 2:40: "Priority banded high, medium or low."
- 3:00: "And a precedent match: how close a clean past case is."
- 3:20: "Precedent uses Cortex AI_SIMILARITY over past clean requests."
- 3:40: "Open a case: the AI triage covers category, priority, complexity and tone."
- 4:05: "The strongest precedent, with the prior response and outcome."
- 4:15: "The match score is real. Illustrative comparators are labelled as such."
- 4:25: "One click to adopt that precedent and advance the case."
- 4:35: "And every AI decision on the case is secure and encrypted (hash-chained and tamper-evident), and ICO-ready: fully retrievable on demand." (the "AI evidence & audit trail" panel with the "Chain verified" badge. Prompts stored as hashes, never raw personal data)

**Explainer (complexity, priority and precedent):**
- **Complexity (0-10)** is scored by Cortex from the request text (scope, the number of data sources implicated, and ambiguity) and shown *with its drivers*, so an officer can see why it scored as it did.
- **Priority** blends that complexity with sentiment, deadline pressure (working days remaining) and any vexatious signal into a single `PRIORITY_SCORE` (in `V_CASE`), banded high, medium or low. Hover the badge in the app to see the calculation and a query to inspect it.
- **Precedent match** is a genuine Cortex `AI_SIMILARITY` score against a corpus stored in `FOI.FOI_SENTINEL_V2` (`V_PRECEDENT_CLEAN`): real published disclosures from the Greater London Authority, real successful WhatDoTheyKnow disclosures, and ten synthetic own-council examples (clearly flagged). The pattern is table-agnostic: a customer points the same view at their own disclosure log plus any published logs to reproduce it on their data.

**Explainer (auditability and data deletion):** Every AI decision is written to an append-only, **hash-chained** log (each row's hash chains the previous), so the trail is **tamper-evident** and can be produced on demand for the ICO or a tribunal, which is the language that matters to an Information Governance manager. The log stores **hashes, not raw prompts or personal data**, which also makes it deletion-compliant. FOIA carries no erasure right (it is a disclosure regime, governed by retention schedules under the s.46 Code), but **UK GDPR Article 17 (right to erasure)** does apply to requester and subject personal data (subject to public-task and legal-obligation exemptions). Because we hash rather than retain the raw text, the underlying personal data can be erased on request **without breaking the audit chain**, compliant and defensible at once.

---

## Section 3 — Inbound email -> triage (`/intake`) — 4:45-7:45
**On screen:** open `/intake`. On the **Outlook Test** tab show "Waiting to be triaged" (unread mail), then click **Run the pipeline**. Let the 6-step live notebook reveal: Intake & classification, Triage, Precedent match, Suggested answer, Evaluation, Compiled draft. Expand one "Under the hood" to show the SQL/prompt. On the compiled draft, show the **data-provenance strip** (verified council source tables) and the **citation legend** resolving each `[S1]`/`[S2]` marker to its source.

> **Grounding is real:** the draft is produced by `generateGroundedLetter()`. It retrieves from the council's own records and peer corpora, cites real figures inline (`[S1]`), and persists the source list. There is no ungrounded fallback path (the old `SP_GENERATE_RESPONSE` is retired). Verified sources are shown as green provenance chips (e.g. `EDUCATION_ADMISSION_APPEALS · Education`). Peer sources are labelled comparison-only.

**Captions / speaker beats:**
- 4:45: "A real request arrives, straight from Outlook via Microsoft Graph."
- 5:05: "No middleware: the mailbox lands in Snowflake."
- 5:20: "Run the pipeline, and follow each step as it runs."
- 5:40: "Classified, then triaged: category, priority, complexity, effort."
- 6:05: "Matched to this council's own records and peer precedent."
- 6:30: "A grounded draft answer, with citations to verified council sources."
- 6:55: "Evaluated for groundedness and coverage before anyone sees it."
- 7:15: "A compiled statutory draft, benchmarked against real peer disclosure."
- 7:35: "Every step is inspectable: the SQL and prompts are available on screen."

**Explainer (deeper than captions):** The Outlook-to-Snowflake path is app-only and locked down: **Microsoft Graph client-credentials OAuth**, **TLS in transit**, reached through a Snowflake **External Access Integration** with the credential held in a Snowflake **SECRET** object. No mailbox data leaves the governed boundary and there is no middleware server in between. The SharePoint sync (Section 6) uses the same secured egress via the **Openflow** connector (CDC).

---

## Section 4 — Knowledge Base: cross-authority precedent (`/guidance`) — 7:45-9:30
**On screen:** open `/guidance` and show the "Evidence base the pipeline retrieves against" corpus cards. On "Guidance & precedent" run a search (e.g. "personal data" or "cost limit"), then highlight the **Cross-authority precedent (WhatDoTheyKnow)** results with authority names and linked originals. This is the same corpus that powered the case precedent match in Section 2. The cards include **FOIA and EIR legislation** (59 statutory sections), a live Cortex Search service that grounds the legal basis of a refusal.

**Captions / speaker beats:**
- 7:45: "The knowledge an officer needs, in one place."
- 8:00: "For this demo, a representative evidence base loaded into Snowflake."
- 8:15: "11,420 Camden disclosures. 54 WhatDoTheyKnow threads across 16 councils. The GLA log."
- 8:35: "Council and ICO guidance, and 59 sections of FOIA and EIR legislation."
- 8:55: "A council builds its own corpus, then reuses it to prioritise, match precedent and share insight."
- 9:10: "Semantic search grounds every drafted answer in a real source."
- 9:20: "Search it by hand, or let the pipeline retrieve against it."

**Explainer (deeper than captions):** For the demo we have loaded a representative evidence base: over 11,000 real Camden disclosure-log responses, cross-authority precedent from WhatDoTheyKnow (54 request threads across 16 authorities), the GLA disclosure log (38), council and ICO guidance (42), and FOIA and EIR legislation (59 statutory sections). The value is that a government organisation points the same pattern at its own records and published logs, then reuses that corpus for prioritisation, precedent and shared insight. That means more consistent, defensible answers and less repeated work. Two Cortex capabilities sit over the corpus. Cortex Search runs semantic retrieval to ground answer drafting and the knowledge base. Precedent matching is a related but separate step: AI_SIMILARITY compares a new request to past clean cases in the same corpus (`V_PRECEDENT_CLEAN`), so the score is real even though search and precedent are different mechanisms.

---

## Section 5 — SAR + Redaction: the hero (`/sar`, Redaction Studio embedded) — 9:30-12:45
**On screen:** open `/sar` and show the estate-wide findings list (documents pulled from SharePoint plus structured LOB records, third-party PII masked in the data layer). Scroll to **Section 3 of the same page, the embedded Redaction Studio** (no separate page): click **Run AI redaction**, show the findings with confidence and the "AI suggests, the officer decides" framing, **untick** a council officer's email (`thomas.lee@`) to keep it, show the released doc and counts update live, click **Confirm & release**, then click **Re-run** and land on the **"Learned from N prior decisions"** moment with "kept last time".

**Captions / speaker beats:**
- 9:30: "A Subject Access Request spans the whole estate."
- 9:50: "Documents from existing storage, i.e. SharePoint, plus structured records in one governed view."
- 10:15: "Section 40 is the exemption protecting other people's personal data, so the requester keeps their own and third parties are removed."
- 10:35: "Cortex AI_EXTRACT finds third-party personal data, with a confidence score."
- 11:00: "The AI only suggests. Officers have the final say."
- 11:20: "Keep a colleague's official contact, redact the rest."
- 11:40: "The released document updates as you decide. Then release."
- 12:05: "It remembers your decisions. Next time, the same choices are pre-applied."
- 12:25: "'Kept last time': human judgement, remembered and auditable."

**Explainer (deeper than captions):** A SAR spans the whole estate, so third-party personal data must be removed while the requester keeps their own. That third-party protection is the s.40 personal-information exemption. **Cortex AI_EXTRACT** finds candidate third-party personal data with a confidence score, and masking and row-access policies protect it in the data layer in any case. The officer holds every decision. On a re-run the AI detection is identical, but the officer's previous keep-or-redact choices are pre-applied automatically, matched on the redacted value, so familiar items do not have to be decided twice. This is remembered human judgement, and every decision is auditable. The model does not retrain.

---

## Section 6 — SharePoint integration: continuous sync and freshness (manual capture) — 12:45-14:30
**On screen (headed, sign in manually):** In SharePoint, the council's normal document store, the case files already live in the FOISARDemo Documents library. To show the integration is continuous, save one further file, `2026-04-02_ASC-2026-04021_file_note.docx`, into that library. Cut to a short wait (or trim), then Snowflake showing the ingested count rise (from `upload-and-verify.md`). Cut back to `/sar` and **refresh**: the document now appears in the findings, surfaced by relevance to the subject, flagged by AI_CLASSIFY as containing third-party data (Mrs Sarah Quinn) and linked back to SharePoint.

**Captions / speaker beats:**
- 12:45: "Councils already keep their case files in SharePoint."
- 13:00: "Openflow mirrors that library into Snowflake, continuously."
- 13:20: "So when a SAR lands, the relevant documents are already there, indexed and searchable."
- 13:40: "Save a new file this morning, and it is pulled in within minutes."
- 14:05: "If data is not already in Snowflake, this is how it arrives from SharePoint. Refresh, and it is discoverable by relevance."

---

## Section 7 — The price of a response (optional) — 14:30-15:15
**On screen:** reopen `/cases/FOI-2026-0115`; in the right column, scroll to the **AI cost of this response** card. Then open the live intake case `/cases/FOI-2026-D07060953030` and show the same card. Optional and fully skippable if the cut is running long.

**Captions / speaker beats:**
- 14:30: "Every officer asks the same question: what does this cost to run?"
- 14:45: "This response was triaged, grounded, drafted and self-checked for £0.09."
- 14:58: "The same request handled manually is estimated at £238, roughly 2,700 times more."
- 15:05: "Metered live from real Cortex token usage, not a projection."
- 15:12: "The senior-salaries reply from the live inbox: £0.07."

**Explainer (deeper than captions):** The card reads `FOI_AI_USAGE`, where every Cortex call on the case is logged with real `COUNT_TOKENS` counts and costed through the editable `AI_MODEL_RATE_CARD` at list rates. It is the full metered spend to handle the response (triage, precedent, grounded draft and the LLM-judge), not a projection. Figures are cumulative per case, so avoid re-running drafts before capture or the pennies tick up.

---

## Title card (outro) — 15:15-15:30
`One governed platform.` / `FOI, EIR and SAR: from inbox to defensible disclosure, on Snowflake.`

---

## Runtime summary
| Section | Window | ~Length |
|---|---|---|
| Intro card | 0:00-0:12 | 0:12 |
| 0 Context & architecture (post insert) | 0:12-1:00 | 0:48 |
| 1 Command Centre | 0:12-2:00 | 1:48 |
| 2 Cases | 2:00-4:45 | 2:45 |
| 3 Intake triage | 4:45-7:45 | 3:00 |
| 4 Knowledge Base | 7:45-9:30 | 1:45 |
| 5 SAR + Redaction | 9:30-12:45 | 3:15 |
| 6 SharePoint integration | 12:45-14:30 | 1:45 |
| 7 Price of a response (optional) | 14:30-15:15 | 0:45 |
| Outro card | 15:15-15:30 | 0:15 |
| **Total** | | **~16:20** |

## Notes
- Section 0 is spliced in post. Sections 1-6 beat timings are relative to the continuous in-app cut and shift by ~0:48 at assembly.
- If it runs long, Section 3 is the most compressible (show 3 of the 6 pipeline steps, not all).
- Section 7 is optional. Drop it first if the cut runs long.
- Caption beats are ~7-12 words so they read at a comfortable pace. Tighten to your live narration.
- Dry-run once end-to-end to confirm exact on-screen labels before the automated pass. The inventory above matches the current build (2026-07-06).
