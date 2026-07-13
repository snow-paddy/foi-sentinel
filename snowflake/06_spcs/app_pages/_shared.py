"""Shared helpers, styling and data access for FOI Sentinel v2.
SiS-safe: theme-aware CSS (no hardcoded body colours that fight the theme),
modern product UI — soft cards, rounded controls, refined accent palette.
"""
import json
import streamlit as st

SCHEMA = "FOI.FOI_SENTINEL_V2"

# --- Design tokens -----------------------------------------------------------
# Accent #2457d6 · success #1f8a4c · warning #c2660a · danger #c0392b
# Surfaces: canvas #f7f8fa · card #ffffff · hairline #e7eaee
# Text #101828 · muted #667085
GOVUK_CSS = """
<style>
:root {
  --accent:#2457d6; --accent-dark:#1b44a8; --accent-soft:#eef2fd;
  --ok:#1f8a4c; --warn:#c2660a; --danger:#c0392b;
  --ink:#101828; --muted:#667085; --hairline:#e7eaee;
  --canvas:#f7f8fa; --card:#ffffff;
  --shadow:0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.10);
  --shadow-lg:0 8px 24px rgba(16,24,40,.10), 0 2px 6px rgba(16,24,40,.06);
  --radius:12px;
}

/* Canvas + container */
.stApp, [data-testid="stMain"], [data-testid="stAppViewContainer"] { background-color:var(--canvas) !important; }
[data-testid="stMain"] .block-container { padding-top:1rem; max-width:1200px; }

/* Collapse Streamlit's default top header band (empty white strip) — reclaim vertical space */
[data-testid="stHeader"] { background:transparent !important; height:0 !important; min-height:0 !important; }
[data-testid="stDecoration"] { display:none !important; }
[data-testid="stToolbar"] { right:0.5rem; top:0.25rem; }

/* Typography — softer than the old all-bold-uppercase gov look */
[data-testid="stMarkdownContainer"], [data-testid="stMarkdownContainer"] p, [data-testid="stMarkdownContainer"] li { color:var(--ink); }
h1, h2, h3, h4 { color:var(--ink) !important; font-weight:650 !important; letter-spacing:-0.01em; }
[data-testid="stCaptionContainer"], [data-testid="stCaptionContainer"] p { color:var(--muted) !important; }

/* App header — clean elevated bar (replaces the black crown gov bar) */
.app-header { background:var(--card); border:1px solid var(--hairline); box-shadow:var(--shadow);
    padding:16px 22px; margin:-0.4rem 0 1.25rem; border-radius:var(--radius); position:relative; overflow:hidden;
    display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.app-header::before { content:""; position:absolute; left:0; top:0; bottom:0; width:5px; background:var(--accent); }
.app-header__logo { color:var(--ink); font-weight:750; font-size:1.4rem; letter-spacing:-0.02em; display:flex; align-items:center; gap:10px; }
.app-header__mark { background:var(--accent); color:#fff; padding:3px 10px; border-radius:8px; font-size:1.05rem; font-weight:800; letter-spacing:0.01em; }
.app-header__service { color:var(--muted); font-size:0.95rem; }

/* Buttons — rounded, soft, with a gentle hover lift (no hard offset shadows) */
[data-testid="stButton"] button, [data-testid="stDownloadButton"] button, [data-testid="stFormSubmitButton"] button {
    border-radius:10px !important; font-weight:600 !important; padding:0.5rem 1.0rem !important;
    transition:transform .08s ease, box-shadow .12s ease, background-color .12s ease !important; }
[data-testid="stButton"] button[kind="primary"], [data-testid="stDownloadButton"] button[kind="primary"], [data-testid="stFormSubmitButton"] button[kind="primary"] {
    background-color:var(--accent) !important; border:1px solid var(--accent) !important; color:#fff !important; box-shadow:var(--shadow) !important; }
[data-testid="stButton"] button[kind="primary"]:hover, [data-testid="stDownloadButton"] button[kind="primary"]:hover, [data-testid="stFormSubmitButton"] button[kind="primary"]:hover {
    background-color:var(--accent-dark) !important; transform:translateY(-1px); box-shadow:var(--shadow-lg) !important; }
[data-testid="stButton"] button[kind="secondary"], [data-testid="stDownloadButton"] button[kind="secondary"] {
    background-color:var(--card) !important; border:1px solid #d0d5dd !important; color:#344054 !important; box-shadow:var(--shadow) !important; }
[data-testid="stButton"] button[kind="secondary"]:hover, [data-testid="stDownloadButton"] button[kind="secondary"]:hover {
    background-color:#f9fafb !important; border-color:#b7bec9 !important; transform:translateY(-1px); }
/* Opt-in danger button (add a leading 🗑/Stop label handled per-page via help) */
.danger-btn [data-testid="stButton"] button { background-color:#fff !important; border:1px solid #e6b3ad !important; color:var(--danger) !important; }
.danger-btn [data-testid="stButton"] button:hover { background-color:#fdf3f2 !important; border-color:var(--danger) !important; }
.warn-btn [data-testid="stButton"] button { background-color:#fff !important; border:1px solid #eccb9c !important; color:var(--warn) !important; }
.warn-btn [data-testid="stButton"] button:hover { background-color:#fdf6ed !important; border-color:var(--warn) !important; }

/* Links + focus */
a { color:var(--accent) !important; } a:hover { color:var(--accent-dark) !important; }
*:focus-visible { outline:2px solid var(--accent) !important; outline-offset:2px !important; border-radius:6px; }

/* Inputs — softer, rounded */
[data-testid="stTextInput"] input, [data-testid="stTextArea"] textarea, [data-testid="stNumberInput"] input,
div[data-baseweb="select"] > div { border-radius:10px !important; }

/* Metric tiles → soft cards with a slim accent rule */
[data-testid="stMetric"] { background:var(--card); border:1px solid var(--hairline); border-left:4px solid var(--accent);
    border-radius:var(--radius); padding:14px 16px; box-shadow:var(--shadow); }
[data-testid="stMetricValue"] { color:var(--ink) !important; }

/* Expanders / bordered containers → rounded panels */
[data-testid="stExpander"], div[data-testid="stVerticalBlockBorderWrapper"] { border-radius:var(--radius) !important; }
[data-testid="stExpander"] { border:1px solid var(--hairline) !important; box-shadow:var(--shadow); }

/* Tabs — pill-ish active state */
[data-baseweb="tab-list"] { gap:4px; }
[data-baseweb="tab"] { border-radius:8px 8px 0 0; }

/* Badges */
.stBadge span { font-weight:650; letter-spacing:0.01em; border-radius:999px !important; }

/* Sidebar */
[data-testid="stSidebar"] { background-color:var(--card) !important; border-right:1px solid var(--hairline); }
[data-testid="stSidebar"] * { color:var(--ink); }

/* Sidebar notifications */
.notif-head { font-weight:650; color:var(--ink); margin:2px 0 8px; font-size:0.95rem; }
.notif-card { background:var(--card); border:1px solid var(--hairline); border-radius:12px; overflow:hidden; box-shadow:var(--shadow); }
.notif-row { display:flex; align-items:center; justify-content:space-between; padding:9px 13px; border-bottom:1px solid #f0f1f3; }
.notif-row:last-child { border-bottom:none; }
.notif-label { color:var(--ink); font-size:0.85rem; }
.notif-pill { min-width:24px; height:22px; line-height:22px; padding:0 9px; border-radius:999px; color:#fff;
    font-weight:700; font-size:0.78rem; text-align:center; display:inline-block; }
.notif-pill.red { background:var(--danger); } .notif-pill.amber { background:var(--warn); }
.notif-pill.blue { background:var(--accent); } .notif-pill.ok { background:var(--ok); }

/* Headline stat band */
.stat-band { display:flex; gap:14px; flex-wrap:wrap; margin:6px 0 4px; }
.stat-card { background:var(--card); border:1px solid var(--hairline); border-radius:var(--radius);
    padding:16px 20px; flex:1; min-width:210px; box-shadow:var(--shadow); position:relative; }
.stat-card::before { content:""; position:absolute; left:0; top:14px; bottom:14px; width:4px; border-radius:4px; background:var(--accent); }
.stat-card.closed::before { background:var(--ok); }
.stat-num { font-size:2.5rem; font-weight:750; color:var(--ink); line-height:1; }
.stat-num-sm { font-size:1.55rem; font-weight:750; color:var(--ink); line-height:1.15; }
.stat-lbl { font-size:0.8rem; color:var(--muted); font-weight:600; letter-spacing:0.02em; margin-top:3px; }
.stat-sub { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
.stat-chip { font-size:0.78rem; font-weight:650; padding:4px 11px; border-radius:999px; color:#fff; }
.stat-chip.red { background:var(--danger); } .stat-chip.amber { background:var(--warn); }
.stat-chip.green { background:var(--ok); } .stat-chip.grey { background:#7a828a; }
.stat-chip.click { cursor:pointer; }

/* Target / statutory reference strip — deliberately flatter + cooler than live metric cards */
.target-ref { border:1px solid #dfe6f6; background:var(--accent-soft); border-radius:var(--radius);
    padding:14px 16px 16px; margin:10px 0 4px; }
.target-ref__head { display:flex; align-items:center; gap:9px; margin-bottom:12px; flex-wrap:wrap; }
.target-ref__tag { font-size:0.62rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;
    color:var(--accent-dark); background:#fff; border:1px solid #cdd9f7; padding:2px 9px; border-radius:999px; }
.target-ref__title { font-size:0.86rem; font-weight:650; color:var(--ink); }
.target-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; }
@media (max-width: 760px){ .target-grid { grid-template-columns:repeat(2, 1fr); } }
.target-cell { background:#fff; border:1px solid #e3e9f7; border-radius:10px; padding:11px 13px; }
.target-cell .d { font-size:1.5rem; font-weight:750; color:var(--accent); line-height:1.05; }
.target-cell .t { font-size:0.82rem; color:var(--ink); font-weight:600; margin-top:2px; }
.target-cell .s { font-size:0.76rem; color:var(--muted); margin-top:3px; line-height:1.35; }

/* Precedent cards (Camden / disclosure-log similar responses) */
.precedent { background:var(--card); border:1px solid var(--hairline); border-left:4px solid var(--accent);
    border-radius:10px; padding:11px 14px; margin:8px 0; box-shadow:var(--shadow); }
.precedent .p-title { font-weight:650; color:var(--ink); font-size:0.9rem; }
.precedent .p-meta { color:var(--muted); font-size:0.78rem; margin:2px 0 6px; }
.precedent .p-snip { color:#344054; font-size:0.84rem; line-height:1.4; }

.theme-note { color:var(--muted); font-size:0.85rem; }

/* Live metric (reported) KPI cards — the keyed element IS the whole card frame.
   No border=True (which draws a second, mismatched inner frame); all chrome lives
   on .st-key-kpi_* so the accent rule spans the full height and the marker sits inside. */
.st-key-kpi_open, .st-key-kpi_closed, .st-key-kpi_type {
    background:var(--card) !important; border:1px solid var(--hairline) !important;
    border-radius:var(--radius) !important; box-shadow:var(--shadow) !important;
    padding:16px 18px !important; min-height:150px !important; }
.st-key-kpi_open, .st-key-kpi_type { border-left:4px solid var(--accent) !important; }
.st-key-kpi_closed { border-left:4px solid var(--ok) !important; }
.st-key-gla_kpi1, .st-key-gla_kpi2, .st-key-gla_kpi3 {
    border-radius:var(--radius) !important; box-shadow:var(--shadow) !important; min-height:110px !important; }
/* "Live" eyebrow above each metric, target marker + note inside */
.kpi-eyebrow { display:inline-flex; align-items:center; gap:6px; font-size:0.62rem; font-weight:800;
    letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); margin-bottom:7px; }
.kpi-eyebrow::before { content:""; width:6px; height:6px; border-radius:50%; background:#9aa3ad; display:inline-block; }
.kpi-target { margin-top:9px; font-size:0.74rem; color:var(--muted); font-weight:600;
    display:flex; align-items:center; gap:5px; }
.kpi-note { margin-top:10px; font-size:0.76rem; color:var(--muted); line-height:1.35; }
/* Drill-down chips — full-width within their column, legible, never truncated */
.stApp .st-key-chip_atrisk button, .stApp .st-key-chip_overdue button,
.stApp .st-key-chip_intime button, .stApp .st-key-chip_total button {
    color:#fff !important; border:none !important; border-radius:999px !important;
    padding:6px 14px !important; font-size:0.8rem !important; font-weight:700 !important;
    box-shadow:none !important; min-height:34px !important; line-height:1.2 !important; }
.stApp .st-key-chip_atrisk button p, .stApp .st-key-chip_overdue button p,
.stApp .st-key-chip_intime button p, .stApp .st-key-chip_total button p { color:#fff !important; }
.stApp .st-key-chip_atrisk button { background:var(--danger) !important; }
.stApp .st-key-chip_atrisk button:hover { background:#a93226 !important; transform:translateY(-1px); }
.stApp .st-key-chip_overdue button { background:var(--warn) !important; }
.stApp .st-key-chip_overdue button:hover { background:#a4560a !important; transform:translateY(-1px); }
.stApp .st-key-chip_intime button { background:var(--ok) !important; }
.stApp .st-key-chip_intime button:hover { background:#176b3a !important; transform:translateY(-1px); }
.stApp .st-key-chip_total button { background:#7a828a !important; }
.stApp .st-key-chip_total button:hover { background:#5f666d !important; transform:translateY(-1px); }

/* Global floating AI assistant — pinned bottom-right on every page */
.st-key-ai_fab { position:fixed; bottom:22px; right:22px; z-index:1000; width:auto !important; }
.st-key-ai_fab > div { width:auto !important; }
.st-key-ai_fab [data-testid="stPopover"] > button {
    background:var(--accent) !important; color:#fff !important; border:none !important;
    border-radius:999px !important; box-shadow:var(--shadow-lg) !important;
    padding:10px 18px !important; font-weight:700 !important; }
.st-key-ai_fab [data-testid="stPopover"] > button:hover { background:var(--accent-dark) !important; transform:translateY(-1px); }

/* Synthetic-data badge */
.syn-badge { display:inline-block; background:#f3effe; color:#6f4bd8; border:1px solid #ddd0fb;
    font-size:0.66rem; font-weight:700; letter-spacing:0.03em; text-transform:uppercase;
    padding:1px 7px; border-radius:999px; vertical-align:middle; }
</style>
"""

