"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PauseCircle, PlayCircle, Calculator, Check, ShieldCheck } from "lucide-react"

const CLOCK_REASONS: { value: string; label: string }[] = [
  { value: "STOPPED_CLARIFICATION", label: "Awaiting clarification" },
  { value: "STOPPED_FEES", label: "Awaiting fees" },
  { value: "PIT_EXTENSION", label: "PIT extension" },
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

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Action failed"
}

/** Stop / resume the statutory clock. */
export function ClockControl({ reference, clockState }: { reference: string; clockState: string }) {
  const router = useRouter()
  const running = clockState.toUpperCase() === "RUNNING"
  const [reason, setReason] = useState(CLOCK_REASONS[0].value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(action: "stop" | "resume") {
    setBusy(true); setError(null)
    try {
      await post("/api/clock", { reference, action, reason })
      router.refresh()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Statutory clock</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: running ? "var(--ok)" : "var(--warn)" }}>
          {running ? <PlayCircle className="size-3.5" /> : <PauseCircle className="size-3.5" />}
          {running ? "Running" : "Stopped"}
        </span>
      </div>
      {running ? (
        <div className="flex flex-wrap items-center gap-2">
          <select value={reason} onChange={(e) => setReason(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs">
            {CLOCK_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="button" disabled={busy} onClick={() => act("stop")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-60">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <PauseCircle className="size-3.5" />} Stop clock
          </button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => act("resume")}
                className="inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--brand-primary)" }}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />} Resume clock
        </button>
      )}
      {error && <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  )
}

/** Recalculate the s.12 cost estimate from four prescribed-activity hours. */
export function CostEditor({ reference }: { reference: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [h, setH] = useState({ determine: 1, locate: 2, retrieve: 2, extract: 1 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const field = (key: keyof typeof h, label: string) => (
    <label className="flex flex-col gap-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input type="number" min={0} step={0.5} value={h[key]}
             onChange={(e) => setH((s) => ({ ...s, [key]: Number(e.target.value) }))}
             className="w-20 rounded-md border border-border bg-background px-2 py-1" />
    </label>
  )

  async function recalc() {
    setBusy(true); setError(null)
    try {
      await post("/api/cost", { reference, ...h })
      setOpen(false)
      router.refresh()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50">
        <Calculator className="size-3.5" /> Recalculate cost
      </button>
    )
  }
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">Prescribed-activity hours (s.12). £25/hr.</p>
      <div className="flex flex-wrap gap-3">
        {field("determine", "Determine")}
        {field("locate", "Locate")}
        {field("retrieve", "Retrieve")}
        {field("extract", "Extract")}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy} onClick={recalc}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--brand-primary)" }}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Calculator className="size-3.5" />} Recalculate
        </button>
        <button type="button" onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
      {error && <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  )
}

/** PIT decision buttons on a pending qualified exemption. */
export function ExemptionDecide({ reference, assessmentId }: { reference: string; assessmentId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<"apply" | "disclose" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: "apply" | "disclose") {
    setBusy(decision); setError(null)
    try {
      await post("/api/exemption", { reference, assessmentId, decision })
      router.refresh()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(null) }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy != null} onClick={() => decide("disclose")}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--ok)" }}>
        {busy === "disclose" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Disclose (PIT favours release)
      </button>
      <button type="button" disabled={busy != null} onClick={() => decide("apply")}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-60">
        {busy === "apply" ? <Loader2 className="size-3.5 animate-spin" /> : null} Withhold (apply exemption)
      </button>
      {error && <p className="w-full text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  )
}

/** Verify an FOI redaction (HITL gate). */
export function RedactionVerify({ reference, redactionId }: { reference: string; redactionId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function verify() {
    setBusy(true); setError(null)
    try {
      await post("/api/redaction", { reference, redactionId })
      router.refresh()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <button type="button" disabled={busy} onClick={verify}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-60">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />} Verify redaction
      </button>
      {error && <p className="mt-1 text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
    </>
  )
}
