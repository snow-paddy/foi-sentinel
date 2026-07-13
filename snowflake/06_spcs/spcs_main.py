"""SPCS container entry point for FOI Sentinel v2.
Builds a Snowpark session from the SPCS OAuth token, then runs the same
multi-page app used in Streamlit-in-Snowflake.
"""
import os
import streamlit as st
from snowflake.snowpark import Session

st.set_page_config(page_title="FOI Sentinel", page_icon=":material/shield:", layout="wide")


@st.cache_resource(show_spinner=False)
def make_session():
    token_path = "/snowflake/session/token"
    if os.path.exists(token_path):
        with open(token_path) as f:
            token = f.read()
        cfg = {
            "host": os.getenv("SNOWFLAKE_HOST"),
            "account": os.getenv("SNOWFLAKE_ACCOUNT"),
            "token": token,
            "authenticator": "oauth",
            "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE", "FOI_WH"),
            "database": os.getenv("SNOWFLAKE_DATABASE", "FOI"),
            "schema": os.getenv("SNOWFLAKE_SCHEMA", "FOI_SENTINEL_V2"),
        }
        return Session.builder.configs(cfg).create()
    # Fallback for local / SiS execution
    from snowflake.snowpark.context import get_active_session
    return get_active_session()


if "session" not in st.session_state:
    st.session_state.session = make_session()

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
    _shared.needs_attention_sidebar()

_shared.ai_assistant_widget()
_pg.run()
