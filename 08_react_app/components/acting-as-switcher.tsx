"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { UserCog, ChevronDown, Check } from "lucide-react"

interface Officer {
  id: string
  name: string
  persona: string
  department: string
  initials: string
}

/**
 * Demo user-switcher: pick who you're acting as from the FOI_OFFICER roster.
 * One SPCS login underneath — this changes attribution, permissions and the
 * "my cases" filter, not what data is visible. Deliberately styled as a demo
 * control, not a real login, so nobody mistakes it for authentication.
 */
export function ActingAsSwitcher() {
  const router = useRouter()
  const [officers, setOfficers] = useState<Officer[]>([])
  const [current, setCurrent] = useState<{ id: string; name: string; persona: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/acting-as", { method: "GET" })
      const data = await res.json()
      if (data.ok) {
        setOfficers(data.officers ?? [])
        setCurrent(data.current ?? null)
      }
    } catch {
      /* leave empty */
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  async function choose(officerId: string) {
    setBusy(true)
    try {
      const res = await fetch("/api/acting-as", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ officerId }),
      })
      const data = await res.json()
      if (data.ok) {
        setCurrent(data.current)
        setOpen(false)
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  const label = current?.persona ?? "Choose role"

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        title="Acting as (demo user-switcher) — changes attribution and permissions, not data visibility"
      >
        <UserCog className="size-3.5" style={{ color: "var(--brand-primary)" }} />
        <span className="hidden sm:inline">Acting as:</span>
        <span className="max-w-[200px] truncate font-semibold text-foreground">{label}</span>
        {current?.name && <span className="hidden text-muted-foreground md:inline">· {current.name}</span>}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-72 rounded-md border border-border bg-card p-1 shadow-lg">
          <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Demo user-switcher · one login, chosen role
          </p>
          {officers.map((o) => {
            const active = current?.id === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => choose(o.id)}
                className={`flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span
                  className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {o.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{o.persona}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{o.name}</span>
                </span>
                {active && <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--ok)" }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
