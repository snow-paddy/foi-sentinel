"""Admin & Config — council-agnostic settings and reference libraries."""
import streamlit as st
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA

st.title(":material/settings: Admin & Configuration")
st.caption("Configure the authority. These settings make the app council-agnostic — change them when deploying to a different authority.")

cfg = session.sql(f"SELECT CONFIG_KEY, CONFIG_VALUE, DESCRIPTION FROM {SCHEMA}.COUNCIL_CONFIG ORDER BY CONFIG_KEY").to_pandas()

st.subheader(":material/account_balance: Authority settings")
with st.form("cfg"):
    new_vals = {}
    for _, r in cfg.iterrows():
        new_vals[r["CONFIG_KEY"]] = st.text_input(f"{r['CONFIG_KEY']}", r["CONFIG_VALUE"], help=r["DESCRIPTION"])
    if st.form_submit_button(":material/save: Save settings", type="primary"):
        for k, v in new_vals.items():
            session.sql(f"UPDATE {SCHEMA}.COUNCIL_CONFIG SET CONFIG_VALUE='{str(v).replace(chr(39),chr(39)*2)}' WHERE CONFIG_KEY='{k}'").collect()
        st.cache_data.clear()
        st.success("Settings saved. Cost limits and SLA targets update across the app.")

st.info("**Authority type** drives the cost limit: LOCAL_AUTHORITY = £450 / 18h, CENTRAL_GOV = £600 / 24h "
        "(Fees Regs 2004 reg.3). EIR requests are never subject to a cost limit.")

st.divider()
st.subheader(":material/groups: Departments in use")
dept = session.sql(f"SELECT DISTINCT OWNING_DEPARTMENT AS DEPARTMENT FROM {SCHEMA}.FOI_CASE WHERE OWNING_DEPARTMENT IS NOT NULL ORDER BY 1").to_pandas()
st.dataframe(dept, hide_index=True, use_container_width=True)

st.divider()
st.subheader(":material/list_alt: Lifecycle stages")
stages = session.sql(f"SELECT STAGE_ORDER, STAGE_NAME, LEGAL_BASIS, AI_ASSISTED, HUMAN_GATED, DESCRIPTION FROM {SCHEMA}.LIFECYCLE_STAGE ORDER BY STAGE_ORDER").to_pandas()
st.dataframe(stages, hide_index=True, use_container_width=True,
             column_config={"STAGE_ORDER": "#", "STAGE_NAME": "Stage", "LEGAL_BASIS": "Legal basis",
                            "AI_ASSISTED": "AI", "HUMAN_GATED": "Human gate", "DESCRIPTION": "Description"})

st.divider()
st.subheader(":material/event: UK bank holidays (deadline calculation)")
st.caption("Working-day deadlines exclude weekends and these bank holidays. Refresh annually from gov.uk/bank-holidays.")
bh = session.sql(f"SELECT HOLIDAY_DATE, HOLIDAY_NAME FROM {SCHEMA}.UK_BANK_HOLIDAYS WHERE HOLIDAY_DATE >= DATEADD('year',-1,CURRENT_DATE()) ORDER BY HOLIDAY_DATE").to_pandas()
st.dataframe(bh, hide_index=True, use_container_width=True)

st.divider()
st.subheader(":material/database: Sector data sources")
st.caption("External FOI corpora that ground drafting, exemption and review decisions. "
           "See docs/DATA_SOURCES.md for full provenance. All ingestion stays inside this account.")

# --- GLA disclosure log (server-side scraper, on demand) ---
with st.container(border=True):
    st.markdown("**Greater London Authority disclosure log** — full request and response text, "
                "scraped server-side from london.gov.uk.")
    try:
        g = session.sql(f"SELECT COUNT(*) N, MAX(SCRAPED_AT) LAST FROM {SCHEMA}.GLA_DISCLOSURE_LOG").to_pandas().iloc[0]
        st.caption(f"On file: **{int(g['N'])}** entries · last refreshed {g['LAST']}")
    except Exception:
        st.caption("Not yet loaded.")
    cga, cgb, cgc = st.columns([1, 1, 1.4])
    pages = cga.number_input("Listing pages", min_value=1, max_value=20, value=3, key="gla_pages")
    months = cgb.number_input("Months back", min_value=1, max_value=36, value=12, key="gla_months")
    if cgc.button(":material/refresh: Refresh GLA disclosure log", type="primary", key="gla_refresh"):
        with st.spinner("Scraping london.gov.uk (server-side, polite)..."):
            try:
                msg = session.sql(f"CALL {SCHEMA}.SP_SCRAPE_GLA_DISCLOSURE_LOG({int(pages)}, {int(months)})").to_pandas().iloc[0, 0]
                st.success(msg)
            except Exception as e:
                st.error(f"Scrape failed: {e}")
        st.rerun()

# --- WhatDoTheyKnow (browser-mediated) ---
with st.container(border=True):
    st.markdown("**WhatDoTheyKnow (mySociety)** — cross-authority precedents and peer benchmarks.")
    try:
        w = session.sql(f"SELECT COUNT(*) N FROM {SCHEMA}.WDTK_EVENT").to_pandas().iloc[0]["N"]
        a = session.sql(f"SELECT COUNT(*) N FROM {SCHEMA}.WDTK_AUTHORITY").to_pandas().iloc[0]["N"]
        st.caption(f"On file: **{int(w)}** precedents across **{int(a)}** authorities.")
    except Exception:
        st.caption("Not yet loaded.")
    st.info(":material/info: The WhatDoTheyKnow read API is behind provider bot-protection "
            "(Cloudflare) and is **not callable from Snowflake egress** (confirmed by the egress "
            "spike). Data is refreshed via an operator-initiated browser pull, then loaded — it is "
            "never fetched live by the app.")

# --- ICO outcome benchmarks (cited statistics) ---
with st.container(border=True):
    st.markdown("**ICO / Cabinet Office outcome benchmarks** — escalation-risk and review grounding.")
    st.caption("Row-level ICO decision notices are not server-side ingestable (Funnelback search "
               "host returns 403). Escalation-risk uses the accredited published statistics "
               "(Cabinet Office FOI statistics annual 2025) held in ICO_OUTCOME_BENCHMARK / "
               "ICO_EXEMPTION_PROFILE — static, cited reference data.")