STAGE_ORDER = [
    "RECEIPT", "VALIDITY", "CLASSIFY", "SAR_REDIRECT", "DUPLICATE", "CLARIFICATION",
    "ALLOCATION", "SEARCH", "COST", "EXEMPTIONS", "PIT", "REDACTION",
    "DRAFTING", "QA", "DISPATCH", "PUBLISH", "REVIEW",
]


def get_session():
    return st.session_state.session


def inject_css():
    st.markdown(GOVUK_CSS, unsafe_allow_html=True)


def _esc(text):
    """Escape single quotes for safe inlining into a SEARCH_PREVIEW JSON string."""
    return str(text).replace("\\", "\\\\").replace("'", "''").replace('"', '\\"')


def cortex_search(service, query, columns, limit=4):
    """Run a Cortex Search query and return a list of result dicts.
    Shared so any page can retrieve precedents from CAMDEN_FOI_SEARCH,
    DISCLOSURE_SEARCH or COUNCIL_POLICY_SEARCH with one helper.
    """
    try:
        s = get_session()
        q = _esc(query.replace("\n", " "))[:1500]
        df = s.sql(f"""
            SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
                '{SCHEMA}.{service}',
                '{{"query": "{q}", "columns": {json.dumps(columns)}, "limit": {limit}}}')):results AS R
        """).to_pandas()
        if not df.empty and df.iloc[0]["R"]:
            return json.loads(df.iloc[0]["R"])
    except Exception as e:
        st.caption(f"Precedent search unavailable: {e}")
    return []


