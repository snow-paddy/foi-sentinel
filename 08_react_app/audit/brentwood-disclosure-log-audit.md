# Audit — Brentwood's Disclosure Log deflection flow (and where FOI Sentinel fits)

Live audit of Brentwood Borough Council's public "Make a Freedom of Information Request"
flow (`my.brentwood.gov.uk`, Granicus/AchieveForms). Explored read-only on 2026-07-01;
**no request was submitted**. Mapped against `audit/personas.md`.

---

## 1. What Brentwood actually does (observed)

The request journey is a staged form with a **deflection gate** built in:

1. **Data Protection & Privacy Notice** — consent to continue.
2. **Before You Begin** — plain-English explainer + prompt to log in / register (optional).
3. **Disclosure Log Search** *(required step)* — a single free-text box: *"You can search the
   Disclosure Log by entering keywords below."* Sub-heading: *"Please check the existing
   disclosures below to see if your request has already been answered … click on a result to
   bring up further details."* Results render as a date-sorted list; clicking a row opens a modal.
4. **Make a Request** *(only reached after the search step)* — Title, a rich-text details editor
   (TinyMCE: bold/italic, lists, links, fonts), and **"Do you want to upload any additional
   information? Yes / No"** (attachments).

### A real disclosure-log entry (schema)
Searching `parking` returned ~44 matches. Opening one:
- **Case reference:** FOI-839906880
- **Date created:** 16th June 2026
- **Disclosure title:** "Blue badge parking bays"
- **Disclosure entry:** *"Thank you for your submitted request of 21/5/26 where you requested
  information about Parking. We only manage car parks so the information for on street can be
  obtained via south Essex parking partnership."*
- **Links:** "Brentwood car parks | Brentwood Council" (published page) + "Information
  Commissioner's Office".
- **Attachments** section (entries can carry response documents).

So each entry is a mini published-response record: **reference · date · title · free-text
answer · signpost links · attachments** — exactly the shape a citizen (or officer) needs to
self-serve.

---

## 2. How it works — and its limits

- **Mechanism = keyword match.** The field is literally labelled "keywords"; matching is on token
  overlap against the entry title/text. It is a **deflection gate**: the citizen is nudged to check
  prior answers before the request form is reachable. If a disclosure answers them they stop
  (deflected); otherwise they proceed. This is the "search first, click 'no it didn't answer me',
  then continue" pattern.
- **Strengths:** genuinely reduces duplicate requests; publishes answers with signposts and
  attachments; self-service; embedded in the request journey (not a separate page they'll skip).
- **Limits (the opportunity):**
  1. **Keyword brittleness.** A semantically-equivalent query with no shared token ("mobility
     permit for wheelchair users") will not reliably surface "Blue badge parking bays". Recall
     depends on the citizen guessing the council's vocabulary.
  2. **No grounded answer.** It returns *documents to read*, not a drafted, cited answer to the
     specific question.
  3. **Citizen-facing only.** The officer gets no equivalent "has this been answered before?"
     assist when a new request lands, and there's no analytics on what gets deflected.
  4. **Manual curation.** Someone has to write and publish each disclosure-log entry.

---

## 3. Could Cortex Search across existing docs / prior answers work as a pattern? — Yes

This is precisely the pattern FOI Sentinel already uses internally, and it is the right upgrade
to Brentwood's keyword gate:

- **Semantic recall** over the same corpus — "mobility permit"→"blue badge", "bins"→"waste
  collection" — via a Cortex Search service over the disclosure-log entries, so recall no longer
  depends on vocabulary match.
- **Grounded, cited answer** on top of retrieval — our `suggestAnswer()` already searches five
  corpora and drafts a `[S#]`-cited answer. The same call, pointed at a disclosure-log corpus,
  turns "here are 44 documents" into "here's the likely answer, and the entries it came from."
- **Two audiences from one index:** the **citizen** deflection gate (public) *and* the **officer's**
  "already answered / s.21 already published" assist (internal) — we already have the internal side
  (`searchPublished` / precedent match / the Knowledge Base s.21 tab).

### Honest gap found during the audit
Our current `BRENTWOOD_FOI_SEARCH` service indexes Brentwood's **publication-scheme / transparency
pages**, *not* the answered-FOI **disclosure log** (a semantic query for disabled parking returned
transparency boilerplate, not the "Blue badge parking bays" answer). To actually replicate/upgrade
Brentwood's deflection we must **ingest the disclosure-log entries themselves** (reference, title,
entry text, signpost links, attachments) into a Cortex Search service. Captured as backlog item 5.

---

## 4. Where it fits — mapped to personas

| Persona | Brentwood pain today | FOI Sentinel fit |
|---|---|---|
| **End-user (FOI Officer)** | No "has this been answered?" assist when a new request lands; writes each disclosure entry by hand | Officer-side semantic "already answered / s.21 published" match on intake (precedent + `suggestAnswer`); auto-draft a disclosure-log entry from the sent response |
| **Economic buyer (Head of Legal/Governance)** | Can't quantify deflection; duplicate-request load is invisible | Deflection-rate metric (searches that resolved without a request) as a cost-avoidance KPI on Reporting; s.21 usage made visible |
| **Champion (Transformation Lead)** | Keyword gate feels dated; hard to show innovation | A clean "citizen asks in plain English → semantic match → grounded, cited answer → fewer duplicate requests" story, same engine that assists officers internally |

### Use cases played through (persona-anchored, not submitted)
- *Citizen, plain-language query:* "help for disabled drivers" — keyword gate risks missing "Blue
  badge parking bays"; semantic search retrieves it and can draft a cited pointer to the
  "Brentwood car parks" page + South Essex Parking Partnership (an **s.21 already-published**
  deflection).
- *Officer, new request lands:* same semantic index answers "have we responded to this before?"
  → precedent reuse → quick-win draft (already in the app's Focus quick-win lane).
- *Buyer, board report:* "X% of disclosure-log searches were resolved without a new request this
  quarter" — a defensible cost-avoidance number.

---

## 5. Response patterns observed (for tuning)
- Brentwood entry (live): **acknowledge → clarify what's held → signpost/redirect** (other body +
  published page) — a classic s.21 / partial-holding response.
- Cross-sector baseline (our WDTK corpus, n=54): Response/unclassified 25 · **Partially successful
  9 · Successful 7 · Information not held 6 · Refused 4** · In progress 3. Full/partial disclosure
  dominates; "not held" and "refused" are meaningful minorities — the mix our suggested-answer +
  s.17 refusal drafting must cover.

---

## 6. Follow-up tasks raised
- **Backlog 5** — ingest Brentwood's disclosure-log entries into a Cortex Search service to power a
  semantic deflection surface (citizen) + officer "already answered" assist.
- **Backlog 6** — analyse the most common **attachment types** on WhatDoTheyKnow (the request form
  supports uploads; we should know what formats to expect for `AI_PARSE_DOCUMENT` at intake).
