"""Intake & Triage — live AI classification, s.21 duplicate detection, create a case."""
import streamlit as st
import json
from datetime import datetime
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA

st.title(":material/inbox: Intake & Triage")
st.caption("Paste an incoming request. The system classifies it live (FOI/EIR/SAR), checks for prior disclosures (s.21), and opens a case.")


def esc(t):
    return (t or "").replace("'", "''").replace("\\", "\\\\")


def search_service(service, query, columns, limit=3):
    try:
        q = esc(query.replace("\n", " ").replace("\r", " "))
        cols = json.dumps(columns)
        df = session.sql(f"""
            SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
                '{SCHEMA}.{service}',
                '{{"query": "{q}", "columns": {cols}, "limit": {limit}}}')):results AS R
        """).to_pandas()
        if not df.empty and df.iloc[0]["R"]:
            return json.loads(df.iloc[0]["R"])
    except Exception as e:
        st.caption(f"Search unavailable: {e}")
    return []


txt = st.text_area("Incoming request", height=200,
                   placeholder="Dear Exampleton Council, under the Freedom of Information Act 2000 please provide...")

col_a, col_b = st.columns(2)
name = col_a.text_input("Requester name", "")
source = col_b.selectbox("Source", ["EMAIL", "WEB_PORTAL", "WHATDOTHEYKNOW", "LETTER", "PHONE"])

if st.button(":material/bolt: Analyse & triage", type="primary", use_container_width=True):
    if not txt or len(txt.strip()) < 20:
        st.error("Please paste a substantive request (20+ characters).")
    else:
        with st.spinner("Analysing sentiment..."):
            sent = float(session.sql(f"SELECT SNOWFLAKE.CORTEX.SENTIMENT('{esc(txt)}') S").to_pandas().iloc[0]["S"])
        with st.spinner("Classifying with Cortex (mistral-large2)..."):
            prompt = ("You are an expert UK local-government FOI officer. Return JSON only with keys: "
                      "category (FOI/EIR/SAR/BAU), priority (HIGH/MEDIUM/LOW), complexity_score (1-10), "
                      "suggested_exemptions (array), suggested_departments (array), estimated_hours (number), "
                      "is_vexatious (boolean), is_sar (boolean), summary (1 sentence), justification (2-3 sentences). REQUEST: "
                      + txt + " JSON only.")
            raw = session.sql(f"SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '{esc(prompt)}') R").to_pandas().iloc[0]["R"]
            if "```" in raw:
                raw = raw.split("```")[1]
                raw = raw[4:] if raw.startswith("json") else raw
            try:
                cl = json.loads(raw.strip())
            except Exception:
                cl = None
        with st.spinner("Checking past disclosures (s.21) and Camden precedents..."):
            disclosures = search_service("DISCLOSURE_SEARCH", txt, ["REFERENCE_NUMBER", "TOPIC", "REQUEST_SUMMARY", "RESPONSE_SUMMARY", "EXEMPTIONS_APPLIED"])
            camden = search_service("CAMDEN_FOI_SEARCH", txt, ["IDENTIFIER", "DOCUMENT_TITLE", "DOCUMENT_TEXT"], limit=2)
        st.session_state["intake_result"] = {"sent": sent, "cl": cl, "disc": disclosures, "camden": camden, "txt": txt, "name": name, "source": source}

