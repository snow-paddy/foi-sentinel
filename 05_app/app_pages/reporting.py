"""Performance Reporting — s.45 Code Part 8.5 compliance statistics."""
import streamlit as st
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA
cfg = _shared.get_config()
target = int(cfg.get("SLA_TARGET_PCT", "90"))

st.title(":material/monitoring: Performance Reporting")
st.caption("Compliance statistics for publication under the s.45 Code of Practice (Part 8.5). "
           "Authorities with 100+ FTE should publish these quarterly.")

overall = session.sql(f"""
    SELECT COUNT(*) AS CLOSED, SUM(IFF(ANSWERED_IN_TIME,1,0)) AS IN_TIME,
           ROUND(100*SUM(IFF(ANSWERED_IN_TIME,1,0))/NULLIF(COUNT(*),0),1) AS PCT
    FROM {SCHEMA}.FOI_CASE WHERE STATUS='CLOSED'
""").to_pandas().iloc[0]

m1, m2, m3 = st.columns(3)
m1.metric("Requests closed", int(overall["CLOSED"]))
m2.metric("Answered in 20 WD", int(overall["IN_TIME"]))
m3.metric("In-time %", f"{overall['PCT']}%", delta=f"{overall['PCT']-target:+.0f} vs target")

st.progress(min(float(overall["PCT"]) / 100, 1.0), text=f"{overall['PCT']}% within statutory deadline (target {target}%)")
if float(overall["PCT"]) < target:
    st.warning(f":material/warning: Below the {target}% target — the ICO monitors authorities under ~90% and may issue a practice recommendation.")

st.divider()
col1, col2 = st.columns(2)
with col1:
    st.subheader("In-time performance by regime")
    by_reg = session.sql(f"""
        SELECT REGIME, COUNT(*) AS CLOSED, ROUND(100*SUM(IFF(ANSWERED_IN_TIME,1,0))/NULLIF(COUNT(*),0),0) AS PCT_IN_TIME
        FROM {SCHEMA}.FOI_CASE WHERE STATUS='CLOSED' GROUP BY REGIME ORDER BY REGIME
    """).to_pandas()
    st.bar_chart(by_reg, x="REGIME", y="PCT_IN_TIME")
    st.dataframe(by_reg, hide_index=True, use_container_width=True)
with col2:
    st.subheader("Outcomes")
    outcomes = session.sql(f"""
        SELECT OUTCOME, COUNT(*) AS N FROM {SCHEMA}.FOI_CASE WHERE STATUS='CLOSED' AND OUTCOME IS NOT NULL
        GROUP BY OUTCOME ORDER BY N DESC
    """).to_pandas()
    st.bar_chart(outcomes, x="OUTCOME", y="N", horizontal=True)

st.divider()
st.subheader("Volume received by month")
vol = session.sql(f"""
    SELECT DATE_TRUNC('month', RECEIVED_DATE)::DATE AS MONTH, COUNT(*) AS RECEIVED
    FROM {SCHEMA}.FOI_CASE GROUP BY MONTH ORDER BY MONTH
""").to_pandas()
st.line_chart(vol, x="MONTH", y="RECEIVED")

st.divider()
st.subheader("Current open workload by department")
wl = session.sql(f"""
    SELECT OWNING_DEPARTMENT AS DEPARTMENT, COUNT(*) AS OPEN_CASES,
           SUM(IFF(WD_REMAINING<0,1,0)) AS OVERDUE
    FROM {SCHEMA}.V_CASE WHERE STATUS='OPEN' GROUP BY DEPARTMENT ORDER BY OPEN_CASES DESC
""").to_pandas()
st.dataframe(wl, hide_index=True, use_container_width=True)
