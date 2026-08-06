"use client"

import { useState } from "react"
import { Loader2, Search, ExternalLink } from "lucide-react"

type Hit = Record<string, string>

function outcomeColor(outcome: string): { bg: string; fg: string } {
  const o = outcome.toLowerCase()
  if (o.includes("refus") || o.includes("not held") || o.includes("withheld")) return { bg: "var(--danger-bg)", fg: "var(--danger)" }
  if (o.includes("part")) return { bg: "var(--warn-bg)", fg: "var(--warn)" }
  return { bg: "var(--ok-bg)", fg: "var(--ok)" }
}

/** Semantic precedent search across WhatDoTheyKnow + GLA + Camden (Cortex Search). */
export function SectorSearch() {
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wdtk, setWdtk] = useState<Hit[] | null>(null)
  const [gla, setGla] = useState<Hit[] | null>(null)
  const [camden, setCamden] = useState<Hit[] | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await fetch("/api/search", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, mode: "sector" }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Search failed")
      setWdtk(data.wdtk ?? []); setGla(data.gla ?? []); setCamden(data.camden ?? [])
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed") } finally { setBusy(false) }
  }

  return (
    <div>
      <form onSubmit={run} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Search comparable requests across the sector…"
               className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--brand-primary)" }}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Search
        </button>
      </form>
      {error && <p className="mt-2 text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}

      {wdtk && (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {wdtk.length === 0 && (gla?.length ?? 0) === 0 && (camden?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
          {wdtk.map((r, i) => {
            const oc = outcomeColor(String(r.OUTCOME ?? ""))
            return (
              <div key={`w${i}`} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">{r.AUTHORITY_NAME}</span>
                  {r.OUTCOME && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: oc.bg, color: oc.fg }}>{r.OUTCOME}</span>}
                </div>
                {r.REQUEST_URL ? <a href={r.REQUEST_URL} target="_blank" rel="noopener noreferrer" className="mt-1 block font-medium text-[var(--brand-primary)] hover:underline">{r.REQUEST_TITLE} <ExternalLink className="inline size-3" /></a> : <p className="mt-1 font-medium">{r.REQUEST_TITLE}</p>}
                {r.SNIPPET && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{r.SNIPPET}</p>}
                {r.REFUSAL_REASON && (
                  <p className="mt-1.5 border-t border-border pt-1.5 text-xs">
                    {r.REFUSAL_SECTIONS && (
                      <span className="mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
                        {r.REFUSAL_SECTIONS}
                      </span>
                    )}
                    <span className="italic text-muted-foreground">Why: {r.REFUSAL_REASON}</span>
                  </p>
                )}
              </div>
            )
          })}
          {(gla ?? []).map((r, i) => (
            <div key={`g${i}`} className="rounded-lg border border-border p-3 text-sm" style={{ borderColor: "var(--brand-primary)" }}>
              <span className="text-xs font-semibold text-muted-foreground">GLA disclosure log</span>
              {r.SOURCE_URL ? <a href={r.SOURCE_URL} target="_blank" rel="noopener noreferrer" className="mt-1 block font-medium text-[var(--brand-primary)] hover:underline">{r.TITLE} <ExternalLink className="inline size-3" /></a> : <p className="mt-1 font-medium">{r.TITLE}</p>}
              {r.RESPONSE_TEXT && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{r.RESPONSE_TEXT}</p>}
            </div>
          ))}
          {(camden ?? []).map((r, i) => (
            <div key={`c${i}`} className="rounded-lg border border-border p-3 text-sm" style={{ borderColor: "var(--brand-primary)" }}>
              <span className="text-xs font-semibold text-muted-foreground">Camden disclosure log</span>
              {r.DOCUMENT_LINK ? <a href={r.DOCUMENT_LINK} target="_blank" rel="noopener noreferrer" className="mt-1 block font-medium text-[var(--brand-primary)] hover:underline">{r.DOCUMENT_TITLE} <ExternalLink className="inline size-3" /></a> : <p className="mt-1 font-medium">{r.DOCUMENT_TITLE}</p>}
              {r.DOCUMENT_TEXT && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{r.DOCUMENT_TEXT}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
