"""Custom Streamlit component: a drag-and-drop FOI lifecycle board.

The React/TypeScript source lives in `kanban_frontend/` at the repo root and is
built (npm run build) into the `dist/` directory beside this file. deploy.sh
copies app_pages (including this dist) into the SPCS image, so no Node is needed
at container runtime.
"""
import os
import streamlit.components.v1 as components

_BUILD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
_component = components.declare_component("foi_kanban", path=_BUILD_DIR)


def foi_kanban(cases, phases, key="kanban"):
    """Render the Kanban board.

    cases:  list of dicts with keys ref, subject, regime, rag, wd_remaining,
            stage_code, stage_name, phase_id, is_synthetic, is_vexatious
    phases: list of dicts with keys id, label
    Returns the last interaction event dict, e.g.
            {"event": "move", "ref": ..., "toPhase": ..., "nonce": n} or
            {"event": "open", "ref": ..., "nonce": n}, or None.
    """
    return _component(cases=cases, phases=phases, default=None, key=key)
