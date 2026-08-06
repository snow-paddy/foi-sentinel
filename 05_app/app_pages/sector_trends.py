"""Sector Trends — how this authority compares to peers on WhatDoTheyKnow.

Reads the pre-loaded WDTK tables (WDTK_AUTHORITY / WDTK_EVENT / V_WDTK_BENCHMARK)
and the WDTK_PRECEDENT_SEARCH Cortex Search service. The live app never calls
WhatDoTheyKnow directly — the data is ingested separately (Cloudflare-gated API).
"""
import json
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA

RED, AMBER, GREEN, BLUE, GREY = "#c0392b", "#c2660a", "#1f8a4c", "#2457d6", "#7a828a"
PLOT_FONT = dict(family="sans-serif", color="#101828", size=13)


def _style(fig, h=320, legend=True):
    fig.update_layout(height=h, margin=dict(l=10, r=10, t=10, b=10),
                      paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font=PLOT_FONT)
    if legend:
        fig.update_layout(legend=dict(orientation="h", yanchor="bottom", y=-0.25, x=0, title=None))
    return fig


THEME_LABELS = {
    "s12_cost": "s.12 cost limit",
    "s14_vexatious": "s.14 vexatious",
    "s21_published": "s.21 already published",
    "s40_personal": "s.40 personal data",
    "s43_commercial": "s.43 commercial",
    "eir_environmental": "EIR environmental",
}

st.title(":material/trending_up: Sector Trends")
st.caption(f"How {_shared.council_name()} compares with peer authorities on Freedom of Information performance, "
           "drawn from requests published on WhatDoTheyKnow (mySociety).")

# --- Load benchmark data (defensive: WDTK tables may not be present) ----------
try:
    bench = session.sql(f"SELECT * FROM {SCHEMA}.V_WDTK_BENCHMARK ORDER BY SUCCESS_RATE DESC").to_pandas()
except Exception:
    bench = pd.DataFrame()

if bench.empty:
    st.info("Sector benchmark data has not been loaded yet. Run the WhatDoTheyKnow ingestion to populate "
            "`WDTK_AUTHORITY` and `WDTK_EVENT`.")
    st.stop()

# Identify the home authority (this council) within the peer set
home_name = _shared.council_name()
home = bench[bench["AUTHORITY_NAME"].str.contains(home_name.split()[0], case=False, na=False)]
if home.empty:
    home = bench[bench["AUTHORITY_SLUG"] == "bristol_city_council"]
home_row = home.iloc[0] if not home.empty else None

peer_count = int(bench["PEER_COUNT"].iloc[0])
med_success = float(bench["PEER_MEDIAN_SUCCESS"].iloc[0])
med_overdue = float(bench["PEER_MEDIAN_OVERDUE"].iloc[0])

# --- Headline KPI tiles -------------------------------------------------------
if home_row is not None:
    hs, ho, hr = float(home_row["SUCCESS_RATE"]), float(home_row["OVERDUE_RATE"]), int(home_row["SUCCESS_RANK"])
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        with st.container(border=True, key="wdtk_kpi1"):
            st.markdown(f"<div class='stat-num'>{hs*100:.0f}%</div>"
                        f"<div class='stat-lbl'>{home_name} disclosure rate</div>"
                        f"<div class='stat-sub'>Requests with information released, in full or part</div>",
                        unsafe_allow_html=True)
    with c2:
        delta = (hs - med_success) * 100
        with st.container(border=True, key="wdtk_kpi2"):
            st.markdown(f"<div class='stat-num'>{med_success*100:.0f}%</div>"
                        f"<div class='stat-lbl'>Peer median disclosure rate</div>"
                        f"<div class='stat-sub'>{home_name} is {abs(delta):.0f} pts {'above' if delta>=0 else 'below'} the median</div>",
                        unsafe_allow_html=True)
    with c3:
        with st.container(border=True, key="wdtk_kpi3"):
            st.markdown(f"<div class='stat-num'>{ho*100:.1f}%</div>"
                        f"<div class='stat-lbl'>{home_name} overdue rate</div>"
                        f"<div class='stat-sub'>Peer median {med_overdue*100:.1f}% — lower is better</div>",
                        unsafe_allow_html=True)
    with c4:
        with st.container(border=True, key="wdtk_kpi4"):
            st.markdown(f"<div class='stat-num'>{hr} / {peer_count}</div>"
                        f"<div class='stat-lbl'>Disclosure-rate rank</div>"
                        f"<div class='stat-sub'>Among the {peer_count} peer authorities tracked</div>",
                        unsafe_allow_html=True)

