"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Briefcase, ChevronDown } from "lucide-react"

interface MyCase {
  reference: string
  subject: string
  stage: string
  status: string
  deadline: string
}

/**
 * A compact strip of the cases assigned to whoever you are acting as. Reads the
 * acting-as cookie server-side; renders nothing when no officer is selected or
 * none are assigned, so it stays out of the way for the default view.
 */
export function MyCasesStrip() {
  const [officer, setOfficer] = useState<string | null>(null)
  const [cases, setCases] = useState<MyCase[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let live = true
    fetch("/api/my-cases")
      .then((r) => r.json())
      .then((d) => {
        if (!live || !d.ok) return
        setOfficer(d.officerName ?? null)
        setCases(d.cases ?? [])
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  if (!officer || cases.length === 0) return null

  return (
    <div className="mb-3 rounded-xl border border-border bg-card p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold"
      >
        <Briefcase className="size-4" style={{ color: "var(--brand-primary)" }} />
        My cases
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {cases.length} assigned to {officer}
        </span>
        <ChevronDown className={`ml-auto size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-border">
          {cases.map((c) => (
            <li key={c.reference}>
              <Link
                href={`/cases/${encodeURIComponent(c.reference)}`}
                className="flex items-center gap-2 py-1.5 text-sm hover:bg-muted"
              >
                <span className="font-mono text-xs">{c.reference}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.subject}</span>
                <span className="text-xs text-muted-foreground">{c.stage}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
