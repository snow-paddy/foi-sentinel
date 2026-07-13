"""Cases — single horizontal Kanban (all 17 stages) + full case detail incl. drafting."""
import json
import streamlit as st
import pandas as pd
from app_pages import _shared
from app_pages.foi_kanban import foi_kanban

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA

st.title(":material/view_kanban: Cases")
st.caption("Track and progress live Freedom of Information and Environmental Information requests across their lifecycle.")

stage_names = session.sql(f"SELECT STAGE_CODE, STAGE_NAME, STAGE_ORDER FROM {SCHEMA}.LIFECYCLE_STAGE ORDER BY STAGE_ORDER").to_pandas()
NAME = {r["STAGE_CODE"]: r["STAGE_NAME"] for _, r in stage_names.iterrows()}
CODE = {r["STAGE_NAME"]: r["STAGE_CODE"] for _, r in stage_names.iterrows()}
ORDERED_STAGES = stage_names["STAGE_CODE"].tolist()

@st.cache_data(ttl=120, show_spinner=False)
def _load_open_cases():
    return session.sql(f"""
        SELECT REFERENCE, CASE_ID, SUBJECT, REGIME, CURRENT_STAGE, OWNING_DEPARTMENT, WD_REMAINING, RAG, IS_VEXATIOUS, IS_SYNTHETIC
        FROM {SCHEMA}.V_CASE WHERE STATUS='OPEN'
    """).to_pandas()


cases = _load_open_cases()

PHASES = [
    ("Intake", ["RECEIPT", "VALIDITY", "CLASSIFY", "SAR_REDIRECT", "DUPLICATE", "CLARIFICATION"]),
    ("Allocation & search", ["ALLOCATION", "SEARCH"]),
    ("Assess", ["COST", "EXEMPTIONS", "PIT", "REDACTION"]),
    ("Draft & QA", ["DRAFTING", "QA"]),
    ("Dispatch & publish", ["DISPATCH", "PUBLISH"]),
    ("Review", ["REVIEW"]),
]

STAGE_TO_PHASE = {s: name for name, stages in PHASES for s in stages}
PHASE_FIRST_STAGE = {name: stages[0] for name, stages in PHASES}

st.markdown("""<style>
.tile-sub { color:#475467; font-size:0.82rem; font-weight:600; line-height:1.3; }
</style>""", unsafe_allow_html=True)


def _wd(v):
    return None if pd.isna(v) else int(v)


