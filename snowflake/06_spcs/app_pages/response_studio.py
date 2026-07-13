"""Response & Refusal Studio — generate s.17(7)-compliant drafts via Cortex."""
import streamlit as st
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA

st.title(":material/draft: Response & Refusal Studio")
st.caption("Generate disclosure letters, partial responses and refusal notices grounded in legislation. "
           "Every refusal automatically includes the internal-review and ICO complaint routes (s.17(7) FOIA).")

refs = session.sql(f"SELECT REFERENCE FROM {SCHEMA}.V_CASE WHERE STATUS='OPEN' ORDER BY WD_REMAINING NULLS LAST").to_pandas()["REFERENCE"].tolist()
if not refs:
    st.info("No open cases.")
    st.stop()

default = st.session_state.get("selected_case")
ref = st.selectbox("Case", refs, index=refs.index(default) if default in refs else 0)
c = session.sql(f"SELECT * FROM {SCHEMA}.V_CASE WHERE REFERENCE='{ref}'").to_pandas().iloc[0]
case_id = c["CASE_ID"]

st.markdown(f"{_shared.regime_badge(c['REGIME'])} **{ref}** — {c['STAGE_NAME']}")
with st.container(border=True):
    st.markdown("**Request**")
    st.caption(c["REQUEST_TEXT"])

rtype = st.radio("Response type", ["DISCLOSURE", "PARTIAL", "REFUSAL", "S21_REUSE"], horizontal=True)
type_help = {
    "DISCLOSURE": "Full disclosure of the requested information.",
    "PARTIAL": "Some information disclosed, some withheld under exemptions (s.17 applies).",
    "REFUSAL": "Information withheld under one or more exemptions (s.17 refusal notice).",
    "S21_REUSE": "Information already reasonably accessible — point to the prior disclosure (s.21).",
}
st.caption(type_help[rtype])

if st.button(":material/auto_awesome: Generate compliant draft", type="primary"):
    with st.spinner("Drafting with Cortex (mistral-large2)..."):
        session.sql(f"CALL {SCHEMA}.SP_GENERATE_RESPONSE('{case_id}', '{rtype}')").collect()
    st.success("Draft generated.")
    st.rerun()

drafts = session.sql(f"SELECT * FROM {SCHEMA}.FOI_RESPONSE WHERE CASE_ID='{case_id}' ORDER BY CREATED_AT DESC").to_pandas()
for _, r in drafts.iterrows():
    with st.container(border=True):
        st.markdown(f"**{r['RESPONSE_TYPE']}**  ·  drafted {r['CREATED_AT']:%d %b %H:%M}")
        checks = []
        checks.append(("Exemption stated", r["S17_EXEMPTION_STATED"]))
        checks.append(("Internal review route", r["S17_INTERNAL_REVIEW_INCLUDED"]))
        checks.append(("ICO complaint route (s.50)", r["S17_ICO_ROUTE_INCLUDED"]))
        cols = st.columns(3)
        for col, (lbl, ok) in zip(cols, checks):
            col.markdown((":green-badge[✓ " if ok else ":red-badge[✗ ") + lbl + "]")
        edited = st.text_area("Draft letter", r["FINAL_TEXT"] or r["DRAFT_TEXT"] or "", height=320, key=f"d_{r['RESPONSE_ID']}")
        b1, b2 = st.columns(2)
        if b1.button(":material/save: Save as final", key=f"fin_{r['RESPONSE_ID']}"):
            session.sql(f"UPDATE {SCHEMA}.FOI_RESPONSE SET FINAL_TEXT='{edited.replace(chr(39), chr(39)*2)}', SIGNED_OFF_BY='FOI Officer' WHERE RESPONSE_ID='{r['RESPONSE_ID']}'").collect()
            st.success("Saved as final.")
        if b2.button(":material/send: Mark dispatched (close case)", key=f"disp_{r['RESPONSE_ID']}"):
            session.sql(f"UPDATE {SCHEMA}.FOI_RESPONSE SET DISPATCHED_AT=CURRENT_TIMESTAMP() WHERE RESPONSE_ID='{r['RESPONSE_ID']}'").collect()
            session.sql(f"UPDATE {SCHEMA}.FOI_CASE SET STATUS='CLOSED', CURRENT_STAGE='DISPATCH', CLOSED_DATE=CURRENT_DATE(), ANSWERED_IN_TIME=(CURRENT_DATE()<=STATUTORY_DEADLINE) WHERE CASE_ID='{case_id}'").collect()
            session.sql(f"CALL {SCHEMA}.SP_ADVANCE_STAGE('{case_id}','DISPATCH','HUMAN','FOI Officer','Response dispatched')").collect()
            st.success("Dispatched and case closed.")
            st.rerun()
