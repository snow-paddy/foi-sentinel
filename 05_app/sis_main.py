"""FOI Sentinel v2 — Streamlit-in-Snowflake entry point.
Full FOI case-lifecycle management for UK local government.
"""
import streamlit as st
from snowflake.snowpark.context import get_active_session

if "session" not in st.session_state:
    st.session_state.session = get_active_session()

from app_pages import _shared
_shared.inject_css()

st.logo  # no-op guard; Material logos unsupported in SiS

pages = {
    "Operations": [
        st.Page("app_pages/command_centre.py", title="Command Centre", icon=":material/dashboard:"),
        st.Page("app_pages/intake.py", title="Intake & Triage", icon=":material/inbox:"),
        st.Page("app_pages/board.py", title="Case Board", icon=":material/view_kanban:"),
        st.Page("app_pages/workspace.py", title="Case Workspace", icon=":material/folder_open:"),
    ],
    "Decisions & Compliance": [
        st.Page("app_pages/response_studio.py", title="Response & Refusal Studio", icon=":material/draft:"),
        st.Page("app_pages/review_ico.py", title="Internal Review & ICO", icon=":material/gavel:"),
        st.Page("app_pages/reporting.py", title="Performance Reporting", icon=":material/monitoring:"),
    ],
    "Insight": [
        st.Page("app_pages/sector_trends.py", title="Sector Trends", icon=":material/trending_up:"),
    ],
    "Knowledge & Admin": [
        st.Page("app_pages/guidance.py", title="Knowledge & Guidance", icon=":material/menu_book:"),
        st.Page("app_pages/admin.py", title="Admin & Config", icon=":material/settings:"),
        st.Page("app_pages/about.py", title="About & Architecture", icon=":material/info:"),
    ],
}

_pg = st.navigation(pages)
st.session_state["current_page"] = _pg.title
_shared.ai_assistant_widget()
_pg.run()