def _render_board():
    """Lifecycle Kanban board. Clicking a tile drills into the case detail view."""
    _shared.sla_callout()
    # Honour a drill-through filter set from the Command Centre
    drill = st.session_state.pop("cases_filter", None)
    options = ["All", "At risk only", "Overdue only", "Closed", "EIR only", "FOI only"]
    default = drill if drill in options else "All"
    flt = st.segmented_control("Filter", options, default=default)

    # Closed requests are not part of the live lifecycle board — show them as a list.
    if flt == "Closed":
        st.markdown("##### :material/task_alt: Closed requests (this period)")
        st.caption("Requests answered and closed — green where answered within the statutory deadline.")
        closed = session.sql(f"""
            SELECT REFERENCE, SUBJECT, REGIME, OWNING_DEPARTMENT, CLOSED_DATE, ANSWERED_IN_TIME
            FROM {SCHEMA}.V_CASE WHERE STATUS='CLOSED' ORDER BY CLOSED_DATE DESC
        """).to_pandas()
        st.dataframe(closed, hide_index=True, use_container_width=True, column_config={
            "REFERENCE": "Reference", "SUBJECT": "Subject", "REGIME": "Type",
            "OWNING_DEPARTMENT": "Department", "CLOSED_DATE": st.column_config.DateColumn("Closed"),
            "ANSWERED_IN_TIME": st.column_config.CheckboxColumn("In time")})
        return

    fc = cases.copy()
    if flt == "At risk only":
        fc = fc[fc["RAG"] == "RED"]
    elif flt == "Overdue only":
        fc = fc[fc["WD_REMAINING"] < 0]
    elif flt == "EIR only":
        fc = fc[fc["REGIME"] == "EIR"]
    elif flt == "FOI only":
        fc = fc[fc["REGIME"] == "FOI"]

    st.markdown("##### :material/view_kanban: Lifecycle board")
    st.caption("17 stages grouped into 6 phases. **Drag** a card to another phase to advance it; **click** a card to open it. "
               "🔴 at risk / overdue · 🟠 6–10 working days · 🟢 on track · ⏸️ paused.")
    payload = [{
        "ref": r["REFERENCE"],
        "subject": r["SUBJECT"] or "Untitled request",
        "regime": r["REGIME"],
        "rag": r["RAG"],
        "wd_remaining": _wd(r["WD_REMAINING"]),
        "stage_code": r["CURRENT_STAGE"],
        "stage_name": NAME.get(r["CURRENT_STAGE"], r["CURRENT_STAGE"]),
        "phase_id": STAGE_TO_PHASE.get(r["CURRENT_STAGE"], "Intake"),
        "is_synthetic": bool(r["IS_SYNTHETIC"]),
        "is_vexatious": bool(r["IS_VEXATIOUS"]),
    } for _, r in fc.iterrows()]
    phases_arg = [{"id": name, "label": name} for name, _ in PHASES]

    evt = foi_kanban(cases=payload, phases=phases_arg, key="kanban")

    if evt and evt.get("nonce") != st.session_state.get("kanban_nonce"):
        st.session_state["kanban_nonce"] = evt.get("nonce")
        if evt.get("event") == "open":
            # Drill into the case: rerun so the board is replaced by the detail view.
            st.session_state["selected_case"] = evt.get("ref")
            st.rerun()
        elif evt.get("event") == "move":
            target_stage = PHASE_FIRST_STAGE.get(evt.get("toPhase"))
            rrow = cases[cases["REFERENCE"] == evt.get("ref")]
            if target_stage and not rrow.empty and target_stage != rrow.iloc[0]["CURRENT_STAGE"]:
                cid = rrow.iloc[0]["CASE_ID"]
                session.sql(f"CALL {SCHEMA}.SP_ADVANCE_STAGE('{cid}', '{target_stage}', 'HUMAN', 'FOI Officer', 'Moved on board (drag)')").collect()
                st.toast(f"{evt.get('ref')} → {NAME.get(target_stage, target_stage)}")
                st.cache_data.clear()
                st.rerun()


