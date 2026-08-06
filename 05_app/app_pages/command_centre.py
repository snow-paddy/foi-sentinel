"""Command Centre — integrated headlines, SLA, and Snowflake-powered intelligence."""
import io
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA
cfg = _shared.get_config()
target = int(cfg.get("SLA_TARGET_PCT", "90"))

RED, AMBER, GREEN, BLUE, PURPLE = "#c0392b", "#c2660a", "#1f8a4c", "#2457d6", "#6f72af"
PLOT_FONT = dict(family="sans-serif", color="#101828", size=13)


def style(fig, h=300, legend=True):
    fig.update_layout(height=h, margin=dict(l=10, r=10, t=10, b=10),
                      paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font=PLOT_FONT)
    if legend:
        fig.update_layout(legend=dict(orientation="h", yanchor="bottom", y=-0.25, x=0, title=None))
    return fig


# Statutory reference sits at the very top — frames the page like a mark scheme.
_shared.sla_callout()

st.title(":material/dashboard: FOI Command Centre")
st.caption(f"{_shared.council_name()} — the headline view of Freedom of Information and Environmental Information work")

k = session.sql(f"""
    SELECT
        SUM(IFF(STATUS='OPEN',1,0)) OPEN_C,
        SUM(IFF(STATUS='OPEN' AND RAG='RED',1,0)) AT_RISK,
        SUM(IFF(STATUS='OPEN' AND WD_REMAINING<0,1,0)) OVERDUE,
        SUM(IFF(STATUS='CLOSED',1,0)) CLOSED_C,
        SUM(IFF(STATUS='CLOSED' AND ANSWERED_IN_TIME,1,0)) IN_TIME,
        SUM(IFF(REGIME='FOI' AND STATUS='OPEN',1,0)) FOI_O,
        SUM(IFF(REGIME='EIR' AND STATUS='OPEN',1,0)) EIR_O,
        SUM(IFF(REGIME='SAR' AND STATUS='OPEN',1,0)) SAR_O
    FROM {SCHEMA}.V_CASE
""").to_pandas().iloc[0]
open_c, at_risk, overdue = int(k["OPEN_C"]), int(k["AT_RISK"]), int(k["OVERDUE"])
closed_c, in_time = int(k["CLOSED_C"]), int(k["IN_TIME"])
pct = round(100 * in_time / (closed_c or 1))

# ---- Integrated headline stat band (the chips are clickable drill-downs) ----
def _drill(flt):
    st.session_state["cases_filter"] = flt
    st.switch_page("app_pages/cases.py")

# ---- Performance scorecard: open work · SLA gauge (hero) · throughput ----
sc1, sc2, sc3 = st.columns([1, 1.1, 1])
with sc1:
    with st.container(key="kpi_open"):
        st.markdown("<div class='kpi-eyebrow'>Live</div>"
                    f"<div class='stat-num'>{open_c}</div><div class='stat-lbl'>Open requests</div>",
                    unsafe_allow_html=True)
        oc1, oc2 = st.columns(2)
        with oc1:
            if st.button(f"{at_risk} at risk", key="chip_atrisk", use_container_width=True,
                         help="5 working days or fewer to the statutory deadline"):
                _drill("At risk only")
        with oc2:
            if st.button(f"{overdue} overdue", key="chip_overdue", use_container_width=True,
                         help="Past the statutory deadline"):
                _drill("Overdue only")
        st.markdown(
            "<div class='type-list'>"
            f"<div class='type-row'><span class='l'>Information (FOI)</span><span class='c'>{int(k['FOI_O'])}</span></div>"
            f"<div class='type-row'><span class='l'>Environmental (EIR)</span><span class='c'>{int(k['EIR_O'])}</span></div>"
            f"<div class='type-row'><span class='l'>Subject Access (SAR)</span><span class='c'>{int(k['SAR_O'])}</span></div>"
            "</div>", unsafe_allow_html=True)
