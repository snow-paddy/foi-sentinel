"use client"

import { useState } from "react"
import { Loader2, Search, FileCheck2, Sparkles } from "lucide-react"
import type { PublishedAnswer, PublishedSource, PublishedTopic } from "@/lib/queries"

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Search failed")

export function PublishedSearch({ topics }: { topics: PublishedTopic[] }) {
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PublishedAnswer | null>(null)
  const [asked, setAsked] = useState("")

  async function search(query: string) {
    if (!query.trim()) return
    setQ(query); setAsked(query); setBusy(true); setError(null)
    try {
      const res = await fetch("/api/published", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Search failed")
      setResult({ answer: data.answer, sources: data.sources ?? [], grounded: data.grounded })
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); search(q) }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Ask what a member of the public might ask, e.g. “how much is council tax going up?”"
               className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--brand-primary)" }}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Check
        </button>
      </form>

      {topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <button key={t.sectionRef} type="button" onClick={() => search(t.title)}
                    title={`${t.sectionRef} · ${t.title}`}
                    className="max-w-[20rem] truncate rounded-full border border-border px-2.5 py-0.5 text-xs hover:bg-muted/50">
              {t.title}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}

      {result && (
        <div className="mt-4 space-y-4">
          {/* The s.21 answer */}
          <div className="rounded-xl border p-4"
               style={{ borderColor: result.grounded ? "var(--ok)" : "var(--border)", background: result.grounded ? "var(--ok-bg)" : "var(--muted)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold"
                 style={{ color: result.grounded ? "var(--ok)" : "var(--muted-foreground)" }}>
              {result.grounded ? <FileCheck2 className="size-4" /> : <Sparkles className="size-4" />}
              {result.grounded ? "Already published (section 21 reply)" : "Not found in published information"}
            </div>
            {asked && <p className="mt-1 text-xs text-muted-foreground">In reply to: “{asked}”</p>}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{result.answer}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              AI-drafted from the council&rsquo;s published decisions. The officer confirms before sending.
            </p>
          </div>

          {/* Cited sources */}
          {result.sources.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold">Published sources</h3>
              <ul className="mt-2 space-y-2">
                {result.sources.map((s: PublishedSource) => (
                  <li key={s.tag} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">{s.tag}</span>
                      <span className="font-medium">{s.title}</span>
                      {s.sectionRef && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{s.sectionRef}</span>}
                      {s.docType && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.docType.replace(/_/g, " ").toLowerCase()}</span>}
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{s.snippet}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