@st.cache_data(ttl=600, show_spinner=False)
def get_config():
    s = get_session()
    rows = s.sql(f"SELECT CONFIG_KEY, CONFIG_VALUE FROM {SCHEMA}.COUNCIL_CONFIG").to_pandas()
    return {r["CONFIG_KEY"]: r["CONFIG_VALUE"] for _, r in rows.iterrows()}


def council_name():
    return get_config().get("COUNCIL_NAME", "the Council")


def rag_badge(rag, wd):
    if rag == "CLOSED":
        return ":grey-badge[Closed]"
    if rag == "PAUSED":
        return ":violet-badge[Clock paused]"
    if wd is None:
        return ":grey-badge[No deadline]"
    if wd < 0:
        return f":red-badge[{abs(int(wd))}d OVERDUE]"
    label = f"{int(wd)}d left"
    if rag == "RED":
        return f":red-badge[{label}]"
    if rag == "AMBER":
        return f":orange-badge[{label}]"
    return f":green-badge[{label}]"


def regime_badge(regime):
    colours = {"FOI": "blue", "EIR": "green", "SAR": "violet", "BAU": "grey"}
    return f":{colours.get(regime, 'grey')}-badge[{regime}]"


def sentiment_badge(score):
    if score is None:
        return ":grey-badge[n/a]"
    if score < -0.3:
        return f":red-badge[Negative {score:.2f}]"
    if score > 0.3:
        return f":green-badge[Positive {score:.2f}]"
    return f":blue-badge[Neutral {score:.2f}]"