with sc2:
    with st.container(key="kpi_gauge"):
        st.markdown("<div class='kpi-eyebrow'>Live</div>"
                    "<div class='stat-lbl'>Answered within the statutory deadline</div>",
                    unsafe_allow_html=True)
        gauge = go.Figure(go.Indicator(
            mode="gauge+number", value=pct, number={"suffix": "%", "font": {"size": 40}},
            gauge={"axis": {"range": [0, 100]},
                   "bar": {"color": GREEN if pct >= target else (AMBER if pct >= target-10 else RED)},
                   "steps": [{"range": [0, target-10], "color": "#fbeae8"}, {"range": [target-10, target], "color": "#fdeede"}, {"range": [target, 100], "color": "#e9f3ee"}],
                   "threshold": {"line": {"color": "#0b0c0c", "width": 3}, "value": target}}))
        st.plotly_chart(style(gauge, 220, legend=False), use_container_width=True, config={"displayModeBar": False})
        (st.success if pct >= target else st.warning)(f"{pct}% answered in time (target {target}%)")
with sc3:
    with st.container(key="kpi_closed"):
        st.markdown("<div class='kpi-eyebrow'>Live</div>"
                    f"<div class='stat-num'>{closed_c}</div><div class='stat-lbl'>Closed (this period)</div>"
                    f"<div class='kpi-note'>{pct}% answered within the statutory deadline, against a {target}% regulator target.</div>",
                    unsafe_allow_html=True)

# ---- Peer benchmark line (WhatDoTheyKnow) ----
try:
    _hn = _shared.council_name()
    _bm = session.sql(f"""
        SELECT AUTHORITY_NAME, SUCCESS_RATE, OVERDUE_RATE, SUCCESS_RANK, PEER_COUNT,
               PEER_MEDIAN_SUCCESS, PEER_MEDIAN_OVERDUE
        FROM {SCHEMA}.V_WDTK_BENCHMARK
        WHERE AUTHORITY_NAME ILIKE '%{_hn.split()[0]}%'
        ORDER BY SUCCESS_RANK LIMIT 1
    """).to_pandas()
    if not _bm.empty:
        r = _bm.iloc[0]
        _sr, _med, _rank, _pc = float(r["SUCCESS_RATE"]), float(r["PEER_MEDIAN_SUCCESS"]), int(r["SUCCESS_RANK"]), int(r["PEER_COUNT"])
        _pos = "above" if _sr >= _med else "below"
        with st.container(border=True, key="wdtk_bench_line"):
            st.markdown(
                f":material/trending_up: **Versus peers (WhatDoTheyKnow):** "
                f"{_hn} discloses information on **{_sr*100:.0f}%** of requests, {_pos} the peer median of "
                f"{_med*100:.0f}% — ranked **{_rank} of {_pc}**. See **Sector Trends** for the full comparison.")
except Exception:
    pass

st.divider()

# ---- Where requests are in the process (centre-aligned funnel) ----
st.markdown("**Where requests are in the process**")
st.caption("Open requests by lifecycle stage — the funnel widens where work piles up; red shows those at risk of breaching the deadline.")
pipe = session.sql(f"""
    SELECT STAGE_ORDER, STAGE_NAME,
           SUM(IFF(RAG='RED' OR WD_REMAINING<0,1,0)) AT_RISK,
           SUM(IFF(NOT(RAG='RED' OR WD_REMAINING<0),1,0)) ON_TRACK
    FROM {SCHEMA}.V_CASE WHERE STATUS='OPEN' GROUP BY STAGE_ORDER, STAGE_NAME ORDER BY STAGE_ORDER
""").to_pandas().sort_values("STAGE_ORDER")
pipe["TOT"] = pipe["ON_TRACK"] + pipe["AT_RISK"]
half = pipe["TOT"] / 2.0
maxh = float(half.max()) if len(half) and half.max() > 0 else 1.0
fig = go.Figure()
fig.add_bar(y=pipe["STAGE_NAME"], x=pipe["ON_TRACK"], base=(-half).tolist(), orientation="h",
            name="On track", marker_color=BLUE, hovertemplate="%{y}<br>On track: %{x}<extra></extra>")
fig.add_bar(y=pipe["STAGE_NAME"], x=pipe["AT_RISK"], base=(-half + pipe["ON_TRACK"]).tolist(), orientation="h",
            name="At risk", marker_color=RED, hovertemplate="%{y}<br>At risk: %{x}<extra></extra>")
