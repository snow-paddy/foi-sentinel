"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"

const PRIMARY = [
  { href: "/", label: "Command Centre" },
  { href: "/cases", label: "Cases" },
  { href: "/intake", label: "Intake" },
  { href: "/guidance", label: "Knowledge Base" },
]

// Grouped "More" menu, aligned to personas: insight for the buyer, and a
// separate System section for operational/meta tooling.
const MORE_GROUPS: { heading: string; items: { href: string; label: string }[] }[] = [
  {
    heading: "Insight",
    items: [
      { href: "/reporting", label: "Reporting & Cost" },
      { href: "/sector-trends", label: "Sector Trends" },
      { href: "/sar", label: "Subject Access (SAR)" },
    ],
  },
  {
    heading: "System",
    items: [
      { href: "/learning", label: "Tuning & Learning" },
      { href: "/admin", label: "Admin" },
      { href: "/about", label: "About" },
    ],
  },
]

const MORE_ITEMS = MORE_GROUPS.flatMap((g) => g.items)

function linkClass(active: boolean) {
  return `rounded-md px-2.5 py-1 font-medium transition-colors ${
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`
}

export function MainNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const moreActive = MORE_ITEMS.some((l) => isActive(l.href))

  return (
    <nav className="flex items-center gap-1 text-sm">
      {PRIMARY.map((l) => (
        <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={linkClass(isActive(l.href))}>
          {l.label}
        </Link>
      ))}
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen((o) => !o)} className={`inline-flex items-center gap-1 ${linkClass(moreActive)}`}>
          More <ChevronDown className="size-3.5" />
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-1 w-52 rounded-md border border-border bg-card p-1 shadow-lg">
            {MORE_GROUPS.map((g, gi) => (
              <div key={g.heading} className={gi > 0 ? "mt-1 border-t border-border pt-1" : undefined}>
                <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.heading}</p>
                {g.items.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setOpen(false)} aria-current={isActive(l.href) ? "page" : undefined}
                        className={`block rounded-md px-2.5 py-1.5 text-sm ${isActive(l.href) ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
