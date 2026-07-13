"""Triage Learning — confidence routing + human-in-the-loop learning + a real fine-tune."""
import json
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from app_pages import _shared

session = _shared.get_session()
_shared.inject_css()
SCHEMA = _shared.SCHEMA
cfg = _shared.get_config()
threshold = float(cfg.get("AUTO_ACCEPT_THRESHOLD", "0.90"))
RED, AMBER, GREEN, BLUE = "#d4351c", "#f47738", "#00703c", "#1d70b8"

st.title(":material/model_training: Triage Learning")
st.caption("How the system triages intelligently, routes by confidence, and improves from human-in-the-loop corrections — "
           "demonstrated with a genuine Snowflake Cortex fine-tune.")

# ---- 1. Confidence routing ----
st.subheader(":material/alt_route: Confidence-routed triage")
st.markdown(f"""
Every incoming request is classified by Cortex. The model's **confidence** decides the route:
**at or above {int(threshold*100)}%** the triage is **auto-accepted**; **below** it is sent for **human review**.
This focuses officer time on the genuinely uncertain cases — exactly the pattern used on our HM Land Registry project.
""")
routing = session.sql(f"SELECT ROUTED, COUNT(*) N, ROUND(AVG(CONFIDENCE),3) AVG_CONF FROM {SCHEMA}.FOI_TRIAGE GROUP BY ROUTED").to_pandas()
c1, c2 = st.columns([1, 1.3])
with c1:
    auto = int(routing.loc[routing["ROUTED"] == "AUTO", "N"].sum())
    review = int(routing.loc[routing["ROUTED"] == "REVIEW", "N"].sum())
    fig = go.Figure(go.Pie(labels=["Auto-accepted", "Human review"], values=[auto, review], hole=0.6,
                           marker=dict(colors=[GREEN, AMBER]), textinfo="value"))
    fig.update_layout(height=240, margin=dict(l=10, r=10, t=10, b=10), paper_bgcolor="rgba(0,0,0,0)",
                      legend=dict(orientation="h", y=-0.15), font=dict(color="#0b0c0c"))
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
with c2:
    st.markdown("**Confidence distribution**")
    conf = session.sql(f"SELECT CONFIDENCE FROM {SCHEMA}.FOI_TRIAGE WHERE CONFIDENCE IS NOT NULL").to_pandas()
    fig = px.histogram(conf, x="CONFIDENCE", nbins=12)
    fig.update_traces(marker_color=BLUE)
    fig.add_vline(x=threshold, line_color=RED, line_width=3, annotation_text=f"auto-accept ≥ {threshold:.2f}")
    fig.update_layout(height=240, margin=dict(l=10, r=10, t=10, b=10), paper_bgcolor="rgba(0,0,0,0)",
                      plot_bgcolor="rgba(0,0,0,0)", font=dict(color="#0b0c0c"))
    fig.update_xaxes(title="model confidence", gridcolor="#e8edf1"); fig.update_yaxes(title="requests", gridcolor="#e8edf1")
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

st.divider()

# ---- 2. HITL learning loop ----
st.subheader(":material/loop: Learning from human decisions")
train_n = session.sql(f"SELECT COUNT(*) N FROM {SCHEMA}.FT_TRIAGE_TRAIN").to_pandas().iloc[0]["N"]
eval_n = session.sql(f"SELECT COUNT(*) N FROM {SCHEMA}.FT_TRIAGE_EVAL").to_pandas().iloc[0]["N"]
m1, m2, m3 = st.columns(3)
m1.metric("Labelled training examples", int(train_n))
m2.metric("Held-out evaluation set", int(eval_n))
m3.metric("Auto-accept threshold", f"{int(threshold*100)}%")
st.markdown("""
When an officer **approves, corrects or declines** an AI triage, that decision becomes a **labelled example**.
Those labels (with deliberate class balance — including the hard, low-confidence cases) are exactly what a
**fine-tune** learns from. On HM Land Registry we proved the lesson: *curated, class-balanced labels beat both
raw volume and clever prompting* — so the human-in-the-loop corrections are the most valuable asset the system builds.
""")

st.divider()

# ---- 3. Real fine-tune: base vs tuned ----
st.subheader(":material/science: Does fine-tuning help? — a real Cortex fine-tune")
job = session.sql(f"SELECT JOB_ID FROM {SCHEMA}.FT_TRIAGE_JOB ORDER BY CREATED_AT DESC LIMIT 1").to_pandas()
job_id = job.iloc[0]["JOB_ID"] if not job.empty else None

compare = pd.DataFrame()
try:
    compare = session.sql(f"SELECT * FROM {SCHEMA}.V_TRIAGE_MODEL_COMPARE ORDER BY MODEL").to_pandas()
except Exception:
    pass