def stage_label(session, code):
    df = session.sql(f"SELECT STAGE_NAME FROM {SCHEMA}.LIFECYCLE_STAGE WHERE STAGE_CODE = '{code}'").to_pandas()
    return df.iloc[0]["STAGE_NAME"] if not df.empty else code


def govuk_header():
    """Render the FOI Sentinel app header (call once in the entry script)."""
    st.markdown(
        f"""
        <div class="app-header">
          <span class="app-header__logo"><span class="app-header__mark">FOI</span>Sentinel</span>
          <span class="app-header__service">{council_name()} &middot; Freedom of Information case management</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


# --- Global AI assistant widget ------------------------------------------------
_PAGE_HINTS = {
    "Command Centre": "the headline dashboard — open and closed counts, at-risk and overdue requests, SLA performance against target, and demand themes.",
    "Cases": "the lifecycle board and full case detail — drag a card to advance its stage, open a case to draft a response, apply exemptions and redactions.",
    "Reviews & ICO": "internal reviews and Information Commissioner complaints — outcome letters and ICO submission packs.",
    "Knowledge & Guidance": "search across council and regulator guidance, the legislation library and past disclosures.",
    "Email Intake (demo)": "simulated inbound FOI email intake and AI triage.",
    "Escalations (demo)": "simulated internal-review and ICO escalation test data.",
    "Triage Learning": "the fine-tuned triage model and how it is evaluated.",
    "Settings": "council-agnostic configuration — cost limits, SLA targets, departments, lifecycle stages and bank holidays.",
    "About & Architecture": "the system architecture and data/integration overview.",
}


def _assistant_answer(question):
    """Answer a question grounded in guidance, aware of the live caseload and the current page."""
    s = get_session()
    page = st.session_state.get("current_page", "the application")
    hint = _PAGE_HINTS.get(page, "")
    try:
        c = get_alert_counts()
        case_ctx = (f"Live caseload right now: {c['BOARD']} open requests, {c['ATRISK']} at risk, "
                    f"{c['OVERDUE']} overdue, {c['INTAKE']} awaiting triage, {c['STUDIO']} in drafting or QA, "
                    f"{c['REVIEW']} in internal review.")
    except Exception:
        case_ctx = ""
    ctx = cortex_search("COUNCIL_POLICY_SEARCH", question[:300], ["DOC_TITLE", "CONTENT"], limit=3)
    ctx_txt = "\n".join(f"- {p.get('DOC_TITLE','')}: {(p.get('CONTENT','') or '')[:300]}" for p in ctx) or "No specific guidance matched."
    prompt = ("You are the FOI Sentinel assistant, an expert UK local-government Freedom of Information officer. "
              "Answer the colleague's question concisely and practically in UK English. Where relevant, identify the "
              "regime (Freedom of Information / Environmental Information / Subject Access), key considerations, likely "
              "exemptions and a recommended approach. Do not invent figures or case references. "
              f"The user is currently on the {page} page, which shows {hint} {case_ctx} "
              f"COUNCIL AND REGULATOR GUIDANCE:\n{ctx_txt}\n\nQUESTION: {question}")
    esc = prompt.replace("\\", "\\\\").replace("'", "''")
    return s.sql(f"SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '{esc}') R").to_pandas().iloc[0]["R"]


def ai_assistant_widget():
    """Render the global floating assistant. Call once per run, before page content."""
    st.session_state.setdefault("assistant_msgs", [])
    with st.container(key="ai_fab"):
        with st.popover(":material/smart_toy: Assistant"):
            st.markdown("**FOI Sentinel assistant**")
            st.caption("Grounded in council and regulator guidance — aware of your live caseload and the page you are on.")
            for m in st.session_state["assistant_msgs"][-8:]:
                with st.chat_message(m["role"]):
                    st.markdown(m["content"])
            with st.form("assistant_form", clear_on_submit=True, border=False):
                q = st.text_area("Question", height=80, label_visibility="collapsed",
                                 placeholder="Ask about a request, an exemption, a deadline…")
                sent = st.form_submit_button(":material/send: Ask", type="primary", use_container_width=True)
            if sent and q and q.strip():
                st.session_state["assistant_msgs"].append({"role": "user", "content": q.strip()})
                with st.spinner("Thinking…"):
                    try:
                        a = _assistant_answer(q.strip())
                    except Exception as e:
                        a = f"Sorry — I could not answer that just now ({e})."
                st.session_state["assistant_msgs"].append({"role": "assistant", "content": a})
                st.rerun()


@st.cache_data(ttl=120, show_spinner=False)
def get_alert_counts():
    """Per-section counts of items needing attention (for sidebar notifications)."""
    s = get_session()
    row = s.sql(f"""
        SELECT
          SUM(IFF(STATUS='OPEN' AND CURRENT_STAGE IN ('RECEIPT','VALIDITY','CLASSIFY','SAR_REDIRECT','DUPLICATE','CLARIFICATION'),1,0)) AS INTAKE,
          SUM(IFF(STATUS='OPEN',1,0)) AS BOARD,
          SUM(IFF(STATUS='OPEN' AND RAG='RED',1,0)) AS ATRISK,
          SUM(IFF(STATUS='OPEN' AND CURRENT_STAGE IN ('DRAFTING','QA'),1,0)) AS STUDIO,
          SUM(IFF(STATUS='OPEN' AND CURRENT_STAGE='REVIEW',1,0)) AS REVIEW,
          SUM(IFF(STATUS='OPEN' AND WD_REMAINING < 0,1,0)) AS OVERDUE
        FROM {SCHEMA}.V_CASE
    """).to_pandas().iloc[0]
    return {k: int(row[k] or 0) for k in ["INTAKE", "BOARD", "ATRISK", "STUDIO", "REVIEW", "OVERDUE"]}


def tab(title, n):
    """Append a count to a nav title when there are items needing attention."""
    return f"{title}  ({n})" if n else title


def sla_callout():
    """Prominent statutory-deadline reference, minimal acronyms."""
    st.markdown(
        """
        <div class="target-ref">
          <div class="target-ref__head">
            <span class="target-ref__tag">Statutory &middot; Target</span>
            <span class="target-ref__title">Deadlines and the regulator threshold &mdash; for reference</span>
          </div>
          <div class="target-grid">
            <div class="target-cell"><div class="d">20</div><div class="t">working days</div>
              <div class="s">Freedom of Information requests</div></div>
            <div class="target-cell"><div class="d">20&ndash;40</div><div class="t">working days</div>
              <div class="s">Environmental Information Regulations (complex: up to 40)</div></div>
            <div class="target-cell"><div class="d">1</div><div class="t">calendar month</div>
              <div class="s">Subject Access Requests (your own personal data)</div></div>
            <div class="target-cell"><div class="d">90%</div><div class="t">regulator target</div>
              <div class="s">Authorities are monitored below this threshold</div></div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