fig.update_layout(barmode="overlay", bargap=0.34)
for nm, h, tot in zip(pipe["STAGE_NAME"], half, pipe["TOT"]):
    if tot:
        fig.add_annotation(x=h, y=nm, text=str(int(tot)), showarrow=False,
                           xanchor="left", xshift=6, font=dict(size=11, color="#667085"))
fig.update_yaxes(autorange="reversed", title=None)
fig.update_xaxes(visible=False, range=[-maxh*1.30, maxh*1.30], zeroline=False)
st.plotly_chart(style(fig, 420), use_container_width=True, config={"displayModeBar": False})

st.divider()

# ============================================================
# Snowflake-powered intelligence
# ============================================================
st.subheader(":material/insights: Intelligence — powered by Snowflake Cortex")
st.caption("Case systems store requests; Snowflake analyses them in place — themes, trends and patterns across the whole corpus. "
           "This is the analytical layer a storage-only system cannot provide.")
st.caption(":material/science: Synthetic test cases created in the demo tools are excluded here, so these analytics reflect the real request corpus.")
CORPUS = f"FROM {SCHEMA}.FOI_CASE WHERE NOT COALESCE(IS_SYNTHETIC, FALSE)"

THEME_CASE = """
  CASE
    WHEN REQUEST_TEXT ILIKE ANY ('%spend%','%payment%','%budget%','%cost%','%consultan%','%procure%','%contract%','%finance%') THEN 'Spending & contracts'
    WHEN REQUEST_TEXT ILIKE ANY ('%planning%','%develop%','%harbour%','%housing%','%right to buy%','%homeless%') THEN 'Planning & housing'
    WHEN REQUEST_TEXT ILIKE ANY ('%social care%','%safeguard%','%children%','%care%','%SEND%','%EHCP%') THEN 'Social care & SEND'
    WHEN REQUEST_TEXT ILIKE ANY ('%environment%','%air quality%','%flood%','%tree%','%recycl%','%noise%','%contaminat%','%ecolog%') THEN 'Environment'
    WHEN REQUEST_TEXT ILIKE ANY ('%transport%','%parking%','%highway%','%pothole%','%bus%','%EV%','%traffic%') THEN 'Transport & highways'
    WHEN REQUEST_TEXT ILIKE ANY ('%school%','%education%','%pupil%','%appeal%') THEN 'Education'
    WHEN REQUEST_TEXT ILIKE ANY ('%staff%','%grievance%','%officer%','%salary%','%HR%','%RIPA%') THEN 'Staffing & governance'
    ELSE 'Other'
  END
"""

ic1, ic2 = st.columns([1, 1])
with ic1:
    st.markdown("**What are people asking about?**")
    st.caption("Topics across live and closed requests. Larger = more frequent; hover for counts.")
    txt_df = session.sql(f"SELECT LISTAGG(REQUEST_TEXT, ' ') ALLTXT {CORPUS}").to_pandas()
    corpus = txt_df.iloc[0]["ALLTXT"] or ""
    import re
    from collections import Counter
    from wordcloud import STOPWORDS
    extra = {"please", "provide", "information", "request", "council", "freedom", "act", "would", "like",
             "year", "years", "data", "details", "number", "last", "three", "bristol", "exampleton", "council", "under", "foi", "copy", "also",
             "many", "much", "past", "five", "want", "holds", "hold", "relating", "confirm", "list", "send", "end"}
    stop = {s.lower() for s in STOPWORDS} | extra
    toks = [w for w in re.findall(r"[a-zA-Z]{4,}", corpus.lower()) if w not in stop]
    freq = Counter(toks)
    top = pd.DataFrame(freq.most_common(20), columns=["term", "n"])

    tab_cloud, tab_tree = st.tabs(["Word cloud", "Treemap"])
    with tab_cloud:
        drawn = False
        try:
            from wordcloud import WordCloud
            wc = WordCloud(width=720, height=360, background_color="white", colormap="Blues",
                           prefer_horizontal=0.9, max_words=70, relative_scaling=0.45,
                           ).generate_from_frequencies(dict(freq.most_common(70)))
            buf = io.BytesIO(); wc.to_image().save(buf, format="PNG")
            st.image(buf.getvalue(), use_container_width=True)
            drawn = True
        except Exception:
            drawn = False
        if not drawn:
            fig = px.bar(top.head(15), x="n", y="term", orientation="h")
            fig.update_traces(marker_color=BLUE); fig.update_yaxes(autorange="reversed", title=None); fig.update_xaxes(title=None)
            st.plotly_chart(style(fig, 380, legend=False), use_container_width=True, config={"displayModeBar": False})
    with tab_tree:
        tm = px.treemap(top, path=["term"], values="n", color="n", color_continuous_scale="Blues")
        tm.update_traces(textinfo="label+value", root_color="rgba(0,0,0,0)")
        tm.update_layout(height=360, margin=dict(l=0, r=0, t=0, b=0), coloraxis_showscale=False,
                         paper_bgcolor="rgba(0,0,0,0)")
        st.plotly_chart(tm, use_container_width=True, config={"displayModeBar": False})

