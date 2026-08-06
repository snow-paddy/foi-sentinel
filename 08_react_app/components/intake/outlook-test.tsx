"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { runJob, JobLostError } from "@/lib/job-client"
import {
  Inbox, Mail, Loader2, RefreshCw, Play, CheckCircle2, AlertTriangle,
  ArrowRight, Sparkles, Star, Lightbulb, Gavel, FileText, Cloud, ChevronDown, ExternalLink,
} from "lucide-react"

type Message = {
  id: string; sender: string; senderEmail: string
  subject: string; received: string; preview: string; body: string
}
type Source = { tag: string; origin: string; title: string; url: string; snippet: string }
type Pipeline = {
  classification: string
  triage: { category: string; priority: string; complexity: number | null; departments: string[]; estimatedHours: number | null; isVexatious: boolean; summary: string } | null
  precedents: Source[]
  answer: string
  answerGrounded: boolean
  evaluation: { groundedness: number | null; coverage: number | null; verdict: string | null } | null
  draft: string
  benchmark: { comparability: number | null; verdict: string | null; rationale: string; peerAuthority: string; peerTitle: string; peerUrl: string } | null
}
type NewCase = { reference: string; subject: string; sender: string }

type Step = {
  n: number; title: string; blurb: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  code: string; tunable: string[]
}

const STEPS: Step[] = [
  { n: 1, title: "Intake & classification", icon: Inbox,
    blurb: "The email is read from the mailbox over Microsoft Graph, landed in Snowflake and typed as FOI, EIR or SAR.",
    code: `CALL SP_POLL_OUTLOOK_INBOX();              -- Graph API → land raw email
SELECT AI_PARSE_DOCUMENT(...);             -- attachments → text
CALL SP_TRIAGE_CASE(:case_id);             -- same triage as below`,
    tunable: ["Which mailbox(es) to poll and how often", "Regime rules (keywords / classifier) for FOI vs EIR vs SAR", "Whether new cases auto-draft on arrival or wait for an officer"] },
  { n: 2, title: "Triage", icon: Sparkles,
    blurb: "Purpose-built Cortex AI SQL runs per request: SENTIMENT (tone), AI_CLASSIFY (FOI/EIR/SAR regime), AI_FILTER (s.14 vexatious), AI_EXTRACT (scope: dates, departments, records), and COMPLETE for the narrative detail.",
    code: `-- SP_TRIAGE_CASE: purpose-built Cortex AI SQL
SNOWFLAKE.CORTEX.SENTIMENT(request_text)          -- requester tone
AI_CLASSIFY(request_text, ['FOI','EIR','SAR','BAU'])   -- regime label
AI_FILTER('...vexatious under s.14? ' || request_text) -- boolean flag
AI_EXTRACT(request_text, {date_range, departments, documents})
SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', ...)  -- priority, effort, summary
-- -> FOI_TRIAGE.TRIAGE_JSON`,
    tunable: ["AUTO_ACCEPT_THRESHOLD (auto-accept vs route to review)", "Complexity bands that drive the Focus lanes", "Regime label set and vexatious wording"] },
  { n: 3, title: "Precedent match", icon: Star,
    blurb: "The request is matched against prior requests across WhatDoTheyKnow, GLA, Camden and council policy. AI_SIMILARITY scores the closest clean match (the star NN% on each card) and, against the council's own published corpus, auto-flags a likely s.21 duplicate.",
    code: `-- lib/queries.ts * retrieval + board match + s.21 check
cortexSearch("WDTK_PRECEDENT_SEARCH", q, ...)   // + GLA, Camden,
cortexSearch("COUNCIL_POLICY_SEARCH", q, ...)   //   policy, Brentwood
AI_SIMILARITY(request_text, prior_request)      // -> star NN% match
AI_SIMILARITY(request_text, own_published)      // -> s.21 reuse >= 85%`,
    tunable: ["Similarity threshold for a 'quick win'", "Which corpora rank first (own successful replies vs external)"] },
  { n: 4, title: "Suggested answer", icon: Lightbulb,
    blurb: "A grounded answer is drafted from the retrieved sources, with inline [S#] citations to those sources.",
    code: `SNOWFLAKE.CORTEX.COMPLETE('mistral-large2',
  "Use ONLY the sources below; cite them inline as [S1], [S2]...
   Do not invent facts. Keep it to 120-200 words.")`,
    tunable: ["Which corpora are searched", "Answer length and citation style", "Grounding model"] },
  { n: 5, title: "Evaluation", icon: Gavel,
    blurb: "An LLM-as-judge scores the answer for groundedness (claims trace to a source) and coverage (it answers the request).",
    code: `COMPLETE('mistral-large2',
 "Score 0-1: groundedness + coverage. Return strict JSON
  {groundedness, coverage, verdict:'PASS|WEAK|FAIL', notes}.")`,
    tunable: ["Pass / weak / fail bands", "Judge model (can differ from the drafting model)", "What a failing case triggers"] },
  { n: 6, title: "Compiled draft", icon: FileText,
    blurb: "A ready-to-send response carrying the statutory essentials (s.17 exemption statement, internal-review right, ICO route).",
    code: `-- SP_GENERATE_RESPONSE (simplified, plain-message)
"...state which exemption(s) apply + public-interest balance;
  ALWAYS include internal review + ICO route. Plain text only."`,
    tunable: ["Council name / sign-off (COUNCIL_CONFIG)", "Tone and required statutory paragraphs", "Drafting model"] },
]

