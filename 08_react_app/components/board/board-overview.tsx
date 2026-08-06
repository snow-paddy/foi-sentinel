import { LayoutGrid } from "lucide-react"
import type { BoardCase } from "@/lib/queries"
import { sentimentBand } from "@/lib/format"

/**
 * High-level figures + a key for the lifecycle board: a prominent open count,
 * the at-risk / overdue split, and a legend that explains the card glyphs
 * (RAG dot, Cx complexity, sentiment band).
 */
export function BoardOverview({ cases, council }: { cases: BoardCase[]; council: string }) {
  const open = cases.length
  const atRisk = cases.filter((c) => (c.wdRemaining != null && c.wdRemaining < 0) || c.rag.toUpperCase() === "RED").length
  const overdue = cases.filter((c) => c.wdRemaining != null && c.wdRemaining < 0).length

  const neg = sentimentBand(-1), neu = sentimentBand(0), pos = sentimentBand(1)

  return (
    <div className="mb-4">
      <p className="text-sm text-muted-foreground">
        {council}: across the statutory FOIA process (Receipt → Triage → Retrieval → Review → Sign-off). Prioritised by <span className="font-medium text-foreground">deadline + complexity + requester sentiment</span> (AI triage), confirmed by you. Drag a card to advance its stage; click to open the case. <span className="font-medium text-foreground">Challenge (s.50)</span> is requester-led and shown for visibility only — those cases arrive via escalation, not by dragging.
      </p>

      {/* Figures */}
      <div className="mt-3 flex flex-wrap gap-3">
        <Stat label="Open requests" value={open} tone="var(--brand-primary)" icon />
        <Stat label="At risk" value={atRisk} tone="var(--warn)" />
        <Stat label="Overdue" value={overdue} tone="var(--danger)" />
      </div>

      {/* Legend / key */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide text-foreground">Key</span>

        <span className="inline-flex items-center gap-1.5">
          <Dot color="var(--ok)" /> On track
          <Dot color="var(--warn)" className="ml-1.5" /> Approaching
          <Dot color="var(--danger)" className="ml-1.5" /> Overdue / at risk
          <span className="ml-1 text-muted-foreground/70">(deadline)</span>
        </span>

        <span className="text-border">|</span>

        <span className="inline-flex items-center gap-1.5">
          <span className="rounded bg-muted px-1.5 py-0.5 font-bold text-muted-foreground">Cx</span>
          Request complexity (1–10)
        </span>

        <span className="text-border">|</span>

        <span className="inline-flex items-center gap-2">
          Sentiment:
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: neg.color }}>{neg.glyph} {neg.label}</span>
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: neu.color }}>{neu.glyph} {neu.label}</span>
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: pos.color }}>{pos.glyph} {pos.label}</span>
        </span>
      </div>
    </div>
  )
}

function Stat({ label, value, tone, icon = false }: { label: string; value: number; tone: string; icon?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2">
      {icon && <LayoutGrid className="size-5" style={{ color: tone }} />}
      <div>
        <div className="tnum text-2xl font-bold leading-none" style={{ color: tone }}>{value}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

function Dot({ color, className = "" }: { color: string; className?: string }) {
  return <span className={`inline-block size-2.5 rounded-full ${className}`} style={{ background: color }} />
}
