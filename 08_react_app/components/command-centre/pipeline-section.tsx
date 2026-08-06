"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, AlertTriangle, ArrowRight } from "lucide-react"
import type { PipelineStage } from "@/lib/queries"
import { PHASES, STAGE_TO_PHASE } from "@/lib/lifecycle"

/**
 * Two-tier funnel for the Command Centre: open requests rolled up into the
 * 5-step statutory FOIA process (+ a s.50 Challenge step). Each step is a bar
 * sized by how much open work sits there (on-track vs at-risk), and expands to
 * reveal the detailed lifecycle stages tucked underneath it. Every detail stage
 * links through to its filtered case list. The Cases page is the detail view.
 */

interface PhaseGroup {
  id: string
  label: string
  note: string
  total: number
  onTrack: number
  atRisk: number
  stages: PipelineStage[]
}

function groupByPhase(stages: PipelineStage[]): PhaseGroup[] {
  const byId = new Map<string, PhaseGroup>(
    PHASES.map((p) => [p.id, { id: p.id, label: p.label, note: p.note, total: 0, onTrack: 0, atRisk: 0, stages: [] }]),
  )
  for (const s of stages) {
    const g = byId.get(STAGE_TO_PHASE[s.code] ?? "Receipt")
    if (!g) continue
    g.total += s.total
    g.onTrack += s.onTrack
    g.atRisk += s.atRisk
    if (s.total > 0) g.stages.push(s)
  }
  for (const g of byId.values()) g.stages.sort((a, b) => a.order - b.order)
  return PHASES.map((p) => byId.get(p.id)!).filter((g) => g.total > 0 || g.stages.length > 0)
}

export function PipelineSection({ stages }: { stages: PipelineStage[] }) {
  const phases = groupByPhase(stages)
  const maxTotal = Math.max(1, ...phases.map((p) => p.total))
  const busiest = [...phases].sort((a, b) => b.total - a.total)[0]
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div>
      {busiest && busiest.total > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          Most open work is at{" "}
          <span className="font-semibold text-foreground">{busiest.label.replace(/^\d+\.\s*/, "")}</span>: {busiest.total} open
          {busiest.atRisk > 0 ? `, ${busiest.atRisk} at risk` : ""}.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {phases.map((p) => {
          const isOpen = openId === p.id
          const widthPct = Math.max(8, (p.total / maxTotal) * 100)
          return (
            <div key={p.id} className="rounded-lg border border-border bg-background">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : p.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <ChevronRight
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <div className="w-40 shrink-0 sm:w-48">
                  <div className="text-sm font-semibold leading-tight">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">{p.note}</div>
                </div>
                {/* volume bar: on-track + at-risk, width relative to the busiest step */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                    <div className="flex h-full" style={{ width: `${widthPct}%` }}>
                      <div style={{ flex: p.onTrack, background: "var(--chart-1)" }} />
                      <div style={{ flex: p.atRisk, background: "var(--danger)" }} />
                    </div>
                  </div>
                  <span className="tnum w-7 shrink-0 text-right text-sm font-bold">{p.total}</span>
                </div>
                {p.atRisk > 0 ? (
                  <span
                    className="inline-flex w-20 shrink-0 items-center justify-end gap-1 text-xs font-semibold"
                    style={{ color: "var(--danger)" }}
                  >
                    <AlertTriangle className="size-3" /> {p.atRisk} at risk
                  </span>
                ) : (
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">on track</span>
                )}
              </button>

              {isOpen && (
                <div className="border-t border-border px-3 py-2">
                  {p.stages.length === 0 ? (
                    <p className="py-1 pl-7 text-xs text-muted-foreground">No open requests at this step.</p>
                  ) : (
                    <ul className="flex flex-col">
                      {p.stages.map((s) => (
                        <li key={s.order}>
                          <Link
                            href={`/cases?stage=${encodeURIComponent(s.stage)}`}
                            className="group flex items-center gap-3 rounded px-2 py-1.5 pl-7 text-sm transition-colors hover:bg-muted/50"
                          >
                            <span className="flex-1 truncate">{s.stage}</span>
                            {s.atRisk > 0 && (
                              <span className="tnum text-xs font-semibold" style={{ color: "var(--danger)" }}>
                                {s.atRisk} at risk
                              </span>
                            )}
                            <span className="tnum w-7 text-right font-semibold">{s.total}</span>
                            <ArrowRight className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        The 5-step statutory FOIA process (plus s.50 Challenge). Expand a step to see the detailed lifecycle stages within it.
      </p>
    </div>
  )
}