function fmtDate(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  return isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function OutlookTest({ mailbox }: { mailbox: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [peeking, setPeeking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [running, setRunning] = useState(false)
  const [revealed, setRevealed] = useState(0)
  const [caseRef, setCaseRef] = useState<string | null>(null)
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [openStep, setOpenStep] = useState<number | null>(null)
  const [openMsg, setOpenMsg] = useState<string | null>(null)

  const peek = useCallback(async () => {
    setPeeking(true); setError(null)
    try {
      const res = await fetch("/api/intake/peek", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.error ?? "Could not read the mailbox"); setMessages([]); return }
      setMessages(data.messages ?? [])
    } catch { setError("Could not reach the mailbox endpoint"); setMessages([]) }
    finally { setPeeking(false) }
  }, [])

  useEffect(() => { peek() }, [peek])

  async function runPipeline() {
    setRunning(true); setError(null); setNote(null); setPipeline(null); setCaseRef(null); setRevealed(0); setStage(null)

    // Parse JSON defensively: a gateway error page is HTML, and res.json() would throw.
    const readJson = async (res: Response): Promise<Record<string, unknown> | null> => {
      try { return (await res.json()) as Record<string, unknown> } catch { return null }
    }

    // The poll marks mail as read as it goes, so a run we lose track of may still
    // have produced a real, triaged case. Find it rather than dead-ending.
    const recoverCase = async (): Promise<string | null> => {
      try {
        const latestRes = await fetch("/api/intake/latest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ withinMinutes: 20 }) })
        const latest = await readJson(latestRes)
        const found = latest?.case as { reference?: string } | null | undefined
        return found?.reference ?? null
      } catch { return null }
    }

    let ref: string | null = null
    try {
      // Step 1 — submit the mailbox poll, then poll for the job. Every request is
      // short, so the work can take as long as it needs without the 90-second
      // SPCS ingress limit cutting it off mid-run.
      try {
        const sync = await runJob<{ polled?: number; newCases?: NewCase[] }>("/api/intake/sync", {}, {
          onStage: (s) => setStage(`Intake — ${s}`),
        })
        const cases = sync.newCases ?? []
        if (!cases.length) {
          setNote(`Polled ${sync.polled ?? 0} email(s). No new cases (already ingested). Send a fresh email and try again.`)
          setRunning(false); setStage(null); peek(); return
        }
        ref = cases[0].reference
      } catch (e) {
        // Only recover when we have genuinely lost track of the run. A reported
        // failure (e.g. Graph refused) is conclusive, and recovering from it would
        // risk presenting an unrelated earlier case as this run's result.
        if (e instanceof JobLostError) {
          setNote("Lost track of the mailbox poll. Checking whether a case was created…")
          ref = await recoverCase()
          if (ref) setNote(`Recovered case ${ref} — the poll had completed. Continuing the pipeline.`)
        } else {
          const msg = e instanceof Error ? e.message : String(e)
          setError(`Mailbox sync failed: ${msg}`)
          setRunning(false); setStage(null); peek(); return
        }
      }

      if (!ref) {
        setError("Mailbox poll did not complete and no new case was found. The poll can take over a minute; wait a moment and try again.")
        setRunning(false); setStage(null); peek(); return
      }

      setCaseRef(ref)
      setRevealed(1) // intake done

      // Step 2 — submit the downstream pipeline and follow its reported stages.
      const pipe = await runJob<Pipeline>("/api/intake/pipeline", { reference: ref }, {
        onStage: (s) => setStage(`Pipeline — ${s}`),
      })
      setPipeline(pipe)
      setStage(null)

      // Notebook-style progressive reveal of stages 2..6.
      for (let n = 2; n <= 6; n++) { await sleep(750); setRevealed(n) }
      peek()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(ref
        ? `Pipeline step failed for ${ref}: ${msg}. The case exists — open it and use "Suggest an answer" to continue.`
        : `Intake failed before a case was created: ${msg}`)
    } finally {
      setRunning(false)
      setStage(null)
    }
  }

  const waiting = messages ?? []
  const hasMail = waiting.length > 0

  function stageState(n: number): "idle" | "running" | "done" {
    if (revealed >= n) return "done"
    if (running && n === revealed + 1) return "running"
    return "idle"
  }

  return (
    <div className="space-y-5">
      {/* Connection explainer */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Cloud className="size-4" style={{ color: "var(--brand-primary)" }} /> How this connects to Outlook
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Snowflake reads the shared FOI mailbox directly through the Microsoft Graph API using an app-only
          connection secured by an external access integration, with no middleware and no copies of your mail.
          This is exactly how it runs in production against a council&rsquo;s{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">foi@council.gov.uk</code> inbox; here it is
          pointed at the demo mailbox <span className="font-medium text-foreground">{mailbox}</span>. Everything
          below is a live round-trip to that inbox and to Cortex, and nothing is simulated.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--danger)", backgroundColor: "color-mix(in srgb, var(--danger-bg) 25%, transparent)" }}>
          <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: "var(--danger)" }} />
          <span>{error}</span>
        </div>
      )}

      {/* Waiting inbox */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Inbox className="size-4" style={{ color: "var(--brand-primary)" }} /> Waiting to be triaged
            {messages && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{waiting.length}</span>}
          </h2>
          <button onClick={peek} disabled={peeking} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-60">
            {peeking ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Refresh
          </button>
        </div>

        {messages === null ? (
          <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading the mailbox&hellip;</div>
        ) : hasMail ? (
          <ul className="divide-y divide-border">
            {waiting.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{m.subject}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(m.received)}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground"><Mail className="mr-1 inline size-3" /> {m.sender}{m.senderEmail ? ` <${m.senderEmail}>` : ""}</div>
                {m.preview && openMsg !== m.id && <p className="mt-1 line-clamp-2 text-sm text-foreground/70">{m.preview}</p>}
                {openMsg === m.id && <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-3 text-sm text-foreground/80" style={{ fontFamily: "inherit" }}>{m.body || m.preview}</pre>}
                {(m.body || m.preview) && (
                  <button onClick={() => setOpenMsg(openMsg === m.id ? null : m.id)} aria-expanded={openMsg === m.id} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    <ChevronDown className={`size-3.5 transition-transform ${openMsg === m.id ? "rotate-180" : ""}`} /> {openMsg === m.id ? "Hide message" : "Show full message"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <Inbox className="mx-auto mb-2 size-6 opacity-40" />
            No unread mail. Send a test FOI request to <span className="font-medium text-foreground">{mailbox}</span>, then Refresh.
          </div>
        )}

        <div className="border-t border-border px-4 py-3">
          <button onClick={runPipeline} disabled={running || !hasMail} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: "var(--brand-primary)" }}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {running ? "Running the pipeline\u2026" : `Run the pipeline on ${waiting.length || "these"} email${waiting.length === 1 ? "" : "s"}`}
          </button>
          {stage && <p className="mt-2 text-xs" style={{ color: "var(--brand-primary)" }}>{stage}</p>}
          {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
          {!hasMail && !running && !note && <p className="mt-1.5 text-xs text-muted-foreground">The button activates once there is unread mail to process.</p>}
        </div>
      </div>

      {/* Notebook: stages with live output */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold">The pipeline, running live</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Each stage below executes for the new case and shows its real output. Steps 1-2 run on arrival.
          In production, steps 3-6 run as the case is prepared for the officer. Expand any stage for the
          exact SQL or prompt.
        </p>

        <ol className="mt-4 space-y-2.5">
          {STEPS.map((s) => {
            const st = stageState(s.n)
            const isRunning = st === "running"
            const isDone = st === "done"
            return (
              <li key={s.n} className="rounded-lg border p-3 transition-colors"
                  style={{ borderColor: isRunning ? "var(--brand-primary)" : isDone ? "var(--ok)" : "var(--border)",
                           borderLeftWidth: isRunning || isDone ? 3 : 1,
                           backgroundColor: isRunning ? "color-mix(in srgb, var(--brand-primary) 6%, var(--card))" : isDone ? "color-mix(in srgb, var(--ok-bg) 45%, var(--card))" : "var(--card)",
                           opacity: st === "idle" ? 0.7 : 1 }}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isRunning ? <Loader2 className="size-5 animate-spin" style={{ color: "var(--brand-primary)" }} />
                      : isDone ? <CheckCircle2 className="size-5" style={{ color: "var(--ok)" }} />
                      : <s.icon className="size-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold">{s.n} &middot; {s.title}</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.blurb}</p>

                    {isDone && <StageOutput n={s.n} p={pipeline} caseRef={caseRef} />}

                    <button onClick={() => setOpenStep(openStep === s.n ? null : s.n)} aria-expanded={openStep === s.n} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                      <ChevronDown className={`size-3.5 transition-transform ${openStep === s.n ? "rotate-180" : ""}`} /> Under the hood
                    </button>
                    {openStep === s.n && (
                      <div className="mt-2 space-y-2">
                        <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed"><code>{s.code}</code></pre>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tunable in production</p>
                          <ul className="space-y-1">{s.tunable.map((t, i) => <li key={i} className="flex gap-1.5 text-xs text-foreground/80"><span style={{ color: "var(--brand-primary)" }}>&bull;</span> {t}</li>)}</ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {revealed >= 6 && caseRef && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: "var(--ok)", backgroundColor: "color-mix(in srgb, var(--ok-bg) 18%, transparent)" }}>
            <span className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-4" style={{ color: "var(--ok)" }} /> Pipeline complete. Case fully worked-up.</span>
            <Link href={`/cases/${caseRef}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium" style={{ color: "var(--brand-primary)" }}>Open case {caseRef} <ArrowRight className="size-3.5" /></Link>
          </div>
        )}
      </div>
    </div>
  )
}

function Bar({ label, value }: { label: string; value: number | null }) {
  const pct = value == null ? 0 : Math.round(value * 100)
  return (
    <div>
      <div className="flex justify-between text-xs"><span>{label}</span><span className="text-muted-foreground">{value == null ? "—" : `${pct}%`}</span></div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--brand-primary)" }} /></div>
    </div>
  )
}

function StageOutput({ n, p, caseRef }: { n: number; p: Pipeline | null; caseRef: string | null }) {
  const box = "mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground"
  if (n === 1) {
    return <div className={box}>Email read from the mailbox and landed as case <span className="font-semibold">{caseRef}</span>{p?.classification ? <> &middot; classified <span className="font-semibold">{p.classification}</span></> : null}.</div>
  }
  if (!p) return null
  if (n === 2) {
    const t = p.triage
    if (!t) return <div className={box}>Triage not available.</div>
    const chip = (label: string) => <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{label}</span>
    return (
      <div className={box}>
        <div className="flex flex-wrap gap-1.5">
          {chip(`Category ${t.category || "—"}`)}
          {chip(`Priority ${t.priority || "—"}`)}
          {chip(`Complexity ${t.complexity ?? "—"}/10`)}
          {t.estimatedHours != null && chip(`~${t.estimatedHours}h`)}
          {t.isVexatious && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>Possible s.14</span>}
        </div>
        {t.departments.length > 0 && <p className="mt-1.5 text-muted-foreground">Suggested department: {t.departments.join(", ")}</p>}
        {t.summary && <p className="mt-1 text-foreground/80">{t.summary}</p>}
      </div>
    )
  }
  if (n === 3) {
    if (!p.precedents.length) return <div className={box}>No close prior requests found across the corpora.</div>
    const internal = p.precedents.filter((s) => s.origin === "This council's records")
    const external = p.precedents.filter((s) => s.origin !== "This council's records")
    return (
      <div className={box}>
        {internal.length > 0 && (
          <div className="mb-2.5">
            <p className="mb-1.5 font-semibold" style={{ color: "var(--ok)" }}>This council&rsquo;s own records ({internal.length})</p>
            <ul className="space-y-1.5">
              {internal.slice(0, 6).map((s) => (
                <li key={s.tag} className="flex gap-2">
                  <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>{s.tag}</span>
                  <span className="min-w-0"><span className="font-medium">{s.title}</span>{s.snippet && <span className="block text-foreground/75 line-clamp-2">{s.snippet}</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mb-1.5 font-medium text-foreground/80">Peer precedent{external.length ? ` (${external.length})` : ""}</p>
        {external.length === 0 ? <p className="text-muted-foreground">No external precedent cited.</p> : (
        <ul className="space-y-1.5">
          {external.slice(0, 5).map((s) => (
            <li key={s.tag} className="flex gap-2">
              <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] font-semibold">{s.tag}</span>
              <span className="min-w-0">
                <span className="text-muted-foreground">{s.origin}</span> &middot;{" "}
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium" style={{ color: "var(--brand-primary)" }}>{s.title} <ExternalLink className="size-3" /></a> : <span className="font-medium">{s.title}</span>}
                {s.snippet && <span className="block text-foreground/75 line-clamp-2">{s.snippet}</span>}
              </span>
            </li>
          ))}
        </ul>
        )}
      </div>
    )
  }
  if (n === 4) {
    if (!p.answer) return <div className={box}>No suggested answer generated.</div>
    return (
      <div className={box}>
        <p className="whitespace-pre-wrap text-foreground">{p.answer}</p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{p.precedents.some((s) => s.origin === "This council's records") ? "Quotes the council's own records for the figures, with peer precedent cited alongside." : p.answerGrounded ? `Grounded in ${p.precedents.length} cited source${p.precedents.length === 1 ? "" : "s"}.` : "No internal matches, so it flags what needs confirming."}</p>
      </div>
    )
  }
  if (n === 5) {
    const e = p.evaluation
    if (!e) return <div className={box}>Evaluation not available.</div>
    const v = (e.verdict || "").toUpperCase()
    const vColor = v === "PASS" ? { bg: "var(--ok-bg)", fg: "var(--ok)" } : v === "FAIL" ? { bg: "var(--danger-bg)", fg: "var(--danger)" } : { bg: "var(--warn-bg)", fg: "var(--warn-text)" }
    return (
      <div className={box}>
        <div className="space-y-2"><Bar label="Groundedness" value={e.groundedness} /><Bar label="Coverage" value={e.coverage} /></div>
        {v && <span className="mt-2 inline-block rounded-md px-2 py-1 text-[11px] font-semibold" style={{ background: vColor.bg, color: vColor.fg }}>{v}</span>}
      </div>
    )
  }
  if (n === 6) {
    if (!p.draft) return <div className={box}>No draft generated.</div>
    const b = p.benchmark
    const bv = (b?.verdict || "").toUpperCase()
    const bColor = bv === "COMPARABLE" ? { bg: "var(--ok-bg)", fg: "var(--ok)" } : bv === "BELOW" ? { bg: "var(--danger-bg)", fg: "var(--danger)" } : { bg: "var(--warn-bg)", fg: "var(--warn-text)" }
    return (
      <div className={box}>
        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-foreground" style={{ fontFamily: "inherit" }}>{p.draft}</pre>
        {b && (
          <div className="mt-2 rounded-md border border-border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground/80">Benchmark vs real peer disclosure</span>
              {bv && <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: bColor.bg, color: bColor.fg }}>{bv}{b.comparability != null ? ` \u00b7 ${Math.round(b.comparability * 100)}%` : ""}</span>}
            </div>
            {b.rationale && <p className="mt-1 text-foreground/75">{b.rationale}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">Compared against a real published disclosure from {b.peerAuthority}{b.peerTitle ? ` \u2014 \u201c${b.peerTitle}\u201d` : ""}.</p>
          </div>
        )}
        {caseRef && <Link href={`/cases/${caseRef}`} className="mt-2 inline-flex items-center gap-1 font-medium" style={{ color: "var(--brand-primary)" }}>Review &amp; send on the case <ArrowRight className="size-3" /></Link>}
      </div>
    )
  }
  return null
}
