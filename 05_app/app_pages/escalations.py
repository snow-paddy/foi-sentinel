"""Escalations (demo) — simulate a requester escalating a closed case to internal review or the ICO.
Synthetic test data: populates the Reviews & ICO oversight queue for demonstration.
"""
import streamlit as st
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA


def esc(t):
    return (t or "").replace("'", "''").replace("\\", "\\\\")


st.title(":material/trending_up: Escalations (demo)")
st.caption("Where a request goes after a response: the requester may ask for an internal review and, if still dissatisfied, "
           "complain to the Information Commissioner. Use this to generate synthetic escalations so the Reviews & ICO queue is populated.")
st.info(":material/science: Escalations created here are **synthetic test data** for demonstration; they do not represent real requesters.")

with st.container(border=True):
    st.markdown("##### :material/route: The escalation route")
    e1, e2, e3 = st.columns(3)
    e1.markdown("**1 · Response issued**\n\nThe council answers within the statutory deadline.")
    e2.markdown("**2 · Internal review**\n\nRequester dissatisfied → asks for a review by a different, more senior officer (target 20 working days).")
    e3.markdown("**3 · ICO complaint (s.50)**\n\nStill dissatisfied → complains to the Commissioner, who can issue a binding Decision Notice.")

st.divider()
st.markdown("##### :material/add_circle: Generate an inbound escalation")

cases = session.sql(f"SELECT REFERENCE, CASE_ID, SUBJECT, STATUS FROM {SCHEMA}.FOI_CASE ORDER BY RECEIVED_DATE DESC").to_pandas()
if cases.empty:
    st.caption("No cases available.")
    st.stop()
labels = {f"{r['REFERENCE']} — {r['SUBJECT'] or 'Untitled'}": r["CASE_ID"] for _, r in cases.iterrows()}

s1, s2 = st.columns(2)
sim_label = s1.selectbox("Against case", list(labels.keys()))
sim_type = s2.selectbox("Escalation type", ["Internal review request", "Information Commissioner complaint (s.50)"])
sim_note = st.text_area("Grounds for the escalation", "Dissatisfied with the exemption applied; the public interest favours disclosure.", height=90)

if st.button(":material/send: Generate escalation", type="primary"):
    cid = labels[sim_label]
    ref = sim_label.split(" — ")[0]
    if sim_type == "Internal review request":
        deadline_sql = (f"(SELECT MIN(c2.CAL_DATE) FROM {SCHEMA}.CALENDAR c2 WHERE c2.IS_WORKING_DAY "
                        f"AND c2.WD_INDEX=(SELECT WD_INDEX FROM {SCHEMA}.CALENDAR WHERE CAL_DATE=CURRENT_DATE())+20)")
        session.sql(f"""INSERT INTO {SCHEMA}.FOI_INTERNAL_REVIEW
            (CASE_ID, REQUESTED_DATE, ORIGINAL_DECISION_BY, REVIEWER, REVIEW_DEADLINE, OUTCOME, OUTCOME_NOTE)
            SELECT '{cid}', CURRENT_DATE(), 'S. Begum', 'D. Marsh (Head of Legal)', {deadline_sql}, 'PENDING', '{esc(sim_note)}'""").collect()
        session.sql(f"CALL {SCHEMA}.SP_ADVANCE_STAGE('{cid}','REVIEW','HUMAN','requester (test)','Internal review requested')").collect()
        session.sql(f"UPDATE {SCHEMA}.FOI_CASE SET STATUS='OPEN' WHERE CASE_ID='{cid}'").collect()
        st.success(f"Internal review created against {ref}. Open **Reviews & ICO** to action it.")
    else:
        ico_ref = f"IC-{__import__('datetime').datetime.now():%y%m%d}-{ref[-4:]}"
        session.sql(f"""INSERT INTO {SCHEMA}.FOI_ICO_COMPLAINT
            (CASE_ID, ICO_REFERENCE, RECEIVED_DATE, STATUS, NOTE)
            SELECT '{cid}', '{ico_ref}', CURRENT_DATE(), 'OPEN', '{esc(sim_note)}'""").collect()
        session.sql(f"CALL {SCHEMA}.SP_ADVANCE_STAGE('{cid}','REVIEW','HUMAN','requester (test)','ICO complaint lodged')").collect()
        session.sql(f"UPDATE {SCHEMA}.FOI_CASE SET STATUS='OPEN' WHERE CASE_ID='{cid}'").collect()
        st.success(f"Commissioner complaint {ico_ref} created against {ref}. Open **Reviews & ICO** to action it.")
    st.cache_data.clear()