if not compare.empty:
    st.markdown("**Classification accuracy on the held-out set — base model vs fine-tuned**")
    fig = px.bar(compare, x="MODEL", y="ACCURACY", text="ACCURACY", color="MODEL",
                 color_discrete_map={"base (mistral-7b)": "#b1b4b6", "fine-tuned (TRIAGE_TUNED)": GREEN})
    fig.update_traces(texttemplate="%{text:.0%}", textposition="outside")
    fig.update_yaxes(range=[0, 1], tickformat=".0%", title="accuracy"); fig.update_xaxes(title=None)
    fig.update_layout(height=300, margin=dict(l=10, r=10, t=10, b=10), paper_bgcolor="rgba(0,0,0,0)",
                      plot_bgcolor="rgba(0,0,0,0)", showlegend=False, font=dict(color="#0b0c0c"))
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    st.dataframe(compare, hide_index=True, use_container_width=True)
else:
    if job_id:
        try:
            desc = json.loads(session.sql(f"SELECT SNOWFLAKE.CORTEX.FINETUNE('DESCRIBE','{job_id}') S").to_pandas().iloc[0]["S"])
            status = desc.get("status", "?")
            prog = float(desc.get("progress", 0) or 0)
            st.info(f":material/hourglass: Fine-tune **{status}** — base model `{desc.get('base_model')}`, job `{job_id}`.")
            st.progress(min(prog, 1.0), text=f"training progress {prog*100:.0f}%")
            st.caption("When training finishes, this panel shows the base-vs-fine-tuned accuracy comparison on the held-out set.")
        except Exception as e:
            st.caption(f"Fine-tune job status unavailable: {e}")
    else:
        st.caption("No fine-tune job found.")

st.divider()

# ---- 4. Drafting evaluation gold-set (GLA) ----
st.subheader(":material/fact_check: Drafting evaluation gold-set")
st.markdown("""
The point of the AI tester is to **cut through verbose, unsourced AI** — so we measure drafts
against **real published responses**. The GLA disclosure log gives clean request→response pairs:
a held-out **gold-set** for scoring a generated draft on **conciseness** (length against the real
reply) and whether it stays **grounded**. This is a test-time harness, not production behaviour.
""")
try:
    gp = session.sql(f"SELECT COUNT(*) PAIRS, ROUND(AVG(GOLD_LEN)) AVG_LEN FROM {SCHEMA}.GLA_EVAL_PAIRS").to_pandas()
    pairs_n = int(gp.iloc[0]["PAIRS"]); gold_avg = int(gp.iloc[0]["AVG_LEN"] or 0)
except Exception:
    pairs_n, gold_avg = 0, 0

if pairs_n == 0:
    st.caption("No evaluation pairs yet. Run the GLA scraper from Settings to populate the gold-set.")
else:
    e1, e2 = st.columns(2)
    e1.metric("Gold-set pairs (GLA)", pairs_n)
    e2.metric("Avg real response length", f"{gold_avg:,} chars")
    pairs = session.sql(f"""SELECT REFERENCE_NUMBER, TITLE, REQUEST, GOLD_RESPONSE, GOLD_LEN
                            FROM {SCHEMA}.GLA_EVAL_PAIRS ORDER BY RESPONSE_DATE DESC LIMIT 25""").to_pandas()
    labels = [f"{r.REFERENCE_NUMBER} — {r.TITLE[:60]}" for r in pairs.itertuples()]
    pick = st.selectbox("Evaluate a sample", options=list(range(len(labels))),
                        format_func=lambda i: labels[i], key="eval_pick")
    if st.button(":material/play_arrow: Draft from the request and score it", key="eval_run"):
        row = pairs.iloc[pick]
        prompt = (f"You are an FOI officer at {_shared.council_name()}. Draft a concise, professional "
                  f"response to the request below. Be specific and do not pad.\n\nREQUEST:\n{row['REQUEST']}\n\nResponse:")
        esc = prompt.replace("'", "''")
        with st.spinner("Drafting and scoring..."):
            draft = session.sql(f"SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '{esc}') R").to_pandas().iloc[0]["R"] or ""
        gold = row["GOLD_RESPONSE"] or ""
        ratio = (len(draft) / len(gold)) if gold else 0
        verdict = ("more concise than the real reply" if ratio <= 1.0
                   else f"{ratio:.1f}× longer than the real reply — tighten before use")
        s1, s2, s3 = st.columns(3)
        s1.metric("Draft length", f"{len(draft):,}")
        s2.metric("Real reply length", f"{len(gold):,}")
        s3.metric("Conciseness ratio", f"{ratio:.2f}×")
        (st.success if ratio <= 1.0 else st.warning)(f"Generated draft is {verdict}.")
        gcol, dcol = st.columns(2)
        gcol.markdown("**Real GLA response (gold)**"); gcol.text_area("gold", gold, height=240, key="eval_gold", label_visibility="collapsed")
        dcol.markdown("**Generated draft**"); dcol.text_area("draft", draft, height=240, key="eval_draft", label_visibility="collapsed")
        st.caption("Conciseness is a proxy metric; a production harness would add grounded-accuracy scoring "
                   "(does every claim trace to the request or a cited precedent?). This is the path to ROADMAP item 2.")

st.divider()

st.markdown("""
**Training and data residency:** the model is fine-tuned with `SNOWFLAKE.CORTEX.FINETUNE`
on this account (AWS US-West, a supported fine-tuning region) over a labelled, class-balanced
sample of the request corpus. For a UK production deployment the equivalent pattern is to
**fine-tune in the EEA (Frankfurt), replicate the model to London, and run inference in-region**,
keeping data within the residency boundary.
""")