st.caption(":material/info: Rates are as recorded on WhatDoTheyKnow — a citizen-facing sample of requests, "
           "not the authority's official annual statistics. Useful for relative comparison, not as an audited figure.")

st.divider()

# --- Peer comparison charts ---------------------------------------------------
b1, b2 = st.columns(2)
with b1:
    st.markdown("**Disclosure rate by authority**")
    st.caption("Share of classified requests where information was released (in full or part).")
    d = bench.sort_values("SUCCESS_RATE", ascending=True)
    colors = [BLUE if (home_row is not None and s == home_row["AUTHORITY_SLUG"]) else GREY
              for s in d["AUTHORITY_SLUG"]]
    fig = go.Figure(go.Bar(x=d["SUCCESS_RATE"] * 100, y=d["AUTHORITY_NAME"], orientation="h",
                           marker_color=colors, text=[f"{v*100:.0f}%" for v in d["SUCCESS_RATE"]],
                           textposition="outside", cliponaxis=False))
    fig.add_vline(x=med_success * 100, line_dash="dash", line_color="#101828",
                  annotation_text="peer median", annotation_position="top", annotation_font_size=11)
    fig.update_xaxes(title="disclosure rate (%)", range=[0, 108], gridcolor="#eef0f3")
    fig.update_yaxes(title=None)
    styled = _style(fig, 420, legend=False)
    styled.update_layout(margin=dict(l=10, r=10, t=34, b=10))
    st.plotly_chart(styled, use_container_width=True, config={"displayModeBar": False})

with b2:
    st.markdown("**Overdue rate by authority**")
    st.caption("Share of requests recorded as overdue on WhatDoTheyKnow — lower is better.")
    d2 = bench.sort_values("OVERDUE_RATE", ascending=False)
    colors2 = [RED if (home_row is not None and s == home_row["AUTHORITY_SLUG"]) else GREY
               for s in d2["AUTHORITY_SLUG"]]
    fig2 = go.Figure(go.Bar(x=d2["OVERDUE_RATE"] * 100, y=d2["AUTHORITY_NAME"], orientation="h",
                            marker_color=colors2, text=[f"{v*100:.1f}%" for v in d2["OVERDUE_RATE"]],
                            textposition="outside", cliponaxis=False))
    fig2.add_vline(x=med_overdue * 100, line_dash="dash", line_color="#101828",
                   annotation_text="peer median", annotation_position="top", annotation_font_size=11)
    _ov_max = float(d2["OVERDUE_RATE"].max()) * 100
    fig2.update_xaxes(title="overdue rate (%)", range=[0, _ov_max * 1.18], gridcolor="#eef0f3")
    fig2.update_yaxes(title=None)
    styled2 = _style(fig2, 420, legend=False)
    styled2.update_layout(margin=dict(l=10, r=10, t=34, b=10))
    st.plotly_chart(styled2, use_container_width=True, config={"displayModeBar": False})

st.divider()

# --- Exemption / theme mix ----------------------------------------------------
st.markdown("**What gets refused, and under which exemptions**")
st.caption("Across peer authorities, the outcome mix of recent responses pulled under each exemption theme. "
           "A useful prompt for where refusals tend to hold — and where disclosure is the norm.")
try:
    mix = session.sql(f"SELECT * FROM {SCHEMA}.V_WDTK_THEME_MIX").to_pandas()
