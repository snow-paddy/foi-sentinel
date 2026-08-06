"""Case Workspace — work a single case through its lifecycle stage by stage."""
import streamlit as st
import pandas as pd
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA

st.title(":material/folder_open: Case Workspace")

open_refs = session.sql(f"SELECT REFERENCE FROM {SCHEMA}.V_CASE ORDER BY STATUS, WD_REMAINING NULLS LAST").to_pandas()["REFERENCE"].tolist()
default_ref = st.session_state.get("selected_case", open_refs[0] if open_refs else None)
if default_ref not in open_refs and open_refs:
    default_ref = open_refs[0]
ref = st.selectbox("Case", open_refs, index=open_refs.index(default_ref) if default_ref in open_refs else 0)
st.session_state["selected_case"] = ref

c = session.sql(f"SELECT * FROM {SCHEMA}.V_CASE WHERE REFERENCE = '{ref}'").to_pandas()
if c.empty:
    st.warning("Case not found.")
    st.stop()
c = c.iloc[0]
case_id = c["CASE_ID"]

# ---- Header ----
h1, h2, h3, h4, h5 = st.columns([2, 1, 1, 1, 1])
h1.markdown(f"### {ref}")
h1.caption(f"{c['REQUESTER_NAME'] or 'Anonymous'}{(' · ' + c['REQUESTER_ORGANISATION']) if c['REQUESTER_ORGANISATION'] else ''} · via {c['SOURCE']}")
h2.markdown("**Regime**"); h2.markdown(_shared.regime_badge(c["REGIME"]))
h3.markdown("**Stage**"); h3.markdown(f":blue-badge[{c['STAGE_NAME']}]")
h4.markdown("**Deadline**"); h4.markdown(_shared.rag_badge(c["RAG"], c["WD_REMAINING"]))
h5.markdown("**Clock**"); h5.markdown(f":grey-badge[{c['CLOCK_STATE']}]")

if c["IS_VEXATIOUS"]:
    st.error(":material/block: Flagged potentially **vexatious (s.14 FOIA)** — review requester history and the pattern of behaviour before proceeding.")

with st.container(border=True):
    st.markdown("**Request**")
    st.markdown(c["REQUEST_TEXT"])

# ---- Stage + clock controls ----
st.divider()
st.subheader(":material/conveyor_belt: Progress this case")
ctrl1, ctrl2, ctrl3 = st.columns([2, 1, 1])
with ctrl1:
    to_stage = st.selectbox("Advance to stage", _shared.STAGE_ORDER,
                            index=min(_shared.STAGE_ORDER.index(c["CURRENT_STAGE"]) + 1, len(_shared.STAGE_ORDER) - 1)
                            if c["CURRENT_STAGE"] in _shared.STAGE_ORDER else 0)
    note = st.text_input("Note", key="adv_note", placeholder="e.g. Allocated to Planning for search")
    if st.button(":material/arrow_forward: Advance stage", type="primary"):
        session.sql(f"CALL {SCHEMA}.SP_ADVANCE_STAGE('{case_id}', '{to_stage}', 'HUMAN', 'FOI Officer', '{note.replace(chr(39), chr(39)*2)}')").collect()
        st.success(f"Advanced to {to_stage}")
        st.rerun()
with ctrl2:
    st.markdown("**Stop the clock**")
    reason = st.selectbox("Reason", ["STOPPED_CLARIFICATION", "STOPPED_FEES", "PIT_EXTENSION"], label_visibility="collapsed")
    if st.button(":material/pause: Stop clock"):
        session.sql(f"CALL {SCHEMA}.SP_STOP_CLOCK('{case_id}', '{reason}', 'FOI Officer', 'Clock stopped from workspace')").collect()
        st.rerun()
with ctrl3:
    st.markdown("**Resume**")
    st.caption("Extends deadline by working days paused")
    if st.button(":material/play_arrow: Resume clock"):
        session.sql(f"CALL {SCHEMA}.SP_RESUME_CLOCK('{case_id}', 'FOI Officer')").collect()
        st.rerun()

