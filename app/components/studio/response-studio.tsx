"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, Check, Send, FileText, X, Wand2, Star } from "lucide-react"
import type { ResponseDraft, ResponseType } from "@/lib/queries"
import type { DecisionRationale } from "@/lib/format"
import { ProvenanceStrip, CitationLegend } from "@/components/shared/provenance"
import { DecisionSummary } from "@/components/studio/decision-summary"

const TYPES: { value: ResponseType; label: string; hint: string }[] = [
  { value: "DISCLOSURE", label: "Disclosure", hint: "Information released in full." },
  { value: "PARTIAL", label: "Partial", hint: "Some information released, the rest withheld under specific exemptions." },
  { value: "REFUSAL", label: "Refusal", hint: "Information withheld under an exemption, or not held." },
  { value: "S21_REUSE", label: "Already published (s.21)", hint: "Information is already published, so under s.21 we point the requester to it rather than re-supplying it." },
]

async function post(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || "Action failed")
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Action failed")

function S17Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: ok ? "var(--ok-bg)" : "var(--danger-bg)", color: ok ? "var(--ok)" : "var(--danger)" }}>
      {ok ? <Check className="size-3" /> : <X className="size-3" />} {label}
    </span>
  )
}

/** Full studio surface: generate, review/edit, save final, dispatch. */
export function ResponseStudio({ reference, drafts, initialType = "DISCLOSURE", suggestedReason, precedentRef, decision }: { reference: string; drafts: ResponseDraft[]; initialType?: ResponseType; suggestedReason?: string; precedentRef?: string; decision?: DecisionRationale }) {
  const router = useRouter()
  const [type, setType] = useState<ResponseType>(initialType)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate(usePrecedent = false) {
    setBusy(usePrecedent ? "generate-precedent" : "generate"); setError(null)
    try {
      await post("/api/response/generate", { reference, type, usePrecedent })
      router.refresh()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(null) }
  }

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <FileText className="size-4" style={{ color: "var(--brand-primary)" }} />
        <h2 className="text-base font-semibold">Response &amp; refusal studio</h2>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Response type</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setType(t.value)} title={t.hint}
                      className="rounded-md border px-2.5 py-1 text-xs font-medium"
                      style={type === t.value
                        ? { borderColor: "var(--brand-primary)", background: "var(--brand-primary)", color: "#fff" }
                        : { borderColor: "var(--border)" }}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{TYPES.find((t) => t.value === type)?.hint}</p>
          {suggestedReason && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--brand-primary)" }}>
              <Sparkles className="size-3" /> Suggested: {suggestedReason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy != null} onClick={() => generate(false)}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--brand-primary)" }}>
            {busy === "generate" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate compliant draft
          </button>
          {precedentRef && (
            <button type="button" disabled={busy != null} onClick={() => generate(true)}
                    title={`Regenerate the draft grounded on the adopted precedent ${precedentRef}, so it mirrors how a similar request was answered before.`}
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                    style={{ borderColor: "var(--brand-primary)", color: "var(--brand-primary)" }}>
              {busy === "generate-precedent" ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />}
              Regenerate from precedent
            </button>
          )}
        </div>
        {error && <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}

        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No drafts yet. Generate one above.</p>
        ) : (
          <div className="space-y-3">
            {decision && <DecisionSummary decision={decision} />}
            {drafts.map((d) => <DraftCard key={d.responseId} reference={reference} draft={d} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function DraftCard({ reference, draft }: { reference: string; draft: ResponseDraft }) {
  const router = useRouter()
  const [text, setText] = useState(draft.finalText || draft.draftText)
  const [busy, setBusy] = useState<"save" | "dispatch" | "edit" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [instruction, setInstruction] = useState("")
  const dispatched = draft.dispatchedAt != null

  async function save() {
    setBusy("save"); setError(null)
    try {
      await post("/api/response/save", { reference, responseId: draft.responseId, finalText: text })
      setSaved(true); router.refresh()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(null) }
  }
  async function dispatch() {
    setBusy("dispatch"); setError(null)
    try {
      await post("/api/response/dispatch", { reference, responseId: draft.responseId })
      router.refresh()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(null) }
  }
  async function editWithAi() {
    const ask = instruction.trim()
    if (!ask) return
    setBusy("edit"); setError(null)
    try {
      const res = await fetch("/api/response/edit-with-ai", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference, responseId: draft.responseId, instruction: ask, currentText: text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || "Edit failed")
      setText(data.text); setSaved(false); setInstruction("")
    } catch (e) { setError(errMsg(e)) } finally { setBusy(null) }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{draft.responseType}</span>
        <div className="flex flex-wrap gap-1.5">
          <S17Badge ok={draft.s17ExemptionStated} label="Exemption stated" />
          <S17Badge ok={draft.s17InternalReview} label="Internal review" />
          <S17Badge ok={draft.s17IcoRoute} label="ICO route" />
        </div>
      </div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setSaved(false) }}
                disabled={dispatched} rows={8}
                className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm disabled:opacity-70" />
      <ProvenanceStrip sources={draft.sources} />
      <CitationLegend text={text} sources={draft.sources} />
      {dispatched ? (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
          <Send className="size-3.5" /> Dispatched, case closed
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy != null} onClick={save}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-60">
            {busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {saved ? "Saved" : "Save as final"}
          </button>
          <button type="button" disabled={busy != null} onClick={dispatch}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--brand-primary)" }}>
            {busy === "dispatch" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Dispatch (close case)
          </button>
          {error && <p className="w-full text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
          <div className="mt-1 flex w-full items-center gap-2">
            <input type="text" value={instruction} onChange={(e) => setInstruction(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); editWithAi() } }}
                   placeholder="Edit with AI, e.g. 'make it more concise' or 'add the fees context'"
                   disabled={busy != null}
                   className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs disabled:opacity-60" />
            <button type="button" disabled={busy != null || !instruction.trim()} onClick={editWithAi}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-60">
              {busy === "edit" ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
              Edit with AI
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
