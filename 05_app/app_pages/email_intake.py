"""Email Intake (demo) — compose an email or drop a .eml; it 'arrives' at the FOI
inbox and is auto-triaged. Simulates a council's automated mailbox pipeline.
"""
import json
import email
from email import policy
from datetime import datetime
import streamlit as st
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA
COUNCIL = _shared.council_name()
INBOX = "foi@" + COUNCIL.lower().replace(" ", "").replace("citycouncil", "") + ".gov.uk"
DEMO_FROM_NAME = "Jane Cooper"
DEMO_FROM_ADDR = "j.cooper@example.org"

st.markdown("""
<style>
.email-head { background:#2457d6; color:#fff; padding:11px 16px; font-weight:650; border-radius:12px 12px 0 0;
    display:flex; align-items:center; gap:8px; }
.email-meta { background:#f7f8fa; padding:9px 16px; border:1px solid #e7eaee; border-top:none;
    display:flex; gap:10px; align-items:center; font-size:0.9rem; }
.email-meta:last-of-type { border-radius:0 0 12px 12px; margin-bottom:10px; }
.email-meta .lbl { color:#98a2b3; font-weight:600; min-width:42px; text-transform:uppercase;
    font-size:0.72rem; letter-spacing:0.04em; }
.email-meta .val { color:#101828; font-weight:600; }
</style>
""", unsafe_allow_html=True)

st.title(":material/mail: Email Intake (demo)")
st.caption("Testing harness — write, generate or drop an email; it 'arrives' at the FOI inbox and is analysed. No real email is sent.")
st.info(":material/science: Cases created here (compose, generate or .eml upload) are **synthetic test data**, flagged and kept separate from the real corpus (54 seeded cases + the Camden response library).")

with st.container(border=True):
    st.markdown("##### :material/precision_manufacturing: How this works in production")
    st.markdown(f"""
A real council does **not** key requests in by hand. The FOI shared mailbox (`{INBOX}`) feeds an automated pipeline:

1. **Shared mailbox** → **Microsoft Graph API / Power Automate** (or AWS SES, Gmail API) watches for new mail
2. New emails (+ attachments) land in a **Snowflake stage** as `.eml` files
3. **Snowpipe** auto-ingests them; a **task** parses sender/subject/body and runs **Cortex triage**
4. Each becomes a **case** on the board, already classified with the statutory clock started

This page simulates steps 3–4. `.eml` is the standard export from Outlook ("Save as") and Gmail ("Download message").
""")


def esc(t):
    return (t or "").replace("'", "''").replace("\\", "\\\\")


def build_eml(name, sender, subject, body):
    return (f"From: {name} <{sender}>\nTo: {INBOX}\nSubject: {subject}\n"
            f"Date: {datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0100')}\n"
            f"Message-ID: <{datetime.now():%Y%m%d%H%M%S}@demo>\nContent-Type: text/plain; charset=\"utf-8\"\n\n{body}\n")


def parse_eml(raw: bytes):
    msg = email.message_from_bytes(raw, policy=policy.default)
    sender = msg.get("from", "")
    subject = msg.get("subject", "")
    date = msg.get("date", "")
    try:
        part = msg.get_body(preferencelist=("plain", "html"))
        body = part.get_content() if part else ""
    except Exception:
        b = msg.get_payload(decode=True)
        body = b.decode("utf-8", "ignore") if isinstance(b, bytes) else str(b)
    name = sender.split("<")[0].strip().strip('"') if sender else ""
    return name, sender, subject, date, (body or "").strip()


def run_triage(full):
    sent = float(session.sql(f"SELECT SNOWFLAKE.CORTEX.SENTIMENT('{esc(full)}') S").to_pandas().iloc[0]["S"])
    prompt = ("You are an expert UK local-government FOI officer. Return JSON only with keys: "
              "category (FOI/EIR/SAR/BAU), priority (HIGH/MEDIUM/LOW), complexity_score (1-10), "
              "suggested_exemptions (array), suggested_departments (array), estimated_hours (number), "
              "is_vexatious (boolean), summary (1 sentence), justification (2-3 sentences). REQUEST: " + full + " JSON only.")
    raw = session.sql(f"SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '{esc(prompt)}') R").to_pandas().iloc[0]["R"]
    if "```" in raw:
        raw = raw.split("```")[1]
        raw = raw[4:] if raw.startswith("json") else raw
    try:
        return sent, json.loads(raw.strip())
    except Exception:
        return sent, None


