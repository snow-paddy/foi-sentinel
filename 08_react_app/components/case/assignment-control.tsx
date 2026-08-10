"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { UserCheck, UserPlus, Loader2, AlertTriangle, X } from "lucide-react"
import { can } from "@/lib/permissions"

interface Assignment {
  officerId: string
  officerName: string
  persona: string
}
interface Officer {
  id: string
  name: string
  persona: string
  initials: string
}

/**
 * Claim / assign / release a case. Self-contained: reads current assignment,
 * the acting persona and the officer roster on mount. Demonstrates the
 * Hybrid Tables UNIQUE(CASE_ID) guarantee — a second claim reports who holds it.
 */
export function AssignmentControl({ reference }: { reference: string }) {
  const router = useRouter()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [officers, setOfficers] = useState<Officer[]>([])
  const [persona, setPersona] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: "info" | "warn" | "error"; text: string } | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const [aRes, oRes] = await Promise.all([
        fetch(`/api/assignment?reference=${encodeURIComponent(reference)}`),
        fetch("/api/acting-as"),
      ])
      const a = await aRes.json()
      const o = await oRes.json()
      if (a.ok) setAssignment(a.assignment)
      if (o.ok) {
        setOfficers(o.officers ?? [])
        setPersona(o.current?.persona ?? null)
      }
    } catch {
      /* leave */
    }
  }, [reference])

  useEffect(() => {
    load()
  }, [load])

  async function act(action: string, officerId?: string) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/assignment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reference, officerId }),
      })
      const data = await res.json()
      if (res.status === 403) {
        setMsg({ kind: "error", text: data.error ?? "Not permitted." })
      } else if (data.ok) {
        setMsg(null)
        setAssignOpen(false)
        await load()
        router.refresh()
      } else if (data.heldBy) {
        setMsg({ kind: "warn", text: `Already claimed by ${data.heldBy} (${data.heldByPersona}).` })
        await load()
      } else {
        setMsg({ kind: "error", text: data.error ?? "Action failed." })
      }
    } finally {
      setBusy(false)
    }
  }

  const canAssign = can(persona, "ASSIGN")
  const isManager = persona === "Information Governance Manager"

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <UserCheck className="size-4" style={{ color: "var(--brand-primary)" }} />
        <span className="text-sm font-semibold">Assignment</span>
        {assignment ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs">
            {assignment.persona} <span className="text-muted-foreground">· {assignment.officerName}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!assignment && (
            <button
              onClick={() => act("claim")}
              disabled={busy || !canAssign}
              title={canAssign ? "Claim this case" : "Your role cannot claim cases"}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />} Claim
            </button>
          )}
          {isManager && (
            <button
              onClick={() => setAssignOpen((v) => !v)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Assign to…
            </button>
          )}
          {assignment && canAssign && (
            <button
              onClick={() => act("release")}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              title="Release assignment"
            >
              <X className="size-3.5" /> Release
            </button>
          )}
        </div>
      </div>

      {assignOpen && isManager && (
        <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {officers.map((o) => (
            <button
              key={o.id}
              onClick={() => act("assign", o.id)}
              disabled={busy}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
            >
              <span className="inline-flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
                {o.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{o.persona}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{o.name}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {msg && (
        <p
          className="mt-2 flex items-center gap-1.5 text-xs"
          style={{ color: msg.kind === "warn" ? "var(--warn-text)" : msg.kind === "error" ? "var(--danger)" : "var(--muted-foreground)" }}
        >
          {msg.kind !== "info" && <AlertTriangle className="size-3.5" />} {msg.text}
        </p>
      )}
    </div>
  )
}