except Exception:
    mix = pd.DataFrame()

if not mix.empty:
    mix["THEME_LABEL"] = mix["THEME"].map(THEME_LABELS).fillna(mix["THEME"])
    mix = mix.sort_values("EVENTS", ascending=True)
    fig3 = go.Figure()
    fig3.add_bar(y=mix["THEME_LABEL"], x=mix["DISCLOSED"], name="Disclosed (full/part)",
                 orientation="h", marker_color=GREEN)
    fig3.add_bar(y=mix["THEME_LABEL"], x=mix["REFUSED"], name="Refused", orientation="h", marker_color=RED)
    fig3.update_layout(barmode="stack")
    fig3.update_xaxes(title="responses", dtick=2, gridcolor="#eef0f3")
    fig3.update_yaxes(title=None)
    st.plotly_chart(_style(fig3, 320), use_container_width=True, config={"displayModeBar": False})

st.divider()

# --- GLA disclosure-log spotlight --------------------------------------------
st.markdown("**Spotlight: Greater London Authority full disclosure log**")
st.caption("Unlike the WhatDoTheyKnow sample, the GLA disclosure log is ingested in full from "
           "london.gov.uk — the complete request and response text for every published entry. It "
           "anchors the precedent corpus with a real, end-to-end authority record.")
try:
    gla = session.sql(f"""SELECT REGIME, THEME, TITLE, REFERENCE_NUMBER, RESPONSE_DATE, SOURCE_URL
                          FROM {SCHEMA}.GLA_DISCLOSURE_LOG""").to_pandas()
except Exception:
    gla = pd.DataFrame()

if gla.empty:
    st.caption("GLA disclosure log not loaded yet. Run the GLA scraper from Settings.")
else:
    foi_n = int((gla["REGIME"] == "FOI").sum())
    eir_n = int((gla["REGIME"] == "EIR").sum())
    dmin = pd.to_datetime(gla["RESPONSE_DATE"]).min()
    dmax = pd.to_datetime(gla["RESPONSE_DATE"]).max()
    g1, g2, g3 = st.columns(3)
    with g1:
        with st.container(border=True, key="gla_kpi1"):
            st.markdown(f"<div class='stat-num'>{len(gla)}</div>"
                        f"<div class='stat-lbl'>GLA entries on file</div>"
                        f"<div class='stat-sub'>Full request and response text</div>", unsafe_allow_html=True)
    with g2:
        with st.container(border=True, key="gla_kpi2"):
            st.markdown(f"<div class='stat-num'>{foi_n} / {eir_n}</div>"
                        f"<div class='stat-lbl'>FOI / EIR split</div>"
                        f"<div class='stat-sub'>By statutory regime</div>", unsafe_allow_html=True)
    with g3:
        rng = f"{dmin:%b %Y} – {dmax:%b %Y}" if pd.notna(dmin) and pd.notna(dmax) else "—"
        with st.container(border=True, key="gla_kpi3"):
            st.markdown(f"<div class='stat-num-sm'>{rng}</div>"
                        f"<div class='stat-lbl'>Coverage window</div>"
                        f"<div class='stat-sub'>Recent rolling window</div>", unsafe_allow_html=True)
    st.markdown("Most recent GLA responses")
    recent = gla.sort_values("RESPONSE_DATE", ascending=False).head(5)
    for _, g in recent.iterrows():
        date = str(g["RESPONSE_DATE"] or "")[:10]
        url = g["SOURCE_URL"] or ""
        title = g["TITLE"] or "(untitled)"
        head = f"[{title}]({url})" if url else title
        st.markdown(f"- {head}  \n  <span style='color:#7a828a;font-size:0.85em'>{g['REGIME']} · "
                    f"{g['REFERENCE_NUMBER'] or ''} · {date}</span>", unsafe_allow_html=True)

st.divider()