def create_case(name, subject, body, sent, cl):
    regime = cl.get("category", "FOI")
    pref = {"EIR": "EIR", "SAR": "SAR"}.get(regime, "FOI")
    ref = f"{pref}-{datetime.now():%Y}-E{datetime.now():%m%d%H%M%S}"
    dept = esc((cl.get("suggested_departments") or [""])[0])
    title = esc((cl.get("summary") or subject or "Request")[:80])
    try:
        cx = float(cl.get("complexity_score") or 5)
    except (TypeError, ValueError):
        cx = 5.0
    deadline_sql = (f"(SELECT MIN(c2.CAL_DATE) FROM {SCHEMA}.CALENDAR c2 WHERE c2.IS_WORKING_DAY "
                    f"AND c2.WD_INDEX=(SELECT WD_INDEX FROM {SCHEMA}.CALENDAR WHERE CAL_DATE=CURRENT_DATE())+20)")
    session.sql(f"""
        INSERT INTO {SCHEMA}.FOI_CASE (REFERENCE, SOURCE, REQUESTER_NAME, REQUEST_TEXT, RECEIVED_DATE,
            REGIME, CURRENT_STAGE, STATUS, OWNING_DEPARTMENT, STATUTORY_DEADLINE, CLOCK_STATE, SENTIMENT_SCORE,
            COMPLEXITY_RANK, IS_VEXATIOUS, SUBJECT, IS_SYNTHETIC)
        SELECT '{ref}','EMAIL','{esc(name)}','{esc(subject + chr(10)+chr(10) + body)}',CURRENT_DATE(),
               '{regime}','CLASSIFY','OPEN','{dept}',{deadline_sql},'RUNNING',{sent},
               {cx},{bool(cl.get('is_vexatious'))},'{title}',TRUE
    """).collect()
    nid = session.sql(f"SELECT CASE_ID FROM {SCHEMA}.FOI_CASE WHERE REFERENCE='{ref}'").to_pandas().iloc[0]["CASE_ID"]
    session.sql(f"INSERT INTO {SCHEMA}.FOI_TRIAGE (CASE_ID,TRIAGE_JSON,COMPUTED_AT) SELECT '{nid}',PARSE_JSON('{esc(json.dumps(cl))}'),CURRENT_TIMESTAMP()").collect()
    session.sql(f"INSERT INTO {SCHEMA}.FOI_CASE_EVENT (CASE_ID,TO_STAGE,ACTOR_TYPE,ACTOR,EVENT_TYPE,NOTE) SELECT '{nid}','CLASSIFY','AI','mistral-large2','DECISION','Auto-triage from email intake'").collect()
    st.cache_data.clear()
    st.session_state["selected_case"] = ref
    return ref


def show_triage(name, subject, body, sent, cl):
    st.markdown("##### :material/smart_toy: AI triage")
    m1, m2, m3, m4 = st.columns(4)
    m1.markdown("**Regime**"); m1.markdown(_shared.regime_badge(cl.get("category", "FOI")))
    m2.markdown("**Priority**"); m2.markdown(f":orange-badge[{cl.get('priority','MEDIUM')}]")
    m3.markdown("**Sentiment**"); m3.markdown(_shared.sentiment_badge(sent))
    m4.metric("Est. hours", cl.get("estimated_hours", "?"))
    if cl.get("category") == "EIR":
        st.info(":material/eco: Environmental information (EIR 2004) — no cost limit; up to 40 WD for complex requests.")
    if cl.get("category") == "SAR":
        st.warning(":material/person: Looks like a Subject Access Request — handle under DPA 2018 (one month), not FOI.")
    st.info(f":material/lightbulb: {cl.get('summary','')}")
    st.caption(cl.get("justification", ""))
    if cl.get("suggested_departments"):
        st.markdown("**Route to:** " + ", ".join(cl["suggested_departments"]))
    if st.button(":material/add: Create case", type="primary", key="create_from_triage"):
        ref = create_case(name, subject, body, sent, cl)
        st.success(f"Case {ref} created from the email and triaged. Open it from the **Cases** page.")


SAMPLE_BODY = ("Dear " + COUNCIL + ",\n\nUnder the Freedom of Information Act 2000, please provide the total amount spent "
               "on home-to-school transport for children with special educational needs (SEND) in each of the last three "
               "financial years, broken down by in-house vs external provision and the number of pupils transported.\n\n"
               "If any part would exceed the cost limit, please advise how I could narrow it.\n\nYours faithfully,\nJane Cooper")

TONES = {
    "Hostile": "angry, confrontational and accusatory, while staying printable",
    "Frustrated": "impatient and frustrated but civil",
    "Neutral": "neutral and businesslike",
    "Polite": "polite and courteous",
    "Appreciative": "warm and appreciative",
}


