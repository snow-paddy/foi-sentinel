"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Stamp, Loader2, AlertTriangle, Check, X } from "lucide-react"
import { can } from "@/lib/permissions"

interface Signoff {
  step: string
  actor: string
  role: string
  decision: string
  note: string
  at: string
}

const STEP_LABEL: Record<string, string> = {
  OFFICER_DRAFT: "Officer draft",
  REVIEWER: "Reviewer",
  MONITORING: "Monitoring sign-off",
}

/**
 * The sign-off chain for a case. Reviewers and the IG Manager may add a step;
 * a Monitoring 'Approved' step is what releases dispatch and publication.
 */
export function SignoffPanel({ reference }: { reference: string }) {
  const router = useRouter()
  const [rows, setRows] = useState<Signoff[]>([])
  const [persona, setPersona] = useState<string | null>(null)
  const [step, setStep] = useState<string>("MONITORING")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: "warn" | "error"; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`/api/signoff?reference=${encodeURIComponent(reference)}`),
        fetch("/api/acting-as"),
      ])
      const s = await sRes.json()
      const a = await aRes.json()
      if (s.ok) setRows(s.signoffs ?? [])
      if (a.ok) setPersona(a.current?.persona ?? null)
    } catch {
      /* leave */
    }
  }, [reference])

  useEffect(() => {
    load()
  }, [load])

  async function submit(decision: "APPROVED" | "REJECTED") {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/signoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference, step, decision, note }),
      })
      const data = await res.json()
      if (res.status === 403) {
        setMsg({ kind: "error", text: data.error ?? "Your role cannot sign off." })
      } else if (data.ok) {
        setNote("")
        await load()
        router.refresh()
      } else {
        setMsg({ kind: "error", text: data.error ?? "Sign-off failed." })
      }
    } finally {
      setBusy(false)
    }
  }

  const canSignoff = can(persona, "SIGN_OFF")
  const approved = rows.some((r) => r.step === "MONITORING" && r.decision === "APPROVED")

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Stamp className="size-4" style={{ color: "var(--brand-primary)" }} />
        <span className="text-sm font-semibold">Sign-off chain</span>
        <span
          className="rounded-full border border-border px-2 py-0.5 text-xs"
          style={{ color: approved ? "var(--brand-primary)" : "var(--muted-foreground)" }}
        >
          {approved ? "Monitoring approved" : "Awaiting monitoring sign-off"}
        </span>
      </div>

      {rows.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span
                className="mt-0.5 inline-flex size-4 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: r.decision === "APPROVED" ? "var(--brand-primary)" : "var(--danger)" }}
              >
                {r.decision === "APPROVED" ? <Check className="size-3" /> : <X className="size-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{STEP_LABEL[r.step] ?? r.step}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {r.role || r.actor} · {r.decision.toLowerCase()}
                </span>
                {r.note && <span className="block text-muted-foreground">{r.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {canSignoff ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Step</span>
            <select
              value={step}
              onChange={(e) => setStep(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              {Object.entries(STEP_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              placeholder="Rationale for the record"
            />
          </label>
          <button
            onClick={() => submit("APPROVED")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Sign off
          </button>
          <button
            onClick={() => submit("REJECTED")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <X className="size-3.5" /> Reject
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Sign-off is limited to reviewers and the Information Governance Manager.
        </p>
      )}

      {msg && (
        <p
          className="mt-2 flex items-center gap-1.5 text-xs"
          style={{ color: msg.kind === "warn" ? "var(--warn-text)" : "var(--danger)" }}
        >
          <AlertTriangle className="size-3.5" /> {msg.text}
        </p>
      )}
    </div>
  )
}
