"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Star, AlertTriangle, Clock,
  CheckCircle2, Flag, ExternalLink, Layers,
  Send, Square, CheckSquare, Loader2, ShieldAlert, Zap, Scale,
} from "lucide-react"
import type { FocusCase, ResponseDraft } from "@/lib/queries"
import { ComplexityChip } from "@/components/shared/complexity-chip"
import { ProvenanceStrip, CitationLegend } from "@/components/shared/provenance"
import { DemoBadge } from "@/components/shared/demo-badge"
import { PriorityChip } from "@/components/shared/priority-chip"
import { HoverExplain } from "@/components/shared/hover-explain"
import { SIMILARITY_EXPLAINER } from "@/components/shared/precedent-match"

export type FocusCard = FocusCase & { drafts: ResponseDraft[] }

const FASTTRACK_MIN = 85 // strong precedent -> encourage a quick, confirmed send
const QUICKWIN_COMPLEXITY_MAX = 4
const COMPLEX_MIN = 7
const MULTI_EXEMPTION_MIN = 2 // >=2 distinct exemptions applied -> needs human judgement

type Lane = "quick" | "review" | "complex"

function isAlreadyPublished(c: FocusCard): boolean {
  return (c.outcome || "").toUpperCase() === "S21_REUSE"
}

// A case is Complex (needs human judgement, no auto-draft) when ANY of these hold.
// This is deliberately more than a single AI complexity score, so the split is
// defensible to a customer: high complexity, potentially vexatious, engages a
// public-interest balancing test, or multiple exemptions applied.
function isComplex(c: FocusCard): boolean {
  return (
    c.isVexatious ||
    (c.complexity != null && c.complexity >= COMPLEX_MIN) ||
    c.pitEngaged ||
    c.exemptionsApplied >= MULTI_EXEMPTION_MIN
  )
}