with ic2:
    st.markdown("**Emerging themes over time**")
    st.caption("Requests grouped into themes by month — an early read on demand shifts.")
    theme_trend = session.sql(f"""
        SELECT DATE_TRUNC('month', RECEIVED_DATE)::DATE MONTH, {THEME_CASE} THEME, COUNT(*) N
        {CORPUS} GROUP BY MONTH, THEME ORDER BY MONTH
    """).to_pandas()
    fig = px.area(theme_trend, x="MONTH", y="N", color="THEME",
                  color_discrete_sequence=px.colors.qualitative.Safe)
    fig.update_layout(height=400, margin=dict(l=10, r=10, t=64, b=10),
                      paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font=PLOT_FONT,
                      legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0, title=None, font=dict(size=11)))
    fig.update_xaxes(title_text="Month", gridcolor="#eef0f3", tickformat="%b %Y", tickangle=-40, nticks=6)
    fig.update_yaxes(title_text="Requests", gridcolor="#eef0f3", rangemode="tozero")
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    st.caption("Reflects seeded demo volumes; in production this surfaces month-on-month demand shifts by theme.")

st.markdown("**Requester patterns — repeat requesters and potential campaigns**")
st.caption("**Section 14** of the FOI Act lets a council refuse a request that is *vexatious* — for example one designed to harass or "
           "cause disproportionate disruption, or part of an unreasonable, repeated or obsessive pattern. The flag below is an early "
           "prompt for officer judgement, not an automatic refusal. **Avg tone** is the mean Cortex sentiment of a requester's "
           "messages, from \u22121 (hostile) to +1 (positive); high volume with a persistently negative tone is one signal to review.")
reqs = session.sql(f"""
    SELECT COALESCE(REQUESTER_ORGANISATION, REQUESTER_NAME) REQUESTER,
           COUNT(*) REQUESTS,
           SUM(IFF(IS_VEXATIOUS,1,0)) FLAGGED,
           ROUND(AVG(SENTIMENT_SCORE),2) AVG_SENTIMENT
    {CORPUS}
    GROUP BY REQUESTER HAVING COUNT(*) >= 1 ORDER BY REQUESTS DESC, REQUESTER LIMIT 10
""").to_pandas()


def _tone(v):
    if pd.isna(v):
        return "n/a"
    band = "Negative" if v < -0.3 else ("Positive" if v > 0.3 else "Neutral")
    return f"{band} ({v:+.2f})"


reqs["TONE"] = reqs["AVG_SENTIMENT"].apply(_tone)
reqs["FLAG"] = reqs["FLAGGED"].apply(lambda n: "\u2691 Yes" if n else "\u2014")
_mxr = int(reqs["REQUESTS"].max()) if not reqs.empty else 1
st.dataframe(reqs[["REQUESTER", "REQUESTS", "TONE", "FLAG"]], hide_index=True, use_container_width=True, column_config={
    "REQUESTER": st.column_config.TextColumn("Requester / organisation"),
    "REQUESTS": st.column_config.ProgressColumn("Requests", format="%d", min_value=0, max_value=_mxr),
    "TONE": st.column_config.TextColumn("Avg tone", help="Mean Cortex sentiment of this requester's messages, \u22121 (hostile) to +1 (positive)"),
    "FLAG": st.column_config.TextColumn("Section 14 flag", help="Flagged as potentially vexatious")})