# ---- AI triage ----
st.divider()
tri = session.sql(f"SELECT TRIAGE_JSON FROM {SCHEMA}.FOI_TRIAGE WHERE CASE_ID = '{case_id}'").to_pandas()
if not tri.empty and tri.iloc[0]["TRIAGE_JSON"]:
    import json
    tj = tri.iloc[0]["TRIAGE_JSON"]
    tj = json.loads(tj) if isinstance(tj, str) else tj
    with st.container(border=True):
        st.markdown(":material/smart_toy: **AI triage**")
        t1, t2, t3 = st.columns(3)
        t1.markdown(f"Category {_shared.regime_badge(tj.get('category', c['REGIME']))}")
        t2.metric("Complexity", f"{tj.get('complexity_score','?')}/10")
        t3.metric("Est. hours", tj.get("estimated_hours", "?"))
        st.info(f":material/lightbulb: {tj.get('summary','')}")
        st.caption(tj.get("justification", ""))

# ---- Tabs: cost / exemptions+PIT / redactions / responses / timeline ----
tab_cost, tab_ex, tab_red, tab_resp, tab_time = st.tabs(
    [":material/payments: Cost", ":material/shield: Exemptions & PIT", ":material/visibility_off: Redaction",
     ":material/draft: Responses", ":material/history: Timeline"])

with tab_cost:
    st.caption("Only the four prescribed activities count toward the cost limit (Fees Regs 2004 reg.4), at £25/hr.")
    ce = session.sql(f"SELECT * FROM {SCHEMA}.FOI_COST_ESTIMATE WHERE CASE_ID='{case_id}' ORDER BY CREATED_AT DESC LIMIT 1").to_pandas()
    cur = ce.iloc[0] if not ce.empty else None
    e1, e2, e3, e4 = st.columns(4)
    det = e1.number_input("Determine (h)", 0.0, 200.0, float(cur["HOURS_DETERMINE"]) if cur is not None else 1.0, 0.5)
    loc = e2.number_input("Locate (h)", 0.0, 200.0, float(cur["HOURS_LOCATE"]) if cur is not None else 2.0, 0.5)
    ret = e3.number_input("Retrieve (h)", 0.0, 200.0, float(cur["HOURS_RETRIEVE"]) if cur is not None else 2.0, 0.5)
    ext = e4.number_input("Extract (h)", 0.0, 200.0, float(cur["HOURS_EXTRACT"]) if cur is not None else 1.0, 0.5)
    if st.button(":material/calculate: Recalculate cost", type="primary"):
        session.sql(f"CALL {SCHEMA}.SP_COST_ESTIMATE('{case_id}', {det}, {loc}, {ret}, {ext})").collect()
        st.rerun()
    if cur is not None:
        st.metric("Total", f"{cur['TOTAL_HOURS']:.1f} h  ·  £{cur['TOTAL_GBP']:.0f}")
        if cur["EXCEEDS_LIMIT"]:
            st.error(f":material/warning: Exceeds the cost limit (£{cur['LIMIT_GBP']:.0f}). Consider a **s.12 refusal** with **s.16 advice** to narrow the request.")
        elif c["REGIME"] == "EIR":
            st.info(":material/info: " + str(cur["NOTE"]))
        else:
            st.success("Within the cost limit.")

