import { Settings } from "lucide-react"
import { getCouncilConfig, getAdminReference } from "@/lib/queries"
import { ConfigForm } from "@/components/admin/config-form"

export const dynamic = "force-dynamic"

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
}

export default async function AdminPage() {
  const [config, ref] = await Promise.all([getCouncilConfig(), getAdminReference()])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4">
      <div className="flex items-center gap-2">
        <Settings className="size-5" style={{ color: "var(--brand-primary)" }} />
        <h1 className="text-2xl font-bold tracking-tight">Admin &amp; Configuration</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Council-agnostic settings: identity, cost limits, deadlines and performance targets.</p>

      <Card className="mt-4 p-5"><ConfigForm config={config} /></Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Departments in use</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {ref.departments.map((d) => <li key={d} className="rounded-full border border-border px-2.5 py-0.5 text-xs">{d}</li>)}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold">External data sources</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="flex justify-between"><span>GLA disclosure log</span><span className="tnum text-muted-foreground">{ref.sources.gla} rows</span></li>
            <li className="flex justify-between"><span>Camden disclosure log</span><span className="tnum text-muted-foreground">{ref.sources.camden.toLocaleString()} rows</span></li>
            <li className="flex justify-between"><span>WhatDoTheyKnow events</span><span className="tnum text-muted-foreground">{ref.sources.wdtkEvents} rows</span></li>
            <li className="flex justify-between"><span>WhatDoTheyKnow authorities</span><span className="tnum text-muted-foreground">{ref.sources.wdtkAuthorities} rows</span></li>
          </ul>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">Lifecycle stages</h2>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-1.5 font-semibold">#</th><th className="py-1.5 font-semibold">Stage</th><th className="py-1.5 font-semibold">AI-assisted</th><th className="py-1.5 font-semibold">Human-gated</th>
          </tr></thead>
          <tbody>
            {ref.stages.map((s) => (
              <tr key={s.order} className="border-b border-border last:border-0">
                <td className="py-1.5 tnum text-muted-foreground">{s.order}</td>
                <td className="py-1.5">{s.name}</td>
                <td className="py-1.5">{s.aiAssisted ? "Yes" : "—"}</td>
                <td className="py-1.5">{s.humanGated ? "Yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  )
}