def _generate_into_preview(tone, seed_topic):
    """Generate a synthetic FOI request at the chosen tone and write it into the
    email preview fields. Runs as an on_click callback (before widgets instantiate),
    so it can set the widget-keyed session_state safely."""
    topic = ""
    if seed_topic:
        try:
            topic = session.sql(f"SELECT DOCUMENT_TITLE FROM {SCHEMA}.CAMDEN_FOI_RESPONSES "
                                f"WHERE DOCUMENT_TITLE IS NOT NULL ORDER BY RANDOM() LIMIT 1").to_pandas().iloc[0]["DOCUMENT_TITLE"]
        except Exception:
            topic = ""
    tclause = (f"about this topic: {topic}." if topic
               else "about a realistic UK local-government matter (planning, council tax, social care, waste, highways).")
    gprompt = (f"Write the body of a realistic Freedom of Information request email to a UK council, {tclause} "
               f"The tone must be {TONES[tone]}. 60 to 120 words, no placeholders. "
               f"After the body, add a final line starting 'SUBJECT:' with a short email subject line.")
    raw = session.sql(f"SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '{esc(gprompt)}') R").to_pandas().iloc[0]["R"]
    subj, bodytext = "Freedom of Information request", raw.strip()
    if "SUBJECT:" in raw:
        head, _, tail = raw.partition("SUBJECT:")
        bodytext = head.strip()
        subj = tail.strip().splitlines()[0].strip().strip('"') or subj
    st.session_state["compose_subject"] = subj
    st.session_state["compose_body"] = bodytext
    st.session_state["compose_tone"] = tone


tab_compose, tab_upload = st.tabs([":material/edit: Compose email", ":material/upload_file: Upload .eml"])

with tab_compose:
    if "compose_subject" not in st.session_state:
        st.session_state["compose_subject"] = "Freedom of Information request — SEND school transport spend"
    if "compose_body" not in st.session_state:
        st.session_state["compose_body"] = SAMPLE_BODY

    # Email preview: fixed From/To header, editable Subject + Message
    st.markdown(f'<div class="email-head">✉ New message</div>'
                f'<div class="email-meta"><span class="lbl">From</span>'
                f'<span class="val">{DEMO_FROM_NAME} &lt;{DEMO_FROM_ADDR}&gt;</span></div>'
                f'<div class="email-meta"><span class="lbl">To</span>'
                f'<span class="val">{INBOX}</span></div>', unsafe_allow_html=True)
    st.caption("From and To are fixed for this demo inbox. This is the email preview — edit it, or generate it with AI below, then send or export.")
    csubj = st.text_input("Subject", key="compose_subject")
    cbody = st.text_area("Message", key="compose_body", height=240)
    sender_addr = DEMO_FROM_ADDR
    sender_name = DEMO_FROM_NAME

    tcol, scol = st.columns([3, 2])
    gtone = tcol.select_slider("AI tone", options=list(TONES.keys()),
                               value=st.session_state.get("compose_tone", "Neutral"))
    seed_topic = scol.checkbox("Seed topic from Camden", value=True)

    a1, a2, a3 = st.columns(3)
    a1.button(":material/auto_awesome: Generate with AI", use_container_width=True, key="gen_req",
              on_click=_generate_into_preview, args=(gtone, seed_topic))
    if a2.button(":material/send: Send to FOI inbox", type="primary", use_container_width=True):
        with st.spinner("Email received at the FOI inbox — analysing with Cortex..."):
            sent, cl = run_triage(f"{csubj}\n\n{cbody}")
        if cl:
            st.session_state["compose_triage"] = (sender_name, csubj, cbody, sent, cl)
        else:
            st.error("Could not parse the AI classification — try again.")
    a3.download_button(":material/download: Generate .eml", build_eml(sender_name, sender_addr, csubj, cbody),
                       file_name="foi_request.eml", mime="message/rfc822", use_container_width=True)
    st.caption("Generate fills the preview above (synthetic test data); review it, then Send to FOI inbox or export as .eml."
               + (f"  Last generated tone: **{st.session_state['compose_tone']}**." if st.session_state.get("compose_tone") else ""))

    if st.session_state.get("compose_triage"):
        st.divider()
        show_triage(*st.session_state["compose_triage"])

with tab_upload:
    st.download_button(":material/download: Download a sample .eml to test", build_eml("Jane Cooper", "j.cooper@example.org",
                       "Freedom of Information request - school transport spend", SAMPLE_BODY),
                       file_name="sample_foi_request.eml", mime="message/rfc822")
    up = st.file_uploader("Drop an .eml file here", type=["eml", "txt", "msg"])
    if up is not None:
        name, sender, subject, date, body = parse_eml(up.getvalue())
        st.markdown("##### :material/markunread_mailbox: Extracted from email")
        a, b = st.columns(2)
        a.markdown(f"**From:** {sender or '—'}")
        a.markdown(f"**Subject:** {subject or '—'}")
        b.markdown(f"**Received:** {date or '—'}")
        with st.container(border=True):
            st.markdown("**Body**"); st.markdown(body or "_(empty)_")
        if st.button(":material/bolt: Auto-triage this email", type="primary"):
            with st.spinner("Analysing with Cortex..."):
                sent, cl = run_triage(f"{subject}\n\n{body}")
            if cl:
                st.session_state["upload_triage"] = (name, subject, body, sent, cl)
        if st.session_state.get("upload_triage"):
            st.divider()
            show_triage(*st.session_state["upload_triage"])
