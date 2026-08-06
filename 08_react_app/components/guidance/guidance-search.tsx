"use client"

import { useState } from "react"
import { Loader2, Search, ExternalLink, FileCheck2 } from "lucide-react"
import type { PublishedAnswer, PublishedSource, PublishedTopic } from "@/lib/queries"

type Hit = Record<string, string>
const THEMES = [
  ["Cost limit (s.12)", "appropriate cost limit s.12 fees"],
  ["Personal data (s.40)", "personal data third party section 40"],
  ["Vexatious (s.14)", "vexatious request section 14"],
  ["Environmental (EIR)", "environmental information regulations EIR"],
  ["Commercial (s.43)", "commercial interests section 43"],
  ["Public interest test", "public interest test qualified exemption"],
  ["Internal reviews", "internal review process"],
  ["Already published (s.21)", "reasonably accessible already published section 21"],
] as const

export function GuidanceSearch({ topics = [] }: { topics?: PublishedTopic[] }) {
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [policy, setPolicy] = useState<Hit[] | null>(null)
  const [disclosure, setDisclosure] = useState<Hit[] | null>(null)
  const [wdtk, setWdtk] = useState<Hit[] | null>(null)
  // The section 21 "already published" check runs alongside the corpus search.
  const [pub, setPub] = useState<PublishedAnswer | null>(null)
  const [pubBusy, setPubBusy] = useState(false)

  async function search(query: string) {
    if (!query.trim()) return
    setQ(query); setBusy(true); setError(null); setPub(null); setPubBusy(true)

    // Corpus search (fast) — render results as soon as they arrive.
    fetch("/api/search", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, mode: "guidance" }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.ok) throw new Error(data.error || "Search failed")
        setPolicy(data.policy ?? []); setDisclosure(data.disclosure ?? []); setWdtk(data.wdtk ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Search failed"))
      .finally(() => setBusy(false))

    // Already-published (s.21) check (slower — drafts a grounded reply).
    fetch("/api/published", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.grounded) setPub({ answer: data.answer, sources: data.sources ?? [], grounded: true })
      })
      .catch(() => {})
      .finally(() => setPubBusy(false))
  }

  const ran = policy != null || pubBusy
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); search(q) }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Search guidance, past disclosures and precedents…"
               className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--brand-primary)" }}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Search
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {THEMES.map(([label, query]) => (
          <button key={label} type="button" onClick={() => search(query)}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs hover:bg-muted/50">{label}</button>
        ))}
      </div>
      {topics.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Previously answered:</span>
          {topics.slice(0, 6).map((t) => (
            <button key={t.sectionRef} type="button" onClick={() => search(t.title)}
                    title={`${t.sectionRef} · ${t.title}`}
                    className="max-w-[18rem] truncate rounded-full border px-2.5 py-0.5 text-xs hover:bg-[var(--ok-bg)]"
                    style={{ borderColor: "var(--ok)", color: "var(--ok)" }}>
              {t.title}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}

      {ran && (
        <div className="mt-4 space-y-4">
          {/* Already-published (s.21) highlight — appears when the query matches published information. */}
          {pubBusy && (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Checking whether this is already published…
            </p>
          )}
          {pub?.grounded && (
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--ok)", background: "var(--ok-bg)" }}>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ok)" }}>
                <FileCheck2 className="size-4" /> Already published · section 21
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                This looks like it has already been published. You can reply under section 21 and point the requester to the source, rather than re-supplying the information.
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{pub.answer}</p>
              {pub.sources.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {pub.sources.map((s: PublishedSource) => (
                    <li key={s.tag} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold" style={{ color: "var(--ok)" }}>{s.tag}</span>
                      <span className="font-medium">{s.title}</span>
                      {s.sectionRef && <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{s.sectionRef}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">AI-drafted from the council&rsquo;s published decisions. The officer confirms before sending.</p>
            </div>
          )}

          {policy != null && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Council &amp; regulator guidance</h3>
                <ul className="mt-2 space-y-2">
                  {(policy ?? []).length === 0 ? <li className="text-xs text-muted-foreground">No guidance matched.</li> : (policy ?? []).map((r, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium">{r.DOC_TITLE} {r.SECTION_REF && <span className="text-xs text-muted-foreground">· {r.SECTION_REF}</span>}</p>
                      {r.CONTENT && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{r.CONTENT}</p>}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Past disclosures</h3>
                <ul className="mt-2 space-y-2">
                  {(disclosure ?? []).length === 0 ? <li className="text-xs text-muted-foreground">No disclosures matched.</li> : (disclosure ?? []).map((r, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium">{r.TOPIC} <span className="text-xs text-muted-foreground">· {r.REFERENCE_NUMBER}</span></p>
                      {r.RESPONSE_SUMMARY && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{r.RESPONSE_SUMMARY}</p>}
                      {r.EXEMPTIONS_APPLIED && <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--warn)" }}>{r.EXEMPTIONS_APPLIED}</p>}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-2">
                <h3 className="text-sm font-semibold">Cross-authority precedent (WhatDoTheyKnow)</h3>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {(wdtk ?? []).map((r, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">{r.AUTHORITY_NAME}</span>
                        {r.OUTCOME && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{r.OUTCOME}</span>}
                      </div>
                      {r.REQUEST_URL ? <a href={r.REQUEST_URL} target="_blank" rel="noopener noreferrer" className="mt-1 block font-medium text-[var(--brand-primary)] hover:underline">{r.REQUEST_TITLE} <ExternalLink className="inline size-3" /></a> : <p className="mt-1 font-medium">{r.REQUEST_TITLE}</p>}
                      {r.SNIPPET && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.SNIPPET}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
