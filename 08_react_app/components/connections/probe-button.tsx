"use client"

import { useState } from "react"
import { Loader2, PlugZap, CheckCircle2, AlertTriangle } from "lucide-react"

interface Probe {
  ok: boolean
  tokenOk: boolean
  tokenStatus: number | null
  graphStatus: number | null
  error?: string
}

/**
 * Runs the real Entra ID → Graph round-trip on demand. Reports status codes, not
 * mail content: the underlying procedure returns the Graph response body, and the
 * server deliberately discards it.
 */
export function ProbeButton() {
  const [running, setRunning] = useState(false)
  const [probe, setProbe] = useState<Probe | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setError(null)
    setProbe(null)
    try {
      const res = await fetch("/api/connections/probe", { method: "POST" })
      const data = (await res.json()) as { ok: boolean; probe?: Probe }
      if (!data.ok || !data.probe) throw new Error("The probe did not return a result")
      setProbe(data.probe)
    } catch (e) {
      setError(e instanceof Error ? e.message : "The probe failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
          {running ? "Testing the connection…" : "Test the live connection"}
        </button>
        <p className="text-xs text-muted-foreground">
          Requests a token from Entra ID, then makes one Graph call against the shared mailbox.
        </p>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm" style={{ color: "var(--danger)" }}>
          <AlertTriangle className="size-4" /> {error}
        </p>
      )}

      {probe && (
        <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: probe.ok ? "var(--ok)" : "var(--danger)" }}>
            {probe.ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
            {probe.ok ? "Connection healthy" : "Connection failed"}
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-muted-foreground">Entra ID token</dt>
              <dd className="font-medium">{probe.tokenOk ? "Acquired" : "Not acquired"}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-muted-foreground">Token endpoint</dt>
              <dd className="tnum font-medium">{probe.tokenStatus ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-muted-foreground">Graph mailbox call</dt>
              <dd className="tnum font-medium">{probe.graphStatus ?? "—"}</dd>
            </div>
          </dl>
          {probe.error && <p className="mt-2 text-xs text-muted-foreground">{probe.error}</p>}
        </div>
      )}
    </div>
  )
}
