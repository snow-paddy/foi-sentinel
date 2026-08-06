# FOI Sentinel - Roadmap

Forward-looking enhancements beyond the current release. Each item lists the value, the
data and Snowflake capabilities it builds on, and the work required.

## 1. Precedent-grounded suggested replies (shipped, with planned depth)

The case Draft tab now retrieves similar past responses (Cortex Search over the Camden
corpus and the council disclosure log) and can generate a reply grounded in them. Planned
extensions:

- **External precedent corpora.** Extend retrieval beyond Camden and the council's own log to
  the **GLA disclosure log** (full real request→response text) and **WDTK** cross-authority
  precedents, each labelled with provenance and cited inline. See
  [DATA_SOURCES.md](DATA_SOURCES.md).
- **Outcome-based filtering.** Prefer precedents that did not draw a follow-up question,
  internal review, or ICO complaint. For WDTK this uses the ingested escalation state; GLA
  published responses are treated as clean outcomes; for internal cases it can be derived by
  joining `FOI_RESPONSE` to `FOI_INTERNAL_REVIEW` and `FOI_ICO_COMPLAINT` (currently demo stubs).
- **Confidence and citation.** Surface the search similarity score per precedent and cite the
  precedent reference inline in the generated draft.

## 1a. Complaint-route intelligence (new)

The internal-review and ICO tables are demo stubs, so escalation patterns are mined from **real**
external data rather than synthetic fixtures:

- **Escalation-risk flag** at the exemption/draft step, from WDTK escalation states and ICO
  decision-notice upheld rates by exemption/theme.
- **ICO-grounded REVIEW stage** — surface comparable ICO decision notices and WDTK internal-review
  threads to ground reviewer decisions and outcome letters (SoW F7).

## 2. Use the Camden corpus as a training signal

The 11,420 published Camden responses are currently a retrieval corpus only. Each document is
a structured request-and-answer pair, which makes them a candidate labelled dataset for a
drafting model.

- Parse each `DOCUMENT_TEXT` into request, regime ("dealt with under the Freedom of Information
  Act 2000" / EIR), and response sections.
- Build a `prompt`/`completion` table and fine-tune a drafting model with
  `SNOWFLAKE.CORTEX.FINETUNE`, extending the existing triage fine-tune (`TRIAGE_TUNED`).
- Evaluate generated drafts against held-out Camden **and GLA** responses before any production
  use — the GLA request→response pairs form a clean evaluation gold-set
  (`GLA_EVAL_PAIRS`).

## 3. Knowledge graph of themes and requests (parked)

A network view to complement the word cloud, for spotting clusters that frequency views miss.

- **Co-occurrence graph.** Nodes are themes or keywords; an edge joins two themes that appear
  in the same request. Edge weight reflects how often they co-occur. Built from the existing
  `THEME_CASE` keyword classification.
- **Entity graph.** Typed nodes (requester type, theme, owning department, exemption) to trace
  patterns such as which requester types drive which themes into which departments.
- **Precedent graph.** Link an incoming request to its most similar past responses, with edges
  weighted by Cortex Search similarity - a visual bridge into item 1.
- **Technology.** Force-directed graph rendering. Candidate libraries: ECharts graph series,
  `streamlit-agraph`, `pyvis`, or `st.graphviz` for small static graphs. Cap to the top ~20
  themes and prune weak edges to keep the view readable.

## 4. Other candidates

- Auto-acknowledgement and clarification drafting at intake, grounded in policy guidance.
- Disclosure-log publication suggestions when a closed response is of likely public interest.
- Workload and SLA forecasting from historical volume and seasonality.
