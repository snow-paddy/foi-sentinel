"use client"

import { useState } from "react"
import type { Requester } from "@/lib/queries"
import { Building2, User, Flag, ChevronDown } from "lucide-react"

function toneBand(v: number | null): { label: string; color: string } {
  if (v == null) return { label: "n/a", color: "var(--muted-foreground)" }
  if (v < -0.3) return { label: `Negative (${v.toFixed(2)})`, color: "var(--danger)" }
  if (v > 0.3) return { label: `Positive (${v.toFixed(2)})`, color: "var(--ok)" }
  return { label: `Neutral (${v >= 0 ? "+" : ""}${v.toFixed(2)})`, color: "var(--muted-foreground)" }
}

const COLLAPSED = 5

export function RequesterTable({ rows }: { rows: Requester[] }) {
  const [expanded, setExpanded] = useState(false)
  const maxReq = Math.max(1, ...rows.map((r) => r.requests))
  const shown = expanded ? rows : rows.slice(0, COLLAPSED)
  const hidden = rows.length - shown.length

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="text-left font-medium px-3 py-2">Requester</th>
              <th className="text-left font-medium px-3 py-2 w-[34%]">Requests</th>
              <th className="text-left font-medium px-3 py-2">Avg tone</th>
              <th className="text-center font-medium px-3 py-2">Section 14</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const tone = toneBand(r.sentiment)
              return (
                <tr key={r.label} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      {r.type === "Organisation" ? (
                        <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <User className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-medium">{r.label}</span>
                      <span className="text-[11px] text-muted-foreground">{r.type}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full"
                             style={{ width: `${(r.requests / maxReq) * 100}%`, background: "var(--chart-1)" }} />
                      </div>
                      <span className="tnum tabular-nums w-5 text-right">{r.requests}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2" style={{ color: tone.color }}>{tone.label}</td>
                  <td className="px-3 py-2 text-center">
                    {r.flagged > 0 ? (
                      <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--danger)" }}>
                        <Flag className="size-3.5" /> {r.flagged}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-primary)] hover:underline"
        >
          <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show fewer" : `Show all ${rows.length} requesters`}
        </button>
      )}
    </div>
  )
}