with tab_ex:
    ex = session.sql(f"SELECT * FROM {SCHEMA}.FOI_EXEMPTION_ASSESSMENT WHERE CASE_ID='{case_id}'").to_pandas()
    if ex.empty:
        st.caption("No exemptions assessed yet.")
    for _, r in ex.iterrows():
        with st.container(border=True):
            typ = ":orange-badge[QUALIFIED]" if r["EXEMPTION_TYPE"] == "QUALIFIED" else ":red-badge[ABSOLUTE]"
            st.markdown(f"**{r['SECTION_REF']}** {typ}  ·  Decision: :grey-badge[{r['DECISION']}]")
            if r["PIT_REQUIRED"]:
                st.caption("Public interest test required (qualified exemption — human decision).")
                pcol1, pcol2 = st.columns(2)
                pcol1.success(f"**In favour of disclosure:** {r['PIT_FOR'] or '—'}")
                pcol2.warning(f"**In favour of maintaining exemption:** {r['PIT_AGAINST'] or '—'}")
                if r["DECISION"] == "PENDING":
                    d1, d2 = st.columns(2)
                    if d1.button(":material/lock_open: Disclose (PIT favours release)", key=f"dis_{r['ASSESSMENT_ID']}"):
                        session.sql(f"UPDATE {SCHEMA}.FOI_EXEMPTION_ASSESSMENT SET DECISION='DO_NOT_APPLY', DECIDED_BY='FOI Officer', DECIDED_AT=CURRENT_TIMESTAMP() WHERE ASSESSMENT_ID='{r['ASSESSMENT_ID']}'").collect()
                        st.rerun()
                    if d2.button(":material/lock: Withhold (apply exemption)", key=f"app_{r['ASSESSMENT_ID']}"):
                        session.sql(f"UPDATE {SCHEMA}.FOI_EXEMPTION_ASSESSMENT SET DECISION='APPLY', DECIDED_BY='FOI Officer', DECIDED_AT=CURRENT_TIMESTAMP() WHERE ASSESSMENT_ID='{r['ASSESSMENT_ID']}'").collect()
                        st.rerun()

with tab_red:
    st.caption("Redactions are AI-suggested but every one must be verified by a human (highest-risk step).")
    rd = session.sql(f"SELECT * FROM {SCHEMA}.FOI_REDACTION WHERE CASE_ID='{case_id}'").to_pandas()
    if rd.empty:
        st.caption("No redactions flagged.")
    for _, r in rd.iterrows():
        with st.container(border=True):
            st.markdown(f":material/visibility_off: {r['EXCERPT']}")
            st.caption(f"Basis: {r['BASIS_SECTION']}")
            if r["VERIFIED"]:
                st.markdown(":green-badge[Verified]")
            else:
                if st.button(":material/check: Verify redaction", key=f"ver_{r['REDACTION_ID']}"):
                    session.sql(f"UPDATE {SCHEMA}.FOI_REDACTION SET VERIFIED=TRUE, VERIFIED_BY='FOI Officer' WHERE REDACTION_ID='{r['REDACTION_ID']}'").collect()
                    st.rerun()

with tab_resp:
    rs = session.sql(f"SELECT * FROM {SCHEMA}.FOI_RESPONSE WHERE CASE_ID='{case_id}' ORDER BY CREATED_AT DESC").to_pandas()
    if rs.empty:
        st.caption("No response drafted yet. Use the Response & Refusal Studio to generate a compliant draft.")
    for _, r in rs.iterrows():
        with st.container(border=True):
            st.markdown(f"**{r['RESPONSE_TYPE']}**")
            flags = []
            flags.append("✓ exemption stated" if r["S17_EXEMPTION_STATED"] else "—")
            flags.append("✓ internal review" if r["S17_INTERNAL_REVIEW_INCLUDED"] else "✗ internal review")
            flags.append("✓ ICO route" if r["S17_ICO_ROUTE_INCLUDED"] else "✗ ICO route")
            st.caption("s.17(7) compliance: " + "  ·  ".join(flags))
            st.text_area("Draft", r["FINAL_TEXT"] or r["DRAFT_TEXT"] or "", height=200, key=f"resp_{r['RESPONSE_ID']}")

with tab_time:
    ev = session.sql(f"""
        SELECT EVENT_TS, ACTOR_TYPE, ACTOR, EVENT_TYPE, FROM_STAGE, TO_STAGE, NOTE
        FROM {SCHEMA}.FOI_CASE_EVENT WHERE CASE_ID='{case_id}' ORDER BY EVENT_TS
    """).to_pandas()
    st.caption("Full audit trail — every AI recommendation and human decision, for ICO defensibility.")
    st.dataframe(ev, hide_index=True, use_container_width=True,
                 column_config={"EVENT_TS": st.column_config.DatetimeColumn("When"), "ACTOR_TYPE": "By",
                                "ACTOR": "Actor", "EVENT_TYPE": "Type", "FROM_STAGE": "From", "TO_STAGE": "To", "NOTE": "Note"})
