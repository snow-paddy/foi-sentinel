"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertTriangle, Pencil } from "lucide-react"
import type { LifecycleStage } from "@/lib/queries"

/**
 * The "Stage" row in the case Details card. Read-first: shows the current stage
 * with a subtle edit affordance; clicking turns the value into an inline
 * <select>. Saving writes via /api/advance-stage (toStage) → SP_ADVANCE_STAGE,
 * then refreshes so the banner, timeline and details pick up the new event.
 */
export function StageField({
  reference,
  stageCode,
  stageName,
  stageOrder,
  stages,
  editable = true,
}: {
  reference: string
  stageCode: string
  stageName: string
  stageOrder: number
  stages: LifecycleStage[]
  editable?: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function commit(next: string) {
    if (next === stageCode) { setEditing(false); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/advance-stage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference, toStage: next }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed")
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stage change failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stage</span>
      <div className="text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-2">
            <select
              autoFocus
              defaultValue={stageCode}
              disabled={saving}
              onChange={(e) => commit(e.target.value)}
              onBlur={() => !saving && setEditing(false)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm font-medium disabled:opacity-60"
            >
              {stages.map((s) => (
                <option key={s.code} value={s.code}>{s.order}. {s.name}</option>
              ))}
            </select>
            {saving && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          <button
            type="button"
            disabled={!editable}
            onClick={() => editable && setEditing(true)}
            className={`group inline-flex items-center gap-1.5 text-sm font-medium ${
              editable ? "cursor-pointer hover:text-[var(--brand-primary)]" : "cursor-default"
            }`}
            title={editable ? "Click to change stage" : undefined}
          >
            {stageName}{stageOrder ? ` (${stageOrder})` : ""}
            {editable && <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />}
          </button>
        )}
        {error && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--danger)" }}>
            <AlertTriangle className="size-3.5" /> {error}
          </p>
        )}
      </div>
    </div>
  )
}
