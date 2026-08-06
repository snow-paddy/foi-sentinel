"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Sparkles, Send, Loader2, ScanSearch, CheckCircle2, Trash2, AlertTriangle,
} from "lucide-react"
import type { CaseTriage } from "@/lib/queries"
import { TriagePanel } from "@/components/case/triage-panel"

const TONES = ["Hostile", "Frustrated", "Neutral", "Polite", "Appreciative"] as const

const SAMPLE_BODY =
  "Dear Council,\n\nUnder the Freedom of Information Act 2000, please provide the total amount spent on " +
  "home-to-school transport for children with special educational needs (SEND) in each of the last three " +
  "financial years, broken down by in-house vs external provision and the number of pupils transported.\n\n" +
  "If any part would exceed the cost limit, please advise how I could narrow it.\n\nYours faithfully,\nJane Cooper"

const FROM_NAME = "Jane Cooper"
const FROM_ADDR = "j.cooper@example.org"

type Busy = "generate" | "triage" | "create" | "clear" | null

export function IntakeComposer({ inbox }: { inbox: string }) {
  const [subject, setSubject] = useState("Freedom of Information request: SEND school transport spend")
  const [body, setBody] = useState(SAMPLE_BODY)
  const [tone, setTone] = useState<(typeof TONES)[number]>("Neutral")
  const [seedTopic, setSeedTopic] = useState(true)
  const [triage, setTriage] = useState<CaseTriage | null>(null)
  const [createdRef, setCreatedRef] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [cleared, setCleared] = useState<number | null>(null)

  async function post<T>(url: string, payload?: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || "Request failed")
    return data as T
  }

  async function onGenerate() {
    setBusy("generate"); setError(null)
    try {
      const d = await post<{ subject: string; body: string }>("/api/intake/generate", { tone, seedTopic })
      setSubject(d.subject); setBody(d.body); setTriage(null); setCreatedRef(null)
    } catch (e) { setError(msg(e)) } finally { setBusy(null) }
  }

  async function onSend() {
    setBusy("triage"); setError(null); setCreatedRef(null)
    try {
      const d = await post<{ triage: CaseTriage }>("/api/intake/triage", { subject, body, tone })
      setTriage(d.triage)
    } catch (e) { setError(msg(e)) } finally { setBusy(null) }
  }

  async function onCreate() {
    if (!triage) return
    setBusy("create"); setError(null)
    try {
      const d = await post<{ reference: string }>("/api/intake/create", { subject, body, senderName: FROM_NAME, triage })
      setCreatedRef(d.reference)
    } catch (e) { setError(msg(e)) } finally { setBusy(null) }
  }

  async function onClear() {
    setBusy("clear"); setError(null)
    try {
      const d = await post<{ deleted: number }>("/api/intake/clear")
      setCleared(d.deleted); setTriage(null); setCreatedRef(null)
    } catch (e) { setError(msg(e)) } finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      {/* Email preview */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--brand-primary)" }}>
          ✉ New message
        </div>
        <dl className="divide-y divide-border text-sm">
          <Row label="From">{FROM_NAME} &lt;{FROM_ADDR}&gt;</Row>
          <Row label="To">{inbox}</Row>
        </dl>
        <div className="space-y-3 p-4">
          <div>
            <label htmlFor="subj" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</label>
            <input id="subj" value={subject} onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="msg" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</label>
            <textarea id="msg" value={body} onChange={(e) => setBody(e.target.value)} rows={9}
              className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI tone</label>
        <select value={tone} onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
          {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={seedTopic} onChange={(e) => setSeedTopic(e.target.checked)} />
          Seed topic from Camden corpus
        </label>
        <button type="button" onClick={onGenerate} disabled={busy != null}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:text-foreground disabled:opacity-60">
          {busy === "generate" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Generate with AI
        </button>
        <button type="button" onClick={onSend} disabled={busy != null}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--brand-primary)" }}>
          {busy === "triage" ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
          Analyse message
        </button>
      </div>

      {error && (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--danger)" }}>
          <AlertTriangle className="size-4" /> {error}
        </p>
      )}

      {/* Live triage result */}
      {triage && (
        <div className="space-y-3">
          <TriagePanel triage={triage} />
          {createdRef ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border p-4 text-sm font-medium"
                 style={{ borderColor: "var(--ok)", color: "var(--ok)" }}>
              <CheckCircle2 className="size-5" />
              Case <span className="font-mono">{createdRef}</span> created and triaged.
              <Link href={`/cases/${encodeURIComponent(createdRef)}`} className="underline">Open the case →</Link>
            </div>
          ) : (
            <button type="button" onClick={onCreate} disabled={busy != null}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--ok)" }}>
              {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send to FOI inbox
            </button>
          )}
        </div>
      )}

      {/* Demo cleanup */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <button type="button" onClick={onClear} disabled={busy != null}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-medium hover:text-foreground disabled:opacity-60">
          {busy === "clear" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Clear demo cases
        </button>
        {cleared != null && <span>Removed {cleared} demo case{cleared === 1 ? "" : "s"}.</span>}
        <span>Demo-created cases carry a <span className="font-mono">-D</span> reference and a “Demo intake” badge.</span>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <dt className="w-12 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong"
}
