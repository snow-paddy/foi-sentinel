"use client"

import { useState } from "react"
import { Loader2, Sparkles, ExternalLink, Lightbulb } from "lucide-react"
import type { AnswerSource } from "@/lib/queries"

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Failed")
  return data as T
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Failed")

/**
 * Agentic answer suggestion: ground in internal Cortex Search corpora, then
 * draft a cited answer. The officer confirms before anything is sent.
 */
export function AnswerSuggestion({ reference, initial }: { reference: string; initial?: { answer: string; sources: AnswerSource[] } }) {
  const [answer, setAnswer] = useState<string | null>(initial?.answer ?? null)
  const [sources, setSources] = useState<AnswerSource[]>(initial?.sources ?? [])
  const [busy, setBusy] = useState<"suggest" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const precomputed = initial?.answer != null

  async function suggest() {
    setBusy("suggest"); setError(null)
    try {
      const d = await postJson<{ answer: string; sources: AnswerSource[] }>(
        "/api/suggest-answer", { reference })
      setAnswer(d.answer); setSources(d.sources)
    } catch (e) { setError(errMsg(e)) } finally { setBusy(null) }
  }

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Lightbulb className="size-4" style={{ color: "var(--brand-primary)" }} />
        <h2 className="text-base font-semibold">Suggested answer</h2>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-xs text-muted-foreground">
          Grounded in our internal corpora (WhatDoTheyKnow, GLA disclosure log, council policy) via Cortex Search,
          then drafted with citations. A starting point that the officer confirms before anything is sent.
          {precomputed && " Precomputed for this case. Re-draft to refresh."}
        </p>

        {answer == null ? (
          <button type="button" disabled={busy != null} onClick={suggest}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--brand-primary)" }}>
            {busy === "suggest" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Suggest an answer
          </button>
        ) : (
          <>
            <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 text-sm leading-relaxed">{answer}</p>
            {sources.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sources</p>
                <ul className="space-y-1">
                  {sources.map((s) => (
                    <li key={s.tag} className="text-xs text-muted-foreground">
                      <span className="font-mono font-semibold text-foreground">[{s.tag}]</span> {s.origin} ·{" "}
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                           className="text-[var(--brand-primary)] hover:underline">{s.title} <ExternalLink className="inline size-3" /></a>
                      ) : <span className="text-foreground">{s.title}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy != null} onClick={suggest}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-60">
                {busy === "suggest" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Re-draft
              </button>
            </div>
          </>
        )}
        {error && <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
    </div>
  )
}
