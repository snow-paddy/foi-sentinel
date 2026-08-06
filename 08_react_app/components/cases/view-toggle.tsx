"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { List, LayoutGrid, Gavel, Layers } from "lucide-react"

/**
 * Segmented Focus | List | Board | Reviews & ICO control for /cases. Focus is
 * the default landing view (the priority work queue). Switching the `view`
 * param keeps the other filters (regime / risk / stage) intact so a lens
 * carries across. Reviews & ICO is the post-response workspace (internal
 * reviews, ICO complaints, disclosure log) — it lives inside Cases because it
 * acts on cases.
 */
export function ViewToggle() {
  const pathname = usePathname()
  const params = useSearchParams()
  const v = params.get("view")
  const current = v === "board" ? "board" : v === "reviews" ? "reviews" : v === "list" ? "list" : "focus"

  const href = (view: "focus" | "list" | "board" | "reviews") => {
    const next = new URLSearchParams(params.toString())
    if (view === "focus") next.delete("view")
    else next.set("view", view)
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const viewTabs: { id: "focus" | "list" | "board"; label: string; icon: typeof List }[] = [
    { id: "focus", label: "Focus", icon: Layers },
    { id: "list", label: "List", icon: List },
    { id: "board", label: "Board", icon: LayoutGrid },
  ]

  const tab = (t: { id: "focus" | "list" | "board" | "reviews"; label: string; icon: typeof List }) => {
    const active = current === t.id
    const Icon = t.icon
    return (
      <Link
        key={t.id}
        href={href(t.id)}
        aria-current={active ? "page" : undefined}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          active
            ? "bg-[var(--brand-primary)] text-white"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="size-4" />
        {t.label}
      </Link>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {/* Focus / List / Board are three views of the same work queue. */}
      <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5">
        {viewTabs.map(tab)}
      </div>
      <span aria-hidden className="h-5 w-px bg-border" />
      {/* Reviews & ICO is the downstream post-response workspace. */}
      <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5">
        {tab({ id: "reviews", label: "Reviews & ICO", icon: Gavel })}
      </div>
    </div>
  )
}
