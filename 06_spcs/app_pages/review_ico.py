"""Internal Review & ICO — the post-response challenge route, with outcome letters and ICO submission packs."""
import streamlit as st
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA


def esc(t):
    return (t or "").replace("'", "''")


st.title(":material/gavel: Internal Review & ICO")
st.caption("The challenge route after a response: internal review first, then the Information Commissioner (s.50).")

with st.container(border=True):
    st.markdown("##### :material/insights: Why this matters")
    a, b, c = st.columns(3)
    a.markdown("**Internal review**\n\nThe requester's first challenge. Handled by a **different, more senior** officer "
               "(EIR reg.11 is statutory; FOIA per the s.45 Code). Target **20 working days**, maximum 40.")
    b.markdown("**The pain point**\n\nNationally only **~50% of internal reviews** are completed within 20 working days — "
               "the main driver of ICO complaints. Tracking deadlines here is the ROI.")
    c.markdown("**ICO complaint (s.50)**\n\nIf still dissatisfied, the requester complains to the Commissioner (online portal). "
               "Internal review must be exhausted first. The ICO can issue a binding **Decision Notice**.")

tab_ir, tab_ico, tab_pub = st.tabs([":material/rate_review: Internal reviews", ":material/balance: ICO complaints (s.50)", ":material/public: Disclosure log (s.19)"])

OUTCOME_LABEL = {"UPHELD": "Original decision upheld", "PARTIALLY_UPHELD": "Partially upheld", "OVERTURNED": "Original decision overturned"}

