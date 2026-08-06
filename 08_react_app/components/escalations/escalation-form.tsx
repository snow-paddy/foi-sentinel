"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Send } from "lucide-react"

const DEFAULT_NOTE =
  "I am dissatisfied with the handling of my request and the exemptions applied. Please carry out an internal review of this decision."

export function EscalationForm({ cases }: { cases: { reference: string; subject: string; status: string }[] }) {
  const router = useRouter()
  const [ref, setRef] = useState(cases[0]?.reference ?? "")
  const [type, setType] = useState<"review" | "ico">("review")
  const [note, setNote] = useState(DEFAULT_NOTE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function generate() {
    if (!ref) return
    setBusy(true); setError(null); setDone(null)
    try {
      const res = await fetch("/api/escalation", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: ref, type, note }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed")
      setDone(`${type === "review" ? "Internal review" : "ICO complaint"} generated for ${ref}. Case reopened.`)
      router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Case</span>
        <select value={ref} onChange={(e) => setRef(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm">
          {cases.map((c) => <option key={c.reference} value={c.reference}>{c.reference}: {c.subject.slice(0, 50)} ({c.status})</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Escalation type</span>
        <select value={type} onChange={(e) => setType(e.target.value as "review" | "ico")} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm">
          <option value="review">Internal review request</option>
          <option value="ico">Information Commissioner complaint (s.50)</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grounds for escalation</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm" />
      </label>
      <button type="button" disabled={busy} onClick={generate}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--brand-primary)" }}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Generate escalation
      </button>
      {done && <p className="text-xs font-medium" style={{ color: "var(--ok)" }}>{done}</p>}
      {error && <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  )
}
