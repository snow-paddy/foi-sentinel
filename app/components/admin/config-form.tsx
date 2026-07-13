"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save } from "lucide-react"
import type { ConfigRow } from "@/lib/queries"

const FIELDS: { key: string; label: string; group: string }[] = [
  { key: "COUNCIL_NAME", label: "Authority name", group: "Identity" },
  { key: "AUTHORITY_TYPE", label: "Authority type", group: "Identity" },
  { key: "COST_LIMIT_GBP", label: "Cost limit (£)", group: "Cost limits" },
  { key: "COST_LIMIT_HOURS", label: "Cost limit (hours)", group: "Cost limits" },
  { key: "COST_RATE_PER_HOUR", label: "Rate per hour (£)", group: "Cost limits" },
  { key: "STANDARD_DEADLINE_WD", label: "Standard deadline (working days)", group: "Deadlines" },
  { key: "EXTENDED_DEADLINE_WD", label: "Extended deadline (working days)", group: "Deadlines" },
  { key: "SLA_TARGET_PCT", label: "Performance target (%)", group: "Performance" },
  { key: "AUTO_ACCEPT_THRESHOLD", label: "Auto-accept threshold (0–1)", group: "Performance" },
]

export function ConfigForm({ config }: { config: ConfigRow[] }) {
  const router = useRouter()
  const initial = Object.fromEntries(config.map((c) => [c.key, c.value]))
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const groups = [...new Set(FIELDS.map((f) => f.group))]

  async function save() {
    setBusy(true); setError(null); setSaved(false)
    try {
      const updates: Record<string, string> = {}
      for (const f of FIELDS) if (values[f.key] !== initial[f.key]) updates[f.key] = values[f.key] ?? ""
      if (!Object.keys(updates).length) { setSaved(true); setBusy(false); return }
      const res = await fetch("/api/config", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed")
      setSaved(true); router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g}>
          <h3 className="text-sm font-semibold">{g}</h3>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.filter((f) => f.group === g).map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <input value={values[f.key] ?? ""} onChange={(e) => { setValues((s) => ({ ...s, [f.key]: e.target.value })); setSaved(false) }}
                       className="rounded-md border border-border bg-background px-2 py-1.5" />
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy} onClick={save}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--brand-primary)" }}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save configuration
        </button>
        {saved && <span className="text-xs font-medium" style={{ color: "var(--ok)" }}>Saved.</span>}
        {error && <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</span>}
      </div>
    </div>
  )
}