with tab_ir:
    ir = session.sql(f"""
        SELECT r.*, c.REFERENCE, c.REGIME, c.OWNING_DEPARTMENT, c.SUBJECT, c.REQUEST_TEXT,
               DATEDIFF('day', CURRENT_DATE(), r.REVIEW_DEADLINE) AS DAYS_LEFT
        FROM {SCHEMA}.FOI_INTERNAL_REVIEW r JOIN {SCHEMA}.FOI_CASE c ON c.CASE_ID=r.CASE_ID
        ORDER BY r.REVIEW_DEADLINE
    """).to_pandas()
    if ir.empty:
        st.caption("No internal reviews in progress. Generate one from the Escalations (demo) page.")
    for _, r in ir.iterrows():
        with st.container(border=True):
            top_l, top_r = st.columns([3, 1])
            top_l.markdown(f"{_shared.regime_badge(r['REGIME'])} **{r['REFERENCE']}** — {r['SUBJECT'] or 'internal review'}")
            if r["OUTCOME"] == "PENDING":
                dl = r["DAYS_LEFT"]
                if dl is None:
                    top_r.markdown(":grey-badge[no deadline]")
                elif dl < 0:
                    top_r.markdown(f":red-badge[{abs(int(dl))}d overdue]")
                elif dl <= 5:
                    top_r.markdown(f":red-badge[{int(dl)}d left]")
                elif dl <= 10:
                    top_r.markdown(f":orange-badge[{int(dl)}d left]")
                else:
                    top_r.markdown(f":green-badge[{int(dl)}d left]")
            else:
                top_r.markdown(f":blue-badge[{OUTCOME_LABEL.get(r['OUTCOME'], r['OUTCOME'])}]")

            a, b, cc = st.columns(3)
            a.markdown(f"**Original decision by**\n\n{r['ORIGINAL_DECISION_BY']}")
            b.markdown(f"**Fresh reviewer**\n\n{r['REVIEWER']}")
            cc.markdown(f"**Review deadline**\n\n{r['REVIEW_DEADLINE']}")
            if r["ORIGINAL_DECISION_BY"] == r["REVIEWER"]:
                st.error(":material/warning: Reviewer must differ from the original decision-maker.")
            else:
                st.success(":material/check: Reviewer is independent of the original decision.")

            if r["OUTCOME"] == "PENDING":
                st.caption(f"Requester's grounds: {r['OUTCOME_NOTE'] or '—'}")
                # Ground the review in comparable cross-authority outcomes + official ICO statistics.
                pkey = f"rev_prec_{r['REVIEW_ID']}"
                if pkey not in st.session_state:
                    st.session_state[pkey] = {
                        "wd": _shared.cortex_search("WDTK_PRECEDENT_SEARCH", r["REQUEST_TEXT"],
                                                    ["AUTHORITY_NAME", "OUTCOME", "REQUEST_TITLE", "REQUEST_URL", "SNIPPET"], limit=2),
                        "gl": _shared.cortex_search("GLA_DISCLOSURE_SEARCH", r["REQUEST_TEXT"],
                                                    ["REFERENCE_NUMBER", "TITLE", "RESPONSE_TEXT", "SOURCE_URL"], limit=2),
                    }
                rp = st.session_state[pkey]
                with st.expander(":material/balance: Comparable decisions & escalation context", expanded=False):
                    bench = session.sql(f"""SELECT METRIC, VALUE FROM {SCHEMA}.ICO_OUTCOME_BENCHMARK
                        WHERE METRIC IN ('internal_review_overturn_rate','internal_review_in_time_rate','ico_complaints_known')""").to_pandas()
                    bd = {x.METRIC: x.VALUE for x in bench.itertuples()}
                    if bd:
                        st.markdown(f"Nationally **{float(bd.get('internal_review_overturn_rate', 0)):.0%}** of internal "
                                    f"reviews overturn the original decision and only "
                                    f"**{float(bd.get('internal_review_in_time_rate', 0)):.0%}** finish within 20 working "
                                    f"days; **{int(bd.get('ico_complaints_known', 0))}** complaints reached the ICO in 2025 "
                                    f"(Cabinet Office).")
                    if not rp["wd"] and not rp["gl"]:
                        st.caption("No close cross-authority precedents found for this request.")
                    for d in rp["wd"]:
                        url = d.get("REQUEST_URL", "")
                        title = d.get("REQUEST_TITLE", "(request)")
                        head = f"[{title}]({url})" if url else title
                        st.markdown(f"**{head}** — WhatDoTheyKnow · {d.get('AUTHORITY_NAME', '')} · outcome {d.get('OUTCOME', '')}")
                        st.caption((d.get("SNIPPET") or "")[:240])
                    for d in rp["gl"]:
                        url = d.get("SOURCE_URL", "")
                        title = d.get("TITLE", "(untitled)")
                        head = f"[{title}]({url})" if url else title
                        st.markdown(f"**{head}** — GLA · {d.get('REFERENCE_NUMBER', '')}")
                        st.caption((d.get("RESPONSE_TEXT") or "")[:240])
                st.markdown("**Record the outcome and draft the reply to the requester:**")
                d1, d2, d3 = st.columns(3)
                for col, outcome, label in [(d1, "UPHELD", "Uphold"), (d2, "PARTIALLY_UPHELD", "Partially uphold"), (d3, "OVERTURNED", "Overturn")]:
                    if col.button(label, key=f"ir_{r['REVIEW_ID']}_{outcome}"):
                        with st.spinner("Drafting the review outcome letter with Cortex..."):
                            gctx = []
                            for d in rp["gl"]:
                                gctx.append(f"[GLA {d.get('REFERENCE_NUMBER', '')}]: {(d.get('RESPONSE_TEXT') or '')[:600]}")
                            for d in rp["wd"]:
                                gctx.append(f"[WhatDoTheyKnow, {d.get('AUTHORITY_NAME', '')}, outcome {d.get('OUTCOME', '')}]: {(d.get('SNIPPET') or '')[:400]}")
                            gtext = "\n".join(gctx)[:3000]
                            prompt = (
                                f"You are a senior FOI officer at {_shared.council_name()} conducting an internal review. "
                                f"Write a professional outcome letter to the requester. Outcome: {OUTCOME_LABEL[outcome]}. "
                                f"Reference the review rights and, if not fully resolved, the right to complain to the Information "
                                f"Commissioner. Where comparable decisions by other authorities support the reasoning, you may cite "
                                f"them in square brackets. Do not invent facts; use [PLACEHOLDER] where case specifics are needed.\n\n"
                                f"ORIGINAL REQUEST:\n{r['REQUEST_TEXT']}\n\nREQUESTER'S GROUNDS:\n{r['OUTCOME_NOTE'] or 'Not stated'}\n\n"
                                f"COMPARABLE DECISIONS BY OTHER AUTHORITIES:\n{gtext or 'None retrieved'}\n\nLetter:"
                            )
                            letter = session.sql(f"SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '{esc(prompt)}') R").to_pandas().iloc[0]["R"]
                        session.sql(f"""UPDATE {SCHEMA}.FOI_INTERNAL_REVIEW
                            SET OUTCOME='{outcome}', COMPLETED_DATE=CURRENT_DATE(), OUTCOME_NOTE='{esc(letter)}'
                            WHERE REVIEW_ID='{r['REVIEW_ID']}'""").collect()
                        st.rerun()
            else:
                st.markdown("**Review outcome letter** (sent to the requester):")
                st.text_area("Letter", r["OUTCOME_NOTE"] or "", height=220, key=f"irl_{r['REVIEW_ID']}")
                st.download_button(":material/download: Download letter", r["OUTCOME_NOTE"] or "",
                                   file_name=f"{r['REFERENCE']}_review_outcome.txt", key=f"ird_{r['REVIEW_ID']}")

