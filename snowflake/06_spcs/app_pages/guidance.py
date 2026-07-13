"""Knowledge & Guidance — search-first, theme pills, compact AI advisor widget."""
import json
import streamlit as st
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA


def esc(t):
    return (t or "").replace("'", "''").replace("\\", "\\\\")


def search(service, query, columns, limit=4):
    try:
        q = esc(query.replace("\n", " "))
        df = session.sql(f"""
            SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
                '{SCHEMA}.{service}', '{{"query": "{q}", "columns": {json.dumps(columns)}, "limit": {limit}}}')):results AS R
        """).to_pandas()
        if not df.empty and df.iloc[0]["R"]:
            return json.loads(df.iloc[0]["R"])
    except Exception as e:
        st.caption(f"Search unavailable: {e}")
    return []


THEMES = {
    "Cost limit": "cost limit appropriate limit 18 hours section 12",
    "Personal data": "personal data exemption section 40 data protection",
    "Vexatious requests": "vexatious request section 14 repeated",
    "Environmental information": "environmental information regulations exceptions",
    "Commercial interests": "commercial interests trade secrets section 43",
    "Public interest test": "public interest test qualified exemption balance",
    "Internal reviews": "internal review procedure complaint",
    "Already published": "information reasonably accessible section 21 publication scheme",
}

st.title(":material/menu_book: Knowledge & Guidance")
st.caption("Search council and Information Commissioner guidance, the legislation library and past disclosures. "
           "For tailored advice, use the **Assistant** (bottom right) — it is aware of your live caseload.")

# Search first
query = st.text_input("Search guidance", value=st.session_state.get("kg_query", ""),
                      placeholder="e.g. personal data, cost limit, environmental request", label_visibility="collapsed")

# Themes below the search bar (readable pills)
st.caption("Or browse by theme:")
picked = st.pills("Themes", list(THEMES.keys()), selection_mode="single", label_visibility="collapsed")
if picked:
    query = THEMES[picked]
    st.session_state["kg_query"] = query

st.divider()

if query:
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("#### :material/policy: Council & regulator guidance")
        res = search("COUNCIL_POLICY_SEARCH", query, ["DOC_TITLE", "DOC_TYPE", "SECTION_REF", "CONTENT"])
        if not res:
            st.caption("No matching guidance.")
        for p in res:
            with st.container(border=True):
                badge = ":blue-badge[Commissioner]" if p.get("DOC_TYPE") == "ICO_GUIDANCE" else ":green-badge[Council]"
                st.markdown(f"{badge} **{p.get('DOC_TITLE','')}** ({p.get('SECTION_REF','')})")
                st.caption((p.get("CONTENT", "") or "")[:400] + "...")
    with col2:
        st.markdown("#### :material/history: Past disclosures")
        res = search("DISCLOSURE_SEARCH", query, ["REFERENCE_NUMBER", "TOPIC", "REQUEST_SUMMARY", "RESPONSE_SUMMARY", "EXEMPTIONS_APPLIED"])
        if not res:
            st.caption("No similar past requests.")
        for d in res:
            with st.container(border=True):
                st.markdown(f"**{d.get('REFERENCE_NUMBER','')}** — {d.get('TOPIC','')}")
                st.caption(f"Outcome: {d.get('RESPONSE_SUMMARY','')}")
                if d.get("EXEMPTIONS_APPLIED"):
                    st.markdown(f":orange-badge[{d['EXEMPTIONS_APPLIED']}]")

    if st.toggle("Include cross-authority precedent from WhatDoTheyKnow", value=True,
                 help="How other UK authorities have handled comparable requests, grounded in real published responses"):
        st.markdown("#### :material/public: How other authorities handled this")
        wres = search("WDTK_PRECEDENT_SEARCH", query,
                      ["AUTHORITY_NAME", "OUTCOME", "THEME", "LAW_USED", "REQUEST_TITLE", "REQUEST_URL", "SNIPPET"], limit=6)
        if not wres:
            st.caption("No matching cross-authority precedent.")
        wc1, wc2 = st.columns(2)
        for i, w in enumerate(wres):
            outcome = w.get("OUTCOME", "")
            badge = {"Refused": ":red-badge[Refused]", "Information not held": ":gray-badge[Not held]",
                     "Successful": ":green-badge[Disclosed]", "Partially successful": ":orange-badge[Part disclosed]"}.get(outcome, ":blue-badge[Response]")
            with (wc1 if i % 2 == 0 else wc2):
                with st.container(border=True):
                    st.markdown(f"{badge} **{w.get('REQUEST_TITLE','(untitled)')}**")
                    st.caption(f"{w.get('AUTHORITY_NAME','')} · {(w.get('LAW_USED') or '').upper()}")
                    st.caption((w.get("SNIPPET", "") or "")[:300])
                    if w.get("REQUEST_URL"):
                        st.markdown(f"[View on WhatDoTheyKnow]({w['REQUEST_URL']})")
        st.caption(":material/info: Source: WhatDoTheyKnow (mySociety). Published responses can contain personal data — "
                   "for officer reference, not onward disclosure.")
else:
    st.info(":material/info: Search above or pick a theme to see guidance and precedents. Use the **Assistant** (bottom right) for tailored help.")

with st.expander(":material/balance: Legislation library (Freedom of Information & Environmental Information)"):
    typ = st.segmented_control("Filter", ["All", "EXEMPTION_ABSOLUTE", "EXEMPTION_QUALIFIED", "PROCEDURE"], default="All")
    where = "" if typ == "All" else f"WHERE TYPE = '{typ}'"
    leg = session.sql(f"SELECT SECTION_REF, TYPE, TITLE, SUMMARY, PUBLIC_INTEREST_TEST FROM {SCHEMA}.FOI_LEGISLATION {where} ORDER BY SECTION_REF").to_pandas()
    st.dataframe(leg, hide_index=True, use_container_width=True, column_config={
        "SECTION_REF": "Section", "TYPE": "Type", "TITLE": "Title", "SUMMARY": "Summary", "PUBLIC_INTEREST_TEST": "Public interest test?"})