# ---------------- Full case detail (renders ABOVE the board, into the reserved slot) ----------------
# Fragment-scoped: interactions inside an open case (tab switches, precedent search,
# draft suggestions) rerun only this panel, not the whole board — no board flicker.
# Mutating actions still call st.rerun() (full) to refresh the board.
@st.fragment
def _render_case_detail():
    ref = st.session_state.get("selected_case")
    if not ref:
        st.info(":material/ads_click: Select a case from the board — click a tile to work on it here.")
        return

    c = session.sql(f"SELECT * FROM {SCHEMA}.V_CASE WHERE REFERENCE='{ref}'").to_pandas()
    if c.empty:
        return
    c = c.iloc[0]
    case_id = c["CASE_ID"]

    syn_hdr = " <span class='syn-badge'>synthetic</span>" if c.get("IS_SYNTHETIC") else ""
    h1, h2, h3, h4, h5 = st.columns([2, 1, 1, 1, 1])
    h1.markdown(f"### {ref} — {c['SUBJECT'] or 'Untitled request'}")
    h1.markdown(f"<span class='tile-sub'>{c['REQUESTER_NAME'] or 'Anonymous'}{(' · ' + c['REQUESTER_ORGANISATION']) if c['REQUESTER_ORGANISATION'] else ''} · via {c['SOURCE']}</span>{syn_hdr}", unsafe_allow_html=True)
    h2.markdown("**Type**"); h2.markdown(_shared.regime_badge(c["REGIME"]))
    h3.markdown("**Stage**"); h3.markdown(f":blue-badge[{c['STAGE_NAME']}]")
    h4.markdown("**Deadline**"); h4.markdown(_shared.rag_badge(c["RAG"], c["WD_REMAINING"]))
    h5.markdown("**Clock**"); h5.markdown(f":grey-badge[{c['CLOCK_STATE']}]")

    if c["IS_VEXATIOUS"]:
        st.error(":material/block: Flagged potentially **vexatious (section 14)** — review the pattern of behaviour before proceeding.")

    # Clearer request summary: AI summary prominent, full text in expander
    tri = session.sql(f"SELECT TRIAGE_JSON FROM {SCHEMA}.FOI_TRIAGE WHERE CASE_ID='{case_id}'").to_pandas()
    tj = {}
    if not tri.empty and tri.iloc[0]["TRIAGE_JSON"]:
        tj = tri.iloc[0]["TRIAGE_JSON"]
        tj = json.loads(tj) if isinstance(tj, str) else tj
    if tj.get("summary"):
        st.success(f":material/lightbulb: **In short:** {tj.get('summary')}")
    with st.expander(":material/description: Full request text"):
        st.markdown(c["REQUEST_TEXT"])

    st.markdown("##### :material/conveyor_belt: Progress this case")
    cc1, cc2, cc3 = st.columns([2, 1, 1])
    with cc1:
        idx = _shared.STAGE_ORDER.index(c["CURRENT_STAGE"]) if c["CURRENT_STAGE"] in _shared.STAGE_ORDER else 0
        to_stage = st.selectbox("Advance to stage", _shared.STAGE_ORDER, index=min(idx + 1, len(_shared.STAGE_ORDER) - 1),
                                format_func=lambda s: NAME.get(s, s))
        note = st.text_input("Note", key="adv_note", placeholder="e.g. Allocated to Planning for search")
        if st.button(":material/arrow_forward: Advance stage", type="primary"):
            session.sql(f"CALL {SCHEMA}.SP_ADVANCE_STAGE('{case_id}', '{to_stage}', 'HUMAN', 'FOI Officer', '{note.replace(chr(39), chr(39)*2)}')").collect()
            st.cache_data.clear(); st.rerun()
    with cc2:
        st.markdown("**Stop clock**")
        reason = st.selectbox("Reason", ["STOPPED_CLARIFICATION", "STOPPED_FEES", "PIT_EXTENSION"], label_visibility="collapsed")
        if st.button(":material/pause: Stop clock"):
            session.sql(f"CALL {SCHEMA}.SP_STOP_CLOCK('{case_id}', '{reason}', 'FOI Officer', 'Stopped from Cases')").collect(); st.rerun()
    with cc3:
        st.markdown("**Resume**")
        st.caption("Extends deadline by working days paused")
        if st.button(":material/play_arrow: Resume clock"):
            session.sql(f"CALL {SCHEMA}.SP_RESUME_CLOCK('{case_id}', 'FOI Officer')").collect(); st.rerun()

    t_cost, t_ex, t_red, t_resp, t_time = st.tabs(
        [":material/payments: Cost", ":material/shield: Exemptions & public interest", ":material/visibility_off: Redaction",
         ":material/draft: Draft response", ":material/history: Timeline"])

    with t_cost:
        st.caption("Only the four prescribed activities count toward the cost limit (Fees Regulations 2004), charged at £25 per hour.")
        ce = session.sql(f"SELECT * FROM {SCHEMA}.FOI_COST_ESTIMATE WHERE CASE_ID='{case_id}' ORDER BY CREATED_AT DESC LIMIT 1").to_pandas()
        cur = ce.iloc[0] if not ce.empty else None
        e1, e2, e3, e4 = st.columns(4)
        det = e1.number_input("Determine (h)", 0.0, 200.0, float(cur["HOURS_DETERMINE"]) if cur is not None else 1.0, 0.5)
        loc = e2.number_input("Locate (h)", 0.0, 200.0, float(cur["HOURS_LOCATE"]) if cur is not None else 2.0, 0.5)
        ret = e3.number_input("Retrieve (h)", 0.0, 200.0, float(cur["HOURS_RETRIEVE"]) if cur is not None else 2.0, 0.5)
        ext = e4.number_input("Extract (h)", 0.0, 200.0, float(cur["HOURS_EXTRACT"]) if cur is not None else 1.0, 0.5)
        if st.button(":material/calculate: Recalculate cost", type="primary"):
            session.sql(f"CALL {SCHEMA}.SP_COST_ESTIMATE('{case_id}', {det}, {loc}, {ret}, {ext})").collect(); st.rerun()
        if cur is not None:
            st.metric("Total", f"{cur['TOTAL_HOURS']:.1f} h · £{cur['TOTAL_GBP']:.0f}")
            if cur["EXCEEDS_LIMIT"]:
                st.error(f":material/warning: Exceeds the cost limit (£{cur['LIMIT_GBP']:.0f}). Consider refusing under section 12 with advice to narrow the request (section 16).")
            elif c["REGIME"] == "EIR":
                st.info(":material/info: " + str(cur["NOTE"]))
            else:
                st.success("Within the cost limit.")

    with t_ex:
        ex = session.sql(f"SELECT * FROM {SCHEMA}.FOI_EXEMPTION_ASSESSMENT WHERE CASE_ID='{case_id}'").to_pandas()
        if ex.empty:
            st.caption("No exemptions assessed yet.")
        for _, r in ex.iterrows():
            with st.container(border=True):
                typ = ":orange-badge[QUALIFIED]" if r["EXEMPTION_TYPE"] == "QUALIFIED" else ":red-badge[ABSOLUTE]"
                st.markdown(f"**{r['SECTION_REF']}** {typ} · Decision: :grey-badge[{r['DECISION']}]")
                if r["PIT_REQUIRED"]:
                    p1, p2 = st.columns(2)
                    p1.success(f"**For disclosure:** {r['PIT_FOR'] or '—'}")
                    p2.warning(f"**For withholding:** {r['PIT_AGAINST'] or '—'}")
                    if r["DECISION"] == "PENDING":
                        d1, d2 = st.columns(2)
                        if d1.button(":material/lock_open: Disclose", key=f"dis_{r['ASSESSMENT_ID']}"):
                            session.sql(f"UPDATE {SCHEMA}.FOI_EXEMPTION_ASSESSMENT SET DECISION='DO_NOT_APPLY', DECIDED_BY='FOI Officer', DECIDED_AT=CURRENT_TIMESTAMP() WHERE ASSESSMENT_ID='{r['ASSESSMENT_ID']}'").collect(); st.rerun()
                        if d2.button(":material/lock: Withhold", key=f"app_{r['ASSESSMENT_ID']}"):
                            session.sql(f"UPDATE {SCHEMA}.FOI_EXEMPTION_ASSESSMENT SET DECISION='APPLY', DECIDED_BY='FOI Officer', DECIDED_AT=CURRENT_TIMESTAMP() WHERE ASSESSMENT_ID='{r['ASSESSMENT_ID']}'").collect(); st.rerun()

        # Escalation-risk signal: grounded in published ICO / Cabinet Office statistics
        # and our real observed peer outcomes (V_ESCALATION_RISK).
        def _theme_from_section(ref):
            r = (ref or "").lower()
            if "eir" in r or "reg" in r:
                return "eir_environmental"
            digits = "".join(ch for ch in r.split("(")[0] if ch.isdigit())
            return {"12": "s12_cost", "14": "s14_vexatious", "21": "s21_published",
                    "40": "s40_personal", "43": "s43_commercial"}.get(digits, "other")

        themes = sorted({_theme_from_section(s) for s in ex["SECTION_REF"].tolist()}) if not ex.empty else []
        if themes:
            tlist = "','".join(themes)
            risk = session.sql(f"SELECT * FROM {SCHEMA}.V_ESCALATION_RISK WHERE EXEMPTION_THEME IN ('{tlist}')").to_pandas()
            if not risk.empty:
                with st.container(border=True):
                    st.markdown("###### Escalation risk")
                    st.caption("How often comparable refusals are challenged — grounded in published "
                               "ICO / Cabinet Office statistics and real peer outcomes. A guide to whether "
                               "this exemption decision is likely to survive internal review.")
                    ov = risk.iloc[0]["OVERTURN_RATE"]
                    intime = risk.iloc[0]["REVIEW_IN_TIME_RATE"]
                    if ov is not None:
                        st.markdown(f"Across all withheld FOI requests, **{float(ov):.0%}** of internal reviews "
                                    f"overturned the original decision fully or partially, and only "
                                    f"**{float(intime):.0%}** were completed within 20 working days "
                                    f"(Cabinet Office, 2025).")
                    for _, rr in risk.iterrows():
                        bits = []
                        if rr["SHARE_OF_WITHHELD"] is not None:
                            bits.append(f"{float(rr['SHARE_OF_WITHHELD']):.1%} of withheld requests engage this exemption")
                        if rr["WDTK_N"] and rr["WDTK_NOT_FULLY_MET_RATE"] is not None:
                            bits.append(f"peers did not fully meet **{float(rr['WDTK_NOT_FULLY_MET_RATE']):.0%}** "
                                        f"of {int(rr['WDTK_N'])} comparable WhatDoTheyKnow requests")
                        if rr["GLA_N"]:
                            bits.append(f"{int(rr['GLA_N'])} GLA precedents on file")
                        meta = " · ".join(bits) if bits else "no quantified share published"
                        st.markdown(f"**{rr['LABEL']}** — {meta}")
                        if rr["NOTE"]:
                            st.caption(f"{rr['NOTE']} (source: {rr['SOURCE']}, {int(rr['SOURCE_YEAR'])})")

    with t_red:
        st.caption("Redactions are AI-suggested but every one must be verified by a human (the highest-risk step).")
        rd = session.sql(f"SELECT * FROM {SCHEMA}.FOI_REDACTION WHERE CASE_ID='{case_id}'").to_pandas()
        if rd.empty:
            st.caption("No redactions flagged.")
        for _, r in rd.iterrows():
            with st.container(border=True):
                st.markdown(f":material/visibility_off: {r['EXCERPT']}")
                st.caption(f"Basis: {r['BASIS_SECTION']}")
                if r["VERIFIED"]:
                    st.markdown(":green-badge[Verified]")
                elif st.button(":material/check: Verify redaction", key=f"ver_{r['REDACTION_ID']}"):
                    session.sql(f"UPDATE {SCHEMA}.FOI_REDACTION SET VERIFIED=TRUE, VERIFIED_BY='FOI Officer' WHERE REDACTION_ID='{r['REDACTION_ID']}'").collect(); st.rerun()

    with t_resp:
        st.caption("Draft the outbound response. Refusals automatically include the internal-review and Information Commissioner routes required by section 17.")

        st.markdown("###### Similar past responses (precedent)")
        st.caption("Retrieved via Cortex Search across this council's disclosure log, Camden's "
                   "published responses, the GLA disclosure log and other UK authorities "
                   "(WhatDoTheyKnow). Each precedent is labelled with its source and citation; "
                   "weighting favours clean outcomes.")
        if st.button(":material/search: Find similar responses", key=f"findprec_{case_id}"):
            with st.spinner("Searching the precedent corpus..."):
                camden = _shared.cortex_search("CAMDEN_FOI_SEARCH", c["REQUEST_TEXT"],
                                               ["IDENTIFIER", "DOCUMENT_TITLE", "DOCUMENT_DATE", "DOCUMENT_TEXT"], limit=2)
                disc = _shared.cortex_search("DISCLOSURE_SEARCH", c["REQUEST_TEXT"],
                                             ["REFERENCE_NUMBER", "TOPIC", "REQUEST_SUMMARY", "RESPONSE_SUMMARY"], limit=2)
                gla = _shared.cortex_search("GLA_DISCLOSURE_SEARCH", c["REQUEST_TEXT"],
                                            ["REFERENCE_NUMBER", "TITLE", "REGIME", "THEME", "RESPONSE_TEXT",
                                             "RESPONSE_DATE", "SOURCE_URL", "AUTHORITY_NAME"], limit=2)
                wdtk = _shared.cortex_search("WDTK_PRECEDENT_SEARCH", c["REQUEST_TEXT"],
                                             ["AUTHORITY_NAME", "THEME", "LAW_USED", "OUTCOME", "EXEMPTIONS",
                                              "REQUEST_TITLE", "REQUEST_URL", "SNIPPET"], limit=2)
            st.session_state[f"prec_{case_id}"] = {"camden": camden, "disc": disc, "gla": gla, "wdtk": wdtk}

        prec = st.session_state.get(f"prec_{case_id}")
        if prec:
            _clean = '<span style="color:#1a7f37;font-weight:600">clean outcome</span>'
            if not any(prec.get(k) for k in ("camden", "disc", "gla", "wdtk")):
                st.info("No close precedents found for this request.")
            for d in prec.get("camden", []):
                date = str(d.get("DOCUMENT_DATE") or "")[:10]
                snip = (d.get("DOCUMENT_TEXT") or "")[:300].replace("\n", " ")
                st.markdown(f'<div class="precedent"><div class="p-title">{d.get("DOCUMENT_TITLE", "(untitled)")}</div>'
                            f'<div class="p-meta">Camden &middot; {d.get("IDENTIFIER", "")} &middot; {date}</div>'
                            f'<div class="p-snip">{snip}&hellip;</div></div>', unsafe_allow_html=True)
            for d in prec.get("disc", []):
                snip = (d.get("RESPONSE_SUMMARY") or d.get("REQUEST_SUMMARY") or "")[:300]
                st.markdown(f'<div class="precedent"><div class="p-title">{d.get("TOPIC", "(topic)")}</div>'
                            f'<div class="p-meta">This council&apos;s disclosure log &middot; {d.get("REFERENCE_NUMBER", "")}</div>'
                            f'<div class="p-snip">{snip}&hellip;</div></div>', unsafe_allow_html=True)
            for d in prec.get("gla", []):
                date = str(d.get("RESPONSE_DATE") or "")[:10]
                snip = (d.get("RESPONSE_TEXT") or "")[:300].replace("\n", " ")
                url = d.get("SOURCE_URL", "")
                ref = d.get("REFERENCE_NUMBER") or "view"
                cite = f'<a href="{url}" target="_blank">{ref}</a>' if url else ref
                st.markdown(f'<div class="precedent"><div class="p-title">{d.get("TITLE", "(untitled)")}</div>'
                            f'<div class="p-meta">GLA full response &middot; {cite} &middot; {date} &middot; {_clean}</div>'
                            f'<div class="p-snip">{snip}&hellip;</div></div>', unsafe_allow_html=True)
            for d in prec.get("wdtk", []):
                outcome = d.get("OUTCOME") or ""
                is_clean = outcome in ("Successful", "Partially successful")
                tag = _clean if is_clean else f'<span style="color:#9a6700">{outcome or "outcome unclassified"}</span>'
                url = d.get("REQUEST_URL", "")
                auth = d.get("AUTHORITY_NAME") or ""
                cite = f'<a href="{url}" target="_blank">{auth}</a>' if url else auth
                snip = (d.get("SNIPPET") or "")[:300].replace("\n", " ")
                st.markdown(f'<div class="precedent"><div class="p-title">{d.get("REQUEST_TITLE", "(request)")}</div>'
                            f'<div class="p-meta">WhatDoTheyKnow &middot; {cite} &middot; {tag}</div>'
                            f'<div class="p-snip">{snip}&hellip;</div></div>', unsafe_allow_html=True)

            if any(prec.get(k) for k in ("camden", "disc", "gla", "wdtk")) and \
                    st.button(":material/auto_awesome: Suggest reply from precedents", key=f"sugg_{case_id}"):
                parts = []
                for d in prec.get("gla", []):
                    parts.append(f"PRECEDENT [GLA {d.get('REFERENCE_NUMBER', '')}, published response]: "
                                 f"REQUEST: {(d.get('REQUEST_SUMMARY') or '')[:400]} RESPONSE: {(d.get('RESPONSE_TEXT') or '')[:1000]}")
                for d in prec.get("camden", []):
                    parts.append(f"PRECEDENT [Camden {d.get('IDENTIFIER', '')}]: {(d.get('DOCUMENT_TEXT') or '')[:1000]}")
                for d in prec.get("disc", []):
                    parts.append(f"PRECEDENT [This council {d.get('REFERENCE_NUMBER', '')}]: {(d.get('RESPONSE_SUMMARY') or '')[:600]}")
                # outcome weighting: clean WDTK outcomes first
                wdtk_sorted = sorted(prec.get("wdtk", []),
                                     key=lambda d: 0 if (d.get("OUTCOME") in ("Successful", "Partially successful")) else 1)
                for d in wdtk_sorted:
                    parts.append(f"PRECEDENT [WhatDoTheyKnow, {d.get('AUTHORITY_NAME', '')}, outcome {d.get('OUTCOME', '')}]: "
                                 f"{(d.get('SNIPPET') or '')[:600]}")
                context = "\n\n".join(parts)[:8000]
                prompt = (
                    f"You are an FOI officer at {_shared.council_name()}. Draft a professional response to the request "
                    f"below, grounded in the precedent responses provided. They span this council's own log, Camden, the "
                    f"GLA disclosure log and other UK authorities (WhatDoTheyKnow). Prefer precedents marked with a "
                    f"successful or published outcome. Match their tone and structure, rely on the same statutory basis "
                    f"where applicable, and do not invent facts. Cite the precedent reference inline in square brackets "
                    f"(e.g. [GLA MGLA...] or [WhatDoTheyKnow, <authority>]) wherever you rely on it. Where the precedents "
                    f"do not cover a point, insert a clearly marked [PLACEHOLDER].\n\nREQUEST:\n{c['REQUEST_TEXT']}\n\n{context}\n\nDraft the response:"
                )
                esc = prompt.replace("'", "''")
                with st.spinner("Drafting from precedents with Cortex..."):
                    out = session.sql(f"SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '{esc}') AS R").to_pandas()
                st.session_state[f"suggest_{case_id}"] = out.iloc[0]["R"] if not out.empty else ""

            sugg = st.session_state.get(f"suggest_{case_id}")
            if sugg:
                st.text_area("Suggested reply (grounded in precedents)", sugg, height=240, key=f"sugg_ta_{case_id}")
                st.caption("Precedent-grounded suggestion drawn from multiple authorities, weighted toward clean "
                           "outcomes, with citations included. Review against the case facts before use.")
        st.divider()

        rtype = st.radio("Response type", ["DISCLOSURE", "PARTIAL", "REFUSAL", "S21_REUSE"], horizontal=True,
                         format_func=lambda t: {"DISCLOSURE": "Full disclosure", "PARTIAL": "Partial", "REFUSAL": "Refusal", "S21_REUSE": "Already published (s.21)"}[t])
        if st.button(":material/auto_awesome: Generate compliant draft", type="primary"):
            with st.spinner("Drafting with Cortex..."):
                session.sql(f"CALL {SCHEMA}.SP_GENERATE_RESPONSE('{case_id}', '{rtype}')").collect()
            st.rerun()
        drafts = session.sql(f"SELECT * FROM {SCHEMA}.FOI_RESPONSE WHERE CASE_ID='{case_id}' ORDER BY CREATED_AT DESC").to_pandas()
        for _, r in drafts.iterrows():
            with st.container(border=True):
                st.markdown(f"**{r['RESPONSE_TYPE']}** · drafted {r['CREATED_AT']:%d %b %H:%M}")
                checks = [("Exemption stated", r["S17_EXEMPTION_STATED"]), ("Internal review route", r["S17_INTERNAL_REVIEW_INCLUDED"]), ("Commissioner route", r["S17_ICO_ROUTE_INCLUDED"])]
                cols = st.columns(3)
                for col, (lbl, ok) in zip(cols, checks):
                    col.markdown((":green-badge[✓ " if ok else ":grey-badge[— ") + lbl + "]")
                edited = st.text_area("Draft", r["FINAL_TEXT"] or r["DRAFT_TEXT"] or "", height=260, key=f"d_{r['RESPONSE_ID']}")
                b1, b2 = st.columns(2)
                if b1.button(":material/save: Save as final", key=f"fin_{r['RESPONSE_ID']}"):
                    session.sql(f"UPDATE {SCHEMA}.FOI_RESPONSE SET FINAL_TEXT='{edited.replace(chr(39), chr(39)*2)}', SIGNED_OFF_BY='FOI Officer' WHERE RESPONSE_ID='{r['RESPONSE_ID']}'").collect()
                    st.success("Saved.")
                if b2.button(":material/send: Send & close case", key=f"disp_{r['RESPONSE_ID']}"):
                    session.sql(f"UPDATE {SCHEMA}.FOI_RESPONSE SET DISPATCHED_AT=CURRENT_TIMESTAMP() WHERE RESPONSE_ID='{r['RESPONSE_ID']}'").collect()
                    session.sql(f"UPDATE {SCHEMA}.FOI_CASE SET STATUS='CLOSED', CURRENT_STAGE='DISPATCH', CLOSED_DATE=CURRENT_DATE(), ANSWERED_IN_TIME=(CURRENT_DATE()<=STATUTORY_DEADLINE) WHERE CASE_ID='{case_id}'").collect()
                    session.sql(f"CALL {SCHEMA}.SP_ADVANCE_STAGE('{case_id}','DISPATCH','HUMAN','FOI Officer','Response dispatched')").collect()
                    st.cache_data.clear(); st.success("Dispatched and closed."); st.session_state.pop("selected_case", None); st.rerun()

    with t_time:
        ev = session.sql(f"SELECT EVENT_TS, ACTOR_TYPE, ACTOR, EVENT_TYPE, FROM_STAGE, TO_STAGE, NOTE FROM {SCHEMA}.FOI_CASE_EVENT WHERE CASE_ID='{case_id}' ORDER BY EVENT_TS").to_pandas()
        st.caption("Full audit trail — every AI recommendation and human decision, for regulator defensibility.")
        st.dataframe(ev, hide_index=True, use_container_width=True, column_config={
            "EVENT_TS": st.column_config.DatetimeColumn("When"), "ACTOR_TYPE": "By", "ACTOR": "Actor",
            "EVENT_TYPE": "Type", "FROM_STAGE": "From", "TO_STAGE": "To", "NOTE": "Note"})


# ---------------- Drill-in navigation ----------------
# A selected case replaces the board with a focused detail view; "Back to board"
# clears the selection and returns. No off-screen panel, no modal — a clear flow.
if st.session_state.get("selected_case"):
    bcol, _sp = st.columns([1, 4])
    with bcol:
        if st.button(":material/arrow_back: Back to board", key="close_detail", use_container_width=True):
            st.session_state.pop("selected_case", None)
            st.rerun()
    _render_case_detail()
else:
    _render_board()