with tab_ico:
    st.caption("Complaints are lodged by the requester via the ICO online portal. The authority responds to the ICO's investigation "
               "by submitting the full case history. Generate that submission pack below.")
    ico = session.sql(f"""
        SELECT i.*, c.REFERENCE, c.REGIME, c.SUBJECT, c.CASE_ID AS C_CASE_ID
        FROM {SCHEMA}.FOI_ICO_COMPLAINT i JOIN {SCHEMA}.FOI_CASE c ON c.CASE_ID=i.CASE_ID
        ORDER BY i.RECEIVED_DATE DESC
    """).to_pandas()
    if ico.empty:
        st.caption("No ICO complaints. Generate one from the Escalations (demo) page.")
    ICO_STATUS = ["OPEN", "UNDER_INVESTIGATION", "UPHELD", "PARTLY_UPHELD", "NOT_UPHELD"]
    for _, r in ico.iterrows():
        with st.container(border=True):
            st.markdown(f"{_shared.regime_badge(r['REGIME'])} **{r['REFERENCE']}** — {r['SUBJECT'] or ''}  ·  ICO ref `{r['ICO_REFERENCE']}`")
            st.markdown(f"Received {r['RECEIVED_DATE']}  ·  Status: :orange-badge[{r['STATUS']}]")
            st.caption(r["NOTE"] or "")

            # Assemble the ICO submission pack from the audit trail
            ev = session.sql(f"""
                SELECT EVENT_TS, ACTOR_TYPE, ACTOR, EVENT_TYPE, FROM_STAGE, TO_STAGE, NOTE
                FROM {SCHEMA}.FOI_CASE_EVENT WHERE CASE_ID='{r['C_CASE_ID']}' ORDER BY EVENT_TS
            """).to_pandas()
            lines = [f"ICO SUBMISSION PACK — {r['REFERENCE']}", f"ICO reference: {r['ICO_REFERENCE']}",
                     f"Subject: {r['SUBJECT'] or ''}", f"Regime: {r['REGIME']}", "",
                     "COMPLAINT GROUNDS:", r["NOTE"] or "—", "", "CASE AUDIT TRAIL:"]
            for _, e in ev.iterrows():
                lines.append(f"- {e['EVENT_TS']:%Y-%m-%d %H:%M} · {e['ACTOR_TYPE']}/{e['ACTOR']} · {e['EVENT_TYPE']} "
                             f"{(e['FROM_STAGE'] or '')}->{(e['TO_STAGE'] or '')} · {e['NOTE'] or ''}")
            pack = "\n".join(lines)
            cpk1, cpk2 = st.columns([1, 2])
            cpk1.download_button(":material/download: ICO submission pack", pack,
                                 file_name=f"{r['REFERENCE']}_ICO_pack.txt", key=f"pack_{r['COMPLAINT_ID']}")

            with st.popover(":material/edit: Record ICO decision"):
                new_status = st.selectbox("Decision / status", ICO_STATUS,
                                          index=ICO_STATUS.index(r["STATUS"]) if r["STATUS"] in ICO_STATUS else 0,
                                          key=f"st_{r['COMPLAINT_ID']}")
                dn_url = st.text_input("Decision Notice URL", r["DECISION_NOTICE_URL"] or "", key=f"dn_{r['COMPLAINT_ID']}")
                if st.button("Save", key=f"sv_{r['COMPLAINT_ID']}"):
                    session.sql(f"""UPDATE {SCHEMA}.FOI_ICO_COMPLAINT
                        SET STATUS='{new_status}', DECISION_NOTICE_URL='{esc(dn_url)}'
                        WHERE COMPLAINT_ID='{r['COMPLAINT_ID']}'""").collect()
                    st.success("Updated."); st.rerun()

with tab_pub:
    st.caption("Proactively publishing responses (s.19 publication scheme) reduces duplicate requests and supports s.21 reuse.")
    pub = session.sql(f"""
        SELECT p.PUBLICATION_DATE, p.REFERENCE_NUMBER, p.TOPIC, p.SUMMARY, p.PUBLISHED_BY
        FROM {SCHEMA}.FOI_DISCLOSURE_PUBLICATION p ORDER BY p.PUBLICATION_DATE DESC
    """).to_pandas()
    st.dataframe(pub, hide_index=True, use_container_width=True,
                 column_config={"PUBLICATION_DATE": st.column_config.DateColumn("Published"),
                                "REFERENCE_NUMBER": "Reference", "TOPIC": "Topic", "SUMMARY": "Summary", "PUBLISHED_BY": "By"})

    st.markdown("**Publish a closed case to the disclosure log**")
    closed = session.sql(f"""
        SELECT REFERENCE FROM {SCHEMA}.FOI_CASE
        WHERE STATUS='CLOSED' AND IS_PUBLISHED=FALSE AND OUTCOME IN ('GRANTED_FULL','GRANTED_PARTIAL')
        ORDER BY CLOSED_DATE DESC
    """).to_pandas()["REFERENCE"].tolist()
    if closed:
        pref = st.selectbox("Closed case", closed)
        topic = st.text_input("Topic", "")
        if st.button(":material/publish: Publish to disclosure log", type="primary"):
            session.sql(f"""INSERT INTO {SCHEMA}.FOI_DISCLOSURE_PUBLICATION (CASE_ID, REFERENCE_NUMBER, PUBLICATION_DATE, TOPIC, SUMMARY, PUBLISHED_BY)
                SELECT CASE_ID, REFERENCE, CURRENT_DATE(), '{topic.replace(chr(39),chr(39)*2)}', LEFT(REQUEST_TEXT,200), 'FOI Officer'
                FROM {SCHEMA}.FOI_CASE WHERE REFERENCE='{pref}'""").collect()
            session.sql(f"UPDATE {SCHEMA}.FOI_CASE SET IS_PUBLISHED=TRUE WHERE REFERENCE='{pref}'").collect()
            st.success(f"{pref} published.")
            st.rerun()
    else:
        st.caption("No eligible closed cases awaiting publication.")