# --- Cross-authority precedent search ----------------------------------------
st.markdown("**Cross-authority precedent search**")
st.caption("Search how other UK authorities have handled comparable requests, grounded in real responses "
           "published on WhatDoTheyKnow. Use it to sense-check an exemption or borrow defensible wording.")


def _esc(t):
    return (t or "").replace("'", "''").replace("\\", "\\\\")


pq = st.text_input("Search precedent", value=st.session_state.get("wdtk_q", ""),
                   placeholder="e.g. section 12 cost limit for staff data, or commercial interests in a contract")
if pq:
    st.session_state["wdtk_q"] = pq
    try:
        cols = ["AUTHORITY_NAME", "OUTCOME", "THEME", "LAW_USED", "REQUEST_TITLE", "REQUEST_URL", "SNIPPET"]
        res = session.sql(f"""
            SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
                '{SCHEMA}.WDTK_PRECEDENT_SEARCH',
                '{{"query": "{_esc(pq)}", "columns": {json.dumps(cols)}, "limit": 6}}')):results AS R
        """).to_pandas()
        hits = json.loads(res.iloc[0]["R"]) if not res.empty and res.iloc[0]["R"] else []
    except Exception as e:
        hits = []
        st.caption(f"Precedent search unavailable: {e}")

    if not hits:
        st.info("No matching precedent found. Try broader wording or a different exemption.")
    for h in hits:
        outcome = h.get("OUTCOME", "")
        badge = {"Refused": "🔴", "Information not held": "⚪", "Successful": "🟢",
                 "Partially successful": "🟡"}.get(outcome, "🔵")
        with st.container(border=True):
            st.markdown(f"**{h.get('REQUEST_TITLE','(untitled request)')}**  \n"
                        f"{badge} {outcome} · {h.get('AUTHORITY_NAME','')} · "
                        f"{THEME_LABELS.get(h.get('THEME',''), h.get('THEME',''))} · "
                        f"{(h.get('LAW_USED') or '').upper()}")
            st.caption(h.get("SNIPPET", ""))
            url = h.get("REQUEST_URL")
            if url:
                st.markdown(f"[View the full request on WhatDoTheyKnow]({url})")

    # Also surface GLA full-response precedents for the same query
    try:
        gcols = ["REFERENCE_NUMBER", "TITLE", "REGIME", "RESPONSE_TEXT", "RESPONSE_DATE", "SOURCE_URL"]
        gres = session.sql(f"""
            SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
                '{SCHEMA}.GLA_DISCLOSURE_SEARCH',
                '{{"query": "{_esc(pq)}", "columns": {json.dumps(gcols)}, "limit": 3}}')):results AS R
        """).to_pandas()
        ghits = json.loads(gres.iloc[0]["R"]) if not gres.empty and gres.iloc[0]["R"] else []
    except Exception:
        ghits = []
    for h in ghits:
        with st.container(border=True):
            url = h.get("SOURCE_URL")
            title = h.get("TITLE", "(untitled)")
            head = f"[{title}]({url})" if url else title
            st.markdown(f"**{head}**  \n🟢 GLA full response · {h.get('REGIME','')} · "
                        f"{h.get('REFERENCE_NUMBER','')} · {str(h.get('RESPONSE_DATE') or '')[:10]}")
            st.caption((h.get("RESPONSE_TEXT") or "")[:240])

# --- Attribution / caveats ----------------------------------------------------
st.divider()
try:
    pulled = session.sql(f"SELECT MAX(LOADED_AT)::DATE D FROM {SCHEMA}.WDTK_EVENT").to_pandas().iloc[0]["D"]
except Exception:
    pulled = None
st.caption(
    f":material/database: Source: requests published on **WhatDoTheyKnow** (mySociety), covering {peer_count} peer authorities"
    + (f", loaded {pulled}. " if pulled else ". ")
    + "Reused under the Re-use of Public Sector Information Regulations 2015; responses link back to the original request. "
    "Published responses can contain personal data — treat snippets as reference material for officers, not onward disclosure."
)
