"""Case Board — Kanban view of every open case across the lifecycle."""
import streamlit as st
import pandas as pd
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA

st.title(":material/view_kanban: Case Board")
st.caption("Every open case by lifecycle stage. Open a case to work it in the Workspace.")

GROUPS = [
    ("Intake", ["RECEIPT", "VALIDITY", "CLASSIFY", "SAR_REDIRECT", "DUPLICATE", "CLARIFICATION"]),
    ("Processing", ["ALLOCATION", "SEARCH", "COST"]),
    ("Decision", ["EXEMPTIONS", "PIT", "REDACTION"]),
    ("Drafting & Close-out", ["DRAFTING", "QA", "DISPATCH", "PUBLISH"]),
    ("Review & ICO", ["REVIEW"]),
]

cases = session.sql(f"""
    SELECT REFERENCE, REGIME, CURRENT_STAGE, STAGE_NAME, OWNING_DEPARTMENT,
           WD_REMAINING, RAG, CLOCK_STATE, IS_VEXATIOUS
    FROM {SCHEMA}.V_CASE WHERE STATUS='OPEN'
""").to_pandas()

stage_names = session.sql(f"SELECT STAGE_CODE, STAGE_NAME FROM {SCHEMA}.LIFECYCLE_STAGE").to_pandas()
name_map = {r["STAGE_CODE"]: r["STAGE_NAME"] for _, r in stage_names.iterrows()}

source_filter = st.segmented_control("Show", ["All", "At risk only", "EIR only", "FOI only"], default="All")

def visible(row):
    if source_filter == "At risk only":
        return row["RAG"] == "RED"
    if source_filter == "EIR only":
        return row["REGIME"] == "EIR"
    if source_filter == "FOI only":
        return row["REGIME"] == "FOI"
    return True

tabs = st.tabs([f"{g[0]} ({len(cases[cases['CURRENT_STAGE'].isin(g[1])])})" for g in GROUPS])

for tab, (group_name, stages) in zip(tabs, GROUPS):
    with tab:
        cols = st.columns(len(stages))
        for col, stage in zip(cols, stages):
            with col:
                st.markdown(f"**{name_map.get(stage, stage)}**")
                lane = cases[(cases["CURRENT_STAGE"] == stage)]
                lane = lane[lane.apply(visible, axis=1)]
                if lane.empty:
                    st.caption("—")
                for _, row in lane.iterrows():
                    with st.container(border=True):
                        st.markdown(f"{_shared.regime_badge(row['REGIME'])} {_shared.rag_badge(row['RAG'], row['WD_REMAINING'])}")
                        st.markdown(f"**{row['REFERENCE']}**")
                        st.caption(f":material/groups: {row['OWNING_DEPARTMENT'] or 'Unassigned'}")
                        if row["IS_VEXATIOUS"]:
                            st.markdown(":red-badge[s.14 vexatious]")
                        if row["CLOCK_STATE"] not in ("RUNNING", "PIT_EXTENSION", "EIR_COMPLEX"):
                            st.markdown(":violet-badge[clock paused]")
                        if st.button("Open", key=f"open_{row['REFERENCE']}", use_container_width=True):
                            st.session_state["selected_case"] = row["REFERENCE"]
                            st.switch_page("app_pages/workspace.py")
