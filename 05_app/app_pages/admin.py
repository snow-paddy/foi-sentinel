"""Admin & Config — council-agnostic settings and reference libraries."""
import streamlit as st
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA

st.title(":material/settings: Admin & Configuration")
st.caption("Configure the authority. These settings make the app council-agnostic — change them when deploying to a different authority.")

cfg = session.sql(f"SELECT CONFIG_KEY, CONFIG_VALUE, DESCRIPTION FROM {SCHEMA}.COUNCIL_CONFIG ORDER BY CONFIG_KEY").to_pandas()
CFG = {r["CONFIG_KEY"]: {"value": r["CONFIG_VALUE"], "desc": r["DESCRIPTION"]} for _, r in cfg.iterrows()}

# Friendly label / group / input-type map. Any key not listed still renders generically (council-agnostic safety).
FIELD_MAP = {
    "COUNCIL_NAME":          {"group": "Authority identity", "label": "Authority name", "kind": "text"},
    "AUTHORITY_TYPE":        {"group": "Authority identity", "label": "Authority type", "kind": "select",
                              "options": ["LOCAL_AUTHORITY", "CENTRAL_GOV"]},
    "COST_LIMIT_GBP":        {"group": "Cost limits — Fees Regulations 2004", "label": "Appropriate cost limit", "kind": "int", "unit": "£"},
    "COST_LIMIT_HOURS":      {"group": "Cost limits — Fees Regulations 2004", "label": "Equivalent staff time", "kind": "int", "unit": "hours"},
    "COST_RATE_PER_HOUR":    {"group": "Cost limits — Fees Regulations 2004", "label": "Statutory rate", "kind": "int", "unit": "£ / hour"},
    "STANDARD_DEADLINE_WD":  {"group": "Statutory deadlines", "label": "Standard deadline", "kind": "int", "unit": "working days"},
    "EXTENDED_DEADLINE_WD":  {"group": "Statutory deadlines", "label": "Extended deadline (complex / public-interest / EIR)", "kind": "int", "unit": "working days"},
    "SLA_TARGET_PCT":        {"group": "Performance & automation", "label": "Performance target", "kind": "int", "unit": "% answered in 20 working days"},
    "AUTO_ACCEPT_THRESHOLD": {"group": "Performance & automation", "label": "AI auto-accept confidence", "kind": "decimal",
                              "unit": "0–1 (below this, triage routes to a human)"},
}
GROUP_ORDER = ["Authority identity", "Cost limits — Fees Regulations 2004", "Statutory deadlines", "Performance & automation"]

# --- Summary band (read-only, at a glance) -----------------------------------
_name = CFG.get("COUNCIL_NAME", {}).get("value", "—")
_type = CFG.get("AUTHORITY_TYPE", {}).get("value", "—").replace("_", " ").title()
_cl = CFG.get("COST_LIMIT_GBP", {}).get("value", "—")
_sla = CFG.get("SLA_TARGET_PCT", {}).get("value", "—")
st.markdown(
    f"""<div class="stat-band">
      <div class="stat-card"><div class="stat-num-sm">{_name}</div><div class="stat-lbl">Authority</div></div>
      <div class="stat-card"><div class="stat-num-sm">{_type}</div><div class="stat-lbl">Type</div></div>
      <div class="stat-card"><div class="stat-num-sm">£{_cl}</div><div class="stat-lbl">Cost limit</div></div>
      <div class="stat-card closed"><div class="stat-num-sm">{_sla}%</div><div class="stat-lbl">Performance target</div></div>
    </div>""", unsafe_allow_html=True)

st.subheader(":material/account_balance: Authority settings")
st.caption("These settings make the app council-agnostic — change them when deploying to a different authority.")

with st.form("cfg"):
    new_vals = {}
    grouped = {g: [k for k, m in FIELD_MAP.items() if m["group"] == g and k in CFG] for g in GROUP_ORDER}
    for group in GROUP_ORDER:
        keys = grouped.get(group, [])
        if not keys:
            continue
        st.markdown(f"###### {group}")
        with st.container(border=True):
            cols = st.columns(min(len(keys), 3))
            for i, k in enumerate(keys):
                m = FIELD_MAP[k]
                cur = CFG[k]["value"]
                lbl = m["label"] + (f"  ({m['unit']})" if m.get("unit") else "")
                help_txt = CFG[k]["desc"]
                col = cols[i % len(cols)]
                with col:
                    if m["kind"] == "select":
                        opts = m["options"]
                        idx = opts.index(cur) if cur in opts else 0
                        new_vals[k] = st.selectbox(lbl, opts, index=idx, help=help_txt)
                    elif m["kind"] == "int":
                        try:
                            v0 = int(float(cur))
                        except (TypeError, ValueError):
                            v0 = 0
                        new_vals[k] = st.number_input(lbl, min_value=0, value=v0, step=1, help=help_txt)
                    elif m["kind"] == "decimal":
                        try:
                            v0 = float(cur)
                        except (TypeError, ValueError):
                            v0 = 0.0
                        new_vals[k] = st.number_input(lbl, min_value=0.0, max_value=1.0, value=v0, step=0.01,
                                                      format="%.2f", help=help_txt)
                    else:
                        new_vals[k] = st.text_input(lbl, cur, help=help_txt)
    # Any config key not in the map still renders generically (council-agnostic safety).
    extras = [k for k in CFG if k not in FIELD_MAP]
    if extras:
        st.markdown("###### Other settings")
        with st.container(border=True):
            for k in extras:
                new_vals[k] = st.text_input(k, CFG[k]["value"], help=CFG[k]["desc"])

    if st.form_submit_button(":material/save: Save settings", type="primary"):
        for k, v in new_vals.items():
            kind = FIELD_MAP.get(k, {}).get("kind", "text")
            if kind == "int":
                sval = str(int(v))                 # store as a plain integer string
            elif kind == "decimal":
                sval = f"{float(v):.2f}"            # preserve 2-decimal form (e.g. 0.90)
            else:
                sval = str(v)
            sval = sval.replace("'", "''")
            session.sql(f"UPDATE {SCHEMA}.COUNCIL_CONFIG SET CONFIG_VALUE='{sval}' WHERE CONFIG_KEY='{k}'").collect()
        st.cache_data.clear()
        st.success("Settings saved. Cost limits, deadlines and the performance target update across the app.")

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
