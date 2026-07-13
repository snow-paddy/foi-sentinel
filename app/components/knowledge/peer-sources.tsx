"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { CorpusSubSource } from "@/lib/queries"

/**
 * Collapsible list of the peer disclosure-log sources. Collapsed by default so
 * the two log cards sit short and aligned (no white space under the council's
 * own-log card); when expanded it spans the full width beneath both cards and
 * lays the sources out across two columns.
 */
export function PeerSources({ subSources, accent }: { subSources: CorpusSubSource[]; accent: string }) {
  const [open, setOpen] = useState(false)
  const nf = (v: number) => v.toLocaleString()
  return (
    <div className="mt-2.5 rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          Where the peer disclosure logs come from
        </span>
        <span className="text-[11px] text-muted-foreground">
          {open ? "Hide" : `Show ${subSources.length} sources`}
        </span>
      </button>
      {open && (
        <ul className="grid grid-cols-1 gap-x-8 gap-y-1.5 border-t border-border px-3 py-2.5 sm:grid-cols-2">
          {subSources.map((s) => (
            <li key={s.label} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-foreground/80">
                {s.label} <span className="text-muted-foreground">&mdash; {s.access}</span>
              </span>
              <span className="font-semibold tnum" style={{ color: accent }}>{nf(s.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