function laneOf(c: FocusCard): Lane {
  if (isComplex(c)) return "complex"
  // Already-published (s.21) is a fast, lawful disposal: point the requester to
  // the published source. Treat it as a quick win regardless of precedent score.
  if (isAlreadyPublished(c)) return "quick"
  if (c.precedentPct != null && c.precedentPct >= FASTTRACK_MIN && (c.complexity == null || c.complexity <= QUICKWIN_COMPLEXITY_MAX)) return "quick"
  return "review"
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function Deadline({ c }: { c: FocusCard }) {
  const wd = c.wdRemaining
  if (wd == null) return <span className="text-muted-foreground">Deadline {fmtDate(c.deadline)}</span>
  if (wd < 0) return <span className="font-semibold" style={{ color: "var(--danger)" }}>{Math.abs(wd)} day{Math.abs(wd) === 1 ? "" : "s"} overdue</span>
  const tone = wd <= 3 ? "var(--danger)" : wd <= 7 ? "var(--warn)" : "var(--foreground)"
  return <span className="tnum" style={{ color: tone }}>{wd} working day{wd === 1 ? "" : "s"} left</span>
}

function regimeLabel(regime: string) {
  switch (regime.toUpperCase()) {
    case "EIR": return "Environmental Information request (EIR)"
    case "SAR": return "Subject Access Request (SAR)"
    case "FOI": return "Freedom of Information request (FOI)"
    default: return regime || "Request"
  }
}

function liveDraft(c: FocusCard): ResponseDraft | undefined {
  return c.drafts.find((d) => !d.dispatchedAt)
}

// ---------------------------------------------------------------------------
// Lane 1: Quick wins. Low complexity + strong precedent. AI has pre-drafted a
// response; the officer reviews the batch, ticks, and sends in one action.
// ---------------------------------------------------------------------------
function QuickWinLane({ cases }: { cases: FocusCard[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(cases.map((c) => c.reference)))
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const toggle = (ref: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(ref) ? n.delete(ref) : n.add(ref); return n })
  const allOn = selected.size === cases.length && cases.length > 0
  const setAll = () => setSelected(allOn ? new Set() : new Set(cases.map((c) => c.reference)))

  async function send() {
    const refs = [...selected]
    if (!refs.length) return
    setBusy(true); setError(null)
    try {
      const res = await fetch("/api/response/batch-dispatch", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ references: refs }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.ok) throw new Error(d.error || "Batch dispatch failed")
      const map: Record<string, { ok: boolean; error?: string }> = {}
      for (const r of d.results as { reference: string; ok: boolean; error?: string }[]) map[r.reference] = { ok: r.ok, error: r.error }
      setResults(map)
      setSelected(new Set())
      setConfirming(false)
      router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ok)]/30 bg-[var(--ok-bg)] p-4">
        <div className="flex items-start gap-2.5">
          <Zap className="mt-0.5 size-5 shrink-0" style={{ color: "var(--ok)" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--ok)" }}>Quick wins, ready to send</p>
            <p className="text-xs text-muted-foreground">
              Requests we can close fast: a strong precedent match, or information that is already published (s.21). The AI has pre-drafted each reply. Review, untick any you want to handle yourself, and send the rest as a batch. Nothing leaves until you confirm here.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={setAll} className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted/50">
            {allOn ? "Clear all" : "Select all"}
          </button>
          <button type="button" onClick={() => setConfirming(true)} disabled={busy || selected.size === 0 || confirming}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--ok)" }}>
            <Send className="size-4" />
            Send {selected.size} response{selected.size === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      {confirming && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--ok)", background: "var(--ok-bg)" }}>
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" style={{ color: "var(--ok)" }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Confirm you want to send {selected.size} repl{selected.size === 1 ? "y" : "ies"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Each reply below is emailed to the requester and its case is closed. This is your sign-off. It is recorded against each case and cannot be undone.
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {cases.filter((c) => selected.has(c.reference)).map((c) => (
                  <li key={c.reference} className="flex items-center gap-2 text-xs">
                    <CheckSquare className="size-3.5 shrink-0 text-[var(--ok)]" />
                    <span className="font-mono font-bold">{c.reference}</span>
                    <span className="truncate text-muted-foreground">{c.subject}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={send} disabled={busy || selected.size === 0}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--ok)" }}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Confirm &amp; send {selected.size}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="space-y-2.5">
        {cases.map((c) => {
          const draft = liveDraft(c)
          const preview = (draft?.finalText || draft?.draftText || "").trim()
          const checked = selected.has(c.reference)
          const r = results[c.reference]
          return (
            <div key={c.reference}
              className="flex gap-3 rounded-xl border bg-card p-4 shadow-sm"
              style={{ borderColor: checked ? "var(--ok)" : "var(--border)", borderLeftWidth: 4, borderLeftColor: "var(--ok)" }}>
              <button type="button" onClick={() => toggle(c.reference)} aria-pressed={checked}
                className="mt-0.5 shrink-0 text-[var(--ok)]" title={checked ? "Deselect" : "Select"}>
                {checked ? <CheckSquare className="size-5" /> : <Square className="size-5 text-muted-foreground" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold">{c.reference}</span>
                  <DemoBadge reference={c.reference} />
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold" title={regimeLabel(c.regime)}>{c.regime}</span>
                  <PriorityChip band={c.priorityBand} score={c.priorityScore} />
                  {isAlreadyPublished(c) && (
                    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
                      <CheckCircle2 className="size-3" /> Already published (s.21)
                    </span>
                  )}
                  {!isAlreadyPublished(c) && c.precedentPct != null && (
                    <HoverExplain
                      className="text-xs font-semibold"
                      style={{ color: "var(--ok)" }}
                      title={`How the precedent match is scored (${c.precedentPct}% similar)`}
                      description={SIMILARITY_EXPLAINER}
                    >
                      <Star className="size-3" /> {c.precedentPct}% precedent match
                    </HoverExplain>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 text-xs"><Clock className="size-3.5" /><Deadline c={c} /></span>
                </div>
                <h3 className="mt-1 text-sm font-bold">
                  <Link href={`/cases/${encodeURIComponent(c.reference)}`} className="text-[var(--brand-primary)] hover:underline">
                    {c.subject}
                  </Link>
                </h3>
                {preview ? (
                  <>
                    <p className="mt-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-[var(--ok)]">
                      <span>Pre-drafted response</span>
                      {r && (
                        <span className="inline-flex items-center gap-1 normal-case" style={{ color: r.ok ? "var(--ok)" : "var(--danger)" }}>
                          {r.ok ? <><CheckCircle2 className="size-3.5" /> Sent, case closed</> : <><AlertTriangle className="size-3.5" /> {r.error || "Failed"}</>}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-3 text-xs leading-relaxed text-foreground/80">
                      {preview}
                    </p>
                    <ProvenanceStrip sources={draft?.sources} />
                    <CitationLegend text={preview} sources={draft?.sources} />
                  </>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">A draft will be generated and sent when you confirm.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lane 2: Needs review. Medium complexity. Listed in priority order, same style
// as the complex lane; open each case to check the draft and send when ready.
// ---------------------------------------------------------------------------
function ReviewLane({ cases }: { cases: FocusCard[] }) {
  if (cases.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-12 text-center">
        <CheckCircle2 className="size-7" style={{ color: "var(--ok)" }} />
        <p className="mt-2 text-base font-semibold">Nothing waiting for review</p>
        <p className="mt-1 text-sm text-muted-foreground">No medium-complexity cases in this view right now.</p>
      </div>
    )
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--brand-primary)]/30 bg-muted/40 p-4">
        <Layers className="mt-0.5 size-5 shrink-0" style={{ color: "var(--brand-primary)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--brand-primary)" }}>Needs officer review</p>
          <p className="text-xs text-muted-foreground">
            Medium-complexity requests, in priority order. The AI has triaged each one and, where a close precedent exists,
            pre-drafted a reply. Open a case to check the draft and send when you are satisfied.
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        {cases.map((c) => {
          const pct = c.precedentPct
          const fastTrack = pct != null && pct >= FASTTRACK_MIN
          return (
            <Link key={c.reference} href={`/cases/${encodeURIComponent(c.reference)}`}
              className="flex gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30"
              style={{ borderLeftWidth: 4, borderLeftColor: "var(--brand-primary)" }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold">{c.reference}</span>
                  <DemoBadge reference={c.reference} />
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold" title={regimeLabel(c.regime)}>{c.regime}</span>
                  <PriorityChip band={c.priorityBand} score={c.priorityScore} />
                  {fastTrack ? (
                    <HoverExplain
                      className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
                      style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
                      title={`How the precedent match is scored (${pct}% similar)`}
                      description={SIMILARITY_EXPLAINER}
                    >
                      <Star className="size-3" /> {pct}% precedent match
                    </HoverExplain>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold" style={{ background: "var(--muted)", color: "var(--brand-primary)" }}>
                      <Layers className="size-3" /> Needs officer review
                    </span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 text-xs"><Clock className="size-3.5" /><Deadline c={c} /></span>
                </div>
                <h3 className="mt-1 truncate text-sm font-bold">{c.subject}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {c.complexity != null && <ComplexityChip score={c.complexity} factors={c.complexityFactors} />}
                  <span className="inline-flex items-center gap-1 text-[var(--brand-primary)]">Open full case <ExternalLink className="size-3" /></span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lane 3: Complex / human-led. Vexatious or high-complexity. No auto-draft.
// These need an officer's judgement, so we link straight to the full case.
// ---------------------------------------------------------------------------
function ComplexLane({ cases }: { cases: FocusCard[] }) {
  if (cases.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-12 text-center">
        <CheckCircle2 className="size-7" style={{ color: "var(--ok)" }} />
        <p className="mt-2 text-base font-semibold">No complex cases right now</p>
        <p className="mt-1 text-sm text-muted-foreground">Nothing in this view needs escalated human judgement.</p>
      </div>
    )
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--warn)]/30 bg-[var(--warn-bg)] p-4">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" style={{ color: "var(--warn)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--warn)" }}>Needs human judgement</p>
          <p className="text-xs text-muted-foreground">
            Flagged for human judgement: high complexity, potentially vexatious, engaging a public-interest test, or multiple exemptions applied. The AI does not pre-draft these. Open each case to work it through with full context.
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        {cases.map((c) => {
          const drivers: { label: string; Icon: typeof ShieldAlert }[] = []
          if (c.isVexatious) drivers.push({ label: "Potentially vexatious (s.14)", Icon: Flag })
          if (c.complexity != null && c.complexity >= COMPLEX_MIN) drivers.push({ label: `High complexity (Cx ${c.complexity.toFixed(0)})`, Icon: ShieldAlert })
          if (c.pitEngaged) drivers.push({ label: "Engages a public-interest test", Icon: Scale })
          if (c.exemptionsApplied >= MULTI_EXEMPTION_MIN) drivers.push({ label: "Multiple exemptions applied", Icon: Scale })
          if (drivers.length === 0) drivers.push({ label: "High complexity", Icon: ShieldAlert })
          return (
            <Link key={c.reference} href={`/cases/${encodeURIComponent(c.reference)}`}
              className="flex gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30"
              style={{ borderLeftWidth: 4, borderLeftColor: "var(--warn)" }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold">{c.reference}</span>
                  <DemoBadge reference={c.reference} />
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold" title={regimeLabel(c.regime)}>{c.regime}</span>
                  <PriorityChip band={c.priorityBand} score={c.priorityScore} />
                  {drivers.map((d, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
                      <d.Icon className="size-3" /> {d.label}
                    </span>
                  ))}
                  <span className="ml-auto inline-flex items-center gap-1 text-xs"><Clock className="size-3.5" /><Deadline c={c} /></span>
                </div>
                <h3 className="mt-1 truncate text-sm font-bold">{c.subject}</h3>
                {c.complexityFactors.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.complexityFactors.map((f, i) => (
                      <span key={i} className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">{f}</span>
                    ))}
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  {c.complexity != null && <ComplexityChip score={c.complexity} factors={c.complexityFactors} />}
                  <span className="inline-flex items-center gap-1 text-[var(--brand-primary)]">Open full case <ExternalLink className="size-3" /></span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Orchestrator: split the priority queue into three lanes and let the officer
// work quick wins first (batch), then reviews, then complex cases.
// ---------------------------------------------------------------------------
export function FocusDeck({ cases }: { cases: FocusCard[] }) {
  // Lead the quick-wins lane with the already-published (s.21) cases: they are the
  // cleanest "point them to the source" story. Stable sort keeps priority order within
  // each group (s.21 first, then strong-precedent disclosures).
  const quick = cases
    .filter((c) => laneOf(c) === "quick")
    .sort((a, b) => Number(isAlreadyPublished(b)) - Number(isAlreadyPublished(a)))
  const review = cases.filter((c) => laneOf(c) === "review")
  const complex = cases.filter((c) => laneOf(c) === "complex")
  const [lane, setLane] = useState<Lane>(() => (quick.length ? "quick" : review.length ? "review" : "complex"))

  if (cases.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-16 text-center">
        <CheckCircle2 className="size-8" style={{ color: "var(--ok)" }} />
        <p className="mt-3 text-lg font-semibold">You&apos;re all caught up</p>
        <p className="mt-1 text-sm text-muted-foreground">No open requests match this view. Switch to List or Board to see everything.</p>
      </div>
    )
  }

  const tabs: { id: Lane; label: string; count: number; icon: typeof Zap; tint: string }[] = [
    { id: "quick", label: "Quick wins", count: quick.length, icon: Zap, tint: "var(--ok)" },
    { id: "review", label: "Needs review", count: review.length, icon: Layers, tint: "var(--brand-primary)" },
    { id: "complex", label: "Complex", count: complex.length, icon: ShieldAlert, tint: "var(--warn)" },
  ]

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = lane === t.id
          const Icon = t.icon
          return (
            <button key={t.id} type="button" onClick={() => setLane(t.id)} aria-current={active ? "true" : undefined}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                active ? "border-transparent text-white" : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
              style={active ? { background: t.tint } : undefined}>
              <Icon className="size-4" />
              {t.label}
              <span className={`tnum rounded-full px-1.5 text-xs font-bold ${active ? "bg-white/25" : "bg-muted text-foreground"}`}>{t.count}</span>
            </button>
          )
        })}
      </div>

      {lane === "quick" && (quick.length ? <QuickWinLane cases={quick} /> : <EmptyLane label="No quick wins in this view." />)}
      {lane === "review" && <ReviewLane cases={review} />}
      {lane === "complex" && <ComplexLane cases={complex} />}
    </div>
  )
}

function EmptyLane({ label }: { label: string }) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-12 text-center">
      <CheckCircle2 className="size-7" style={{ color: "var(--ok)" }} />
      <p className="mt-2 text-base font-semibold">Nothing here</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
