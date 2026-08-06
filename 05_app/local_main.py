"""Local-test harness for FOI Sentinel v2.

Runs the exact same multi-page app as the SPCS container (spcs_main.py), but
builds the Snowpark session from the local `PG-SNOWFLAKE` key-pair connection
defined in ~/.snowflake/connections.toml. This gives a localhost URL that is
NOT behind the SPCS OAuth/passkey wall, so the app can be clicked through and
driven by Playwright (the xo-audit gate) before any SPCS deploy.

Run:
    SNOWFLAKE_CONNECTION_NAME=PG-SNOWFLAKE streamlit run 05_app/local_main.py
"""
import os
import sys
import tomllib
from pathlib import Path

import streamlit as st
from snowflake.snowpark import Session

st.set_page_config(page_title="FOI Sentinel (local)", page_icon=":material/shield:", layout="wide")

CONN_NAME = os.getenv("SNOWFLAKE_CONNECTION_NAME", "PG-SNOWFLAKE")
_CONN_KEYS = ("account", "user", "role", "authenticator", "warehouse", "database", "schema")


@st.cache_resource(show_spinner="Connecting to Snowflake…")
def make_session():
    """Build a Snowpark session from the named connections.toml entry (key-pair)."""
    toml_path = Path.home() / ".snowflake" / "connections.toml"
    with open(toml_path, "rb") as f:
        conns = tomllib.load(f)
    if CONN_NAME not in conns:
        raise RuntimeError(f"Connection '{CONN_NAME}' not found in {toml_path}")
    raw = conns[CONN_NAME]
    cfg = {k: raw[k] for k in _CONN_KEYS if k in raw}
    # Key-pair: the connector accepts a PEM/p8 path via private_key_file.
    if "private_key_path" in raw:
        cfg["private_key_file"] = raw["private_key_path"]
    elif "private_key_file" in raw:
        cfg["private_key_file"] = raw["private_key_file"]
    cfg.setdefault("warehouse", "FOI_WH")
    cfg.setdefault("database", "FOI")
    cfg.setdefault("schema", "FOI_SENTINEL_V2")
    return Session.builder.configs(cfg).create()


if "session" not in st.session_state:
    st.session_state.session = make_session()

# Ensure app_pages is importable regardless of cwd.
sys.path.insert(0, str(Path(__file__).parent))

from app_pages import _shared
_shared.inject_css()

pages = {
    "Operations": [
        st.Page("app_pages/command_centre.py", title="Command Centre", icon=":material/dashboard:"),
        st.Page("app_pages/cases.py", title="Cases", icon=":material/view_kanban:"),
        st.Page("app_pages/review_ico.py", title="Reviews & ICO", icon=":material/gavel:"),
    ],
    "Insight": [
        st.Page("app_pages/sector_trends.py", title="Sector Trends", icon=":material/trending_up:"),
    ],
    "Knowledge": [
        st.Page("app_pages/guidance.py", title="Knowledge & Guidance", icon=":material/menu_book:"),
        st.Page("app_pages/about.py", title="About & Architecture", icon=":material/info:"),
    ],
    "Testing & Config": [
        st.Page("app_pages/email_intake.py", title="Email Intake (demo)", icon=":material/mail:"),
        st.Page("app_pages/escalations.py", title="Escalations (demo)", icon=":material/trending_up:"),
        st.Page("app_pages/testing_learning.py", title="Triage Learning", icon=":material/model_training:"),
        st.Page("app_pages/admin.py", title="Settings", icon=":material/settings:"),
    ],
}

_pg = st.navigation(pages)
st.session_state["current_page"] = _pg.title

# Sidebar must render AFTER st.navigation() so the page registry exists — otherwise
# st.switch_page() from the needs-attention rows silently no-ops.
with st.sidebar:
    st.caption(f":material/dns: Local harness · {CONN_NAME}")
    _shared.needs_attention_sidebar()

_shared.ai_assistant_widget()
_pg.run()