res = st.session_state.get("intake_result")
if res and res["cl"]:
    cl = res["cl"]
    st.divider()
    st.subheader(":material/smart_toy: AI triage")
    m1, m2, m3, m4 = st.columns(4)
    m1.markdown("**Regime**"); m1.markdown(_shared.regime_badge(cl.get("category", "FOI")))
    m2.markdown("**Priority**"); m2.markdown(f":orange-badge[{cl.get('priority','MEDIUM')}]")
    m3.markdown("**Sentiment**"); m3.markdown(_shared.sentiment_badge(res["sent"]))
    m4.metric("Est. hours", cl.get("estimated_hours", "?"))

    if cl.get("category") == "SAR" or cl.get("is_sar"):
        st.warning(":material/person: **Looks like a Subject Access Request.** If the requester only wants their own personal data, this is exempt under **s.40(1) FOIA** and must be handled as a SAR under the **Data Protection Act 2018 / UK GDPR (one month)** — redirect to Information Governance.")
    if cl.get("category") == "EIR":
        st.info(":material/eco: **Environmental information (EIR 2004).** No cost limit applies; complex requests may be extended to **40 working days** (reg.7).")
    if cl.get("is_vexatious"):
        st.error(":material/block: Potentially **vexatious (s.14)** — assess the pattern of behaviour, not just this request.")

    st.info(f":material/lightbulb: {cl.get('summary','')}")
    st.caption(cl.get("justification", ""))
    if cl.get("suggested_exemptions"):
        st.markdown("**Possible exemptions:** " + ", ".join(cl["suggested_exemptions"]))
    if cl.get("suggested_departments"):
        st.markdown("**Route to:** " + ", ".join(cl["suggested_departments"]))

    if res["disc"]:
        st.divider()
        st.subheader(":material/content_copy: Possible duplicate — s.21 reuse")
        st.caption("Information already reasonably accessible may be refused under **s.21** and answered by pointing to the prior disclosure.")
        for d in res["disc"]:
            with st.container(border=True):
                st.markdown(f"**{d.get('REFERENCE_NUMBER','')}** — {d.get('TOPIC','')}")
                st.caption(f"Outcome: {d.get('RESPONSE_SUMMARY','')}")

    if res["camden"]:
        with st.expander(":material/location_city: Similar requests handled by Camden Council (precedent corpus)"):
            for cm in res["camden"]:
                st.markdown(f"**{cm.get('IDENTIFIER','')}** — {cm.get('DOCUMENT_TITLE','')}")
                st.caption((cm.get("DOCUMENT_TEXT", "") or "")[:300] + "...")

    st.divider()
    if st.button(":material/add: Create case from this request", type="primary"):
        regime = cl.get("category", "FOI")
        ref_prefix = {"EIR": "EIR", "SAR": "SAR"}.get(regime, "FOI")
        ref = f"{ref_prefix}-{datetime.now().strftime('%Y')}-W{datetime.now().strftime('%m%d%H%M')}"
        depts = cl.get("suggested_departments") or []
        dept = esc(depts[0]) if depts else ""
        deadline_sql = (f"(SELECT MIN(c2.CAL_DATE) FROM {SCHEMA}.CALENDAR c2 WHERE c2.IS_WORKING_DAY "
                        f"AND c2.WD_INDEX = (SELECT WD_INDEX FROM {SCHEMA}.CALENDAR WHERE CAL_DATE=CURRENT_DATE())+20)")
        session.sql(f"""
            INSERT INTO {SCHEMA}.FOI_CASE
            (REFERENCE, SOURCE, REQUESTER_NAME, REQUEST_TEXT, RECEIVED_DATE, REGIME, CURRENT_STAGE, STATUS,
             OWNING_DEPARTMENT, STATUTORY_DEADLINE, CLOCK_STATE, SENTIMENT_SCORE, IS_VEXATIOUS)
            SELECT '{ref}', '{esc(res['source'])}', '{esc(res['name'])}', '{esc(res['txt'])}', CURRENT_DATE(),
                   '{regime}', 'CLASSIFY', 'OPEN', '{dept}', {deadline_sql}, 'RUNNING', {res['sent']}, {bool(cl.get('is_vexatious'))}
        """).collect()
        new_id = session.sql(f"SELECT CASE_ID FROM {SCHEMA}.FOI_CASE WHERE REFERENCE='{ref}'").to_pandas().iloc[0]["CASE_ID"]
        session.sql(f"""INSERT INTO {SCHEMA}.FOI_TRIAGE (CASE_ID, TRIAGE_JSON, COMPUTED_AT)
                        SELECT '{new_id}', PARSE_JSON('{esc(json.dumps(cl))}'), CURRENT_TIMESTAMP()""").collect()
        session.sql(f"""INSERT INTO {SCHEMA}.FOI_CASE_EVENT (CASE_ID, TO_STAGE, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
                        SELECT '{new_id}', 'CLASSIFY', 'AI', 'mistral-large2', 'DECISION', 'Live triage on intake'""").collect()
        st.success(f"Case {ref} created and triaged. Open it in the Case Workspace.")
        st.session_state["selected_case"] = ref
