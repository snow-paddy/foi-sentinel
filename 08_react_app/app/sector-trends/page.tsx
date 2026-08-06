import { TrendingUp, ExternalLink, Sparkles } from "lucide-react"
import { getWdtkBenchmark, getWdtkThemeMix, getGlaSpotlight, getCamdenSpotlight, getRefusalDrivers, getCouncilName, getWdtkThemeSummary } from "@/lib/queries"
import { SectorSearch } from "@/components/sector/sector-search"

export const dynamic = "force-dynamic"

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export default async function SectorTrendsPage() {
  const [bench, themes, gla, camden, drivers, council, themeSummary] = await Promise.all([
    getWdtkBenchmark(), getWdtkThemeMix(), getGlaSpotlight(), getCamdenSpotlight(), getRefusalDrivers(), getCouncilName(), getWdtkThemeSummary(),
  ])

  const isHome = (a: string, slug: string) =>
    slug === "home" || a.toLowerCase() === council.toLowerCase()
  const home = bench.find((b) => isHome(b.authority, b.slug))
  const peerMedianSuccess = home?.peerMedianSuccess ?? null
  const peerMedianOverdue = home?.peerMedianOverdue ?? null

  const successSorted = [...bench].sort((a, b) => a.successRate - b.successRate)
  const overdueSorted = [...bench].sort((a, b) => b.overdueRate - a.overdueRate)
  const maxEvents = Math.max(1, ...themes.map((t) => t.events))

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-5" style={{ color: "var(--brand-primary)" }} />
        <h1 className="text-2xl font-bold tracking-tight">Sector Trends</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{council} benchmarked against peer authorities using WhatDoTheyKnow and the GLA and Camden disclosure logs.</p>

      {themeSummary && (
        <Card className="mt-4 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4" style={{ color: "var(--brand-primary)" }} /> Corpus themes (AI_AGG)
          </h2>
          <p className="mt-2 text-sm text-foreground/90">{themeSummary.text}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Summarised across a sample of {themeSummary.nEvents.toLocaleString()} WhatDoTheyKnow request titles with Cortex <code className="rounded bg-muted px-1 py-0.5">AI_AGG</code>, computed in-database and cached.
          </p>
        </Card>
      )}

      {/* KPI tiles */}
      {home && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4"><p className="text-xs text-muted-foreground">Home disclosure rate</p><p className="mt-1 text-2xl font-bold tnum">{Math.round(home.successRate * 100)}%</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Peer median disclosure</p><p className="mt-1 text-2xl font-bold tnum">{peerMedianSuccess != null ? Math.round(peerMedianSuccess * 100) : "—"}%</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Home overdue rate</p><p className="mt-1 text-2xl font-bold tnum" style={{ color: "var(--danger)" }}>{Math.round(home.overdueRate * 100)}%</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Disclosure-rate rank</p><p className="mt-1 text-2xl font-bold tnum">{home.successRank ?? "—"}{home.peerCount ? ` / ${home.peerCount}` : ""}</p></Card>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Disclosure rate ranking */}
        <Card className="p-5">
          <h2 className="text-base font-semibold">Disclosure rate vs peers</h2>
          {peerMedianSuccess != null && <p className="text-xs text-muted-foreground">Peer median {Math.round(peerMedianSuccess * 100)}%</p>}
          <ul className="mt-3 space-y-1.5">
            {successSorted.map((b) => {
              const home = isHome(b.authority, b.slug)
              return (
                <li key={b.slug} className="text-xs">
                  <div className="flex items-center justify-between"><span className={home ? "font-bold" : ""}>{b.authority}</span><span className="tnum text-muted-foreground">{Math.round(b.successRate * 100)}%</span></div>
                  <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${b.successRate * 100}%`, background: home ? "var(--brand-primary)" : "var(--muted-foreground)" }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        {/* Overdue rate ranking */}
        <Card className="p-5">
          <h2 className="text-base font-semibold">Overdue rate vs peers</h2>
          {peerMedianOverdue != null && <p className="text-xs text-muted-foreground">Peer median {Math.round(peerMedianOverdue * 100)}%</p>}
          <ul className="mt-3 space-y-1.5">
            {overdueSorted.map((b) => {
              const home = isHome(b.authority, b.slug)
              return (
                <li key={b.slug} className="text-xs">
                  <div className="flex items-center justify-between"><span className={home ? "font-bold" : ""}>{b.authority}</span><span className="tnum text-muted-foreground">{Math.round(b.overdueRate * 100)}%</span></div>
                  <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${b.overdueRate * 100}%`, background: home ? "var(--danger)" : "var(--muted-foreground)" }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      {/* Theme mix */}
      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">Exemption / theme mix across the sector</h2>
        <ul className="mt-3 space-y-2">
          {themes.map((t) => (
            <li key={t.theme} className="text-sm">
              <div className="flex items-center justify-between"><span className="font-medium">{t.theme}</span><span className="text-xs text-muted-foreground tnum">{t.disclosed} disclosed · {t.refused} refused</span></div>
              <div className="mt-1 flex h-2.5 w-full overflow-hidden rounded-full bg-muted" style={{ width: `${(t.events / maxEvents) * 100}%` }}>
                <div className="h-full" style={{ width: `${(t.disclosed / Math.max(1, t.disclosed + t.refused)) * 100}%`, background: "var(--ok)" }} />
                <div className="h-full" style={{ width: `${(t.refused / Math.max(1, t.disclosed + t.refused)) * 100}%`, background: "var(--danger)" }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Why requests get refused */}
      {drivers.length > 0 && (
        <Card className="mt-4 p-5">
          <h2 className="text-base font-semibold">Why requests get refused across the sector</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">The exemptions most often cited when peers refuse, partially withhold or don&apos;t hold information (WhatDoTheyKnow; reason extracted by Cortex). Anticipate the likely exemption at the review &amp; PIT stage (s.40/43/12).</p>
          <ul className="mt-3 space-y-2.5">
            {drivers.map((d) => {
              const maxCount = Math.max(1, ...drivers.map((x) => x.count))
              return (
                <li key={d.section} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{d.section} <span className="font-normal text-muted-foreground">{d.label}</span></span>
                    <span className="tnum shrink-0 text-xs text-muted-foreground">{d.count} {d.count === 1 ? "case" : "cases"}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(d.count / maxCount) * 100}%`, background: "var(--warn)" }} />
                  </div>
                  {d.example && <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">e.g. {d.example}</p>}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* GLA spotlight */}
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">GLA disclosure-log spotlight</h2>
          <span className="text-xs text-muted-foreground">{gla.total} entries · {gla.foi} FOI / {gla.eir} EIR · {fmtDate(gla.from)}–{fmtDate(gla.to)}</span>
        </div>
        <ul className="mt-3 space-y-2">
          {gla.recent.map((r) => (
            <li key={r.ref || r.title} className="text-sm">
              {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--brand-primary)] hover:underline">{r.title} <ExternalLink className="inline size-3" /></a> : <span className="font-medium">{r.title}</span>}
              <span className="ml-2 text-xs text-muted-foreground">{r.regime} · {r.ref} · {fmtDate(r.date)}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Camden spotlight */}
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Camden disclosure-log spotlight</h2>
          <span className="text-xs text-muted-foreground">{camden.total.toLocaleString()} entries · {camden.foi.toLocaleString()} FOI / {camden.eir.toLocaleString()} EIR · {fmtDate(camden.from)}–{fmtDate(camden.to)}</span>
        </div>
        <ul className="mt-3 space-y-2">
          {camden.recent.map((r) => (
            <li key={r.ref || r.title} className="text-sm">
              {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--brand-primary)] hover:underline">{r.title} <ExternalLink className="inline size-3" /></a> : <span className="font-medium">{r.title}</span>}
              <span className="ml-2 text-xs text-muted-foreground">{r.regime} · {r.ref} · {fmtDate(r.date)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">London Borough of Camden published FOI/EIR responses (regime derived from each response). Source: opendatastore.camden.gov.uk.</p>
      </Card>

      {/* Precedent search */}
      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">Precedent search</h2>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">Semantic search (Cortex Search) across WhatDoTheyKnow, the GLA disclosure log and Camden&apos;s published responses.</p>
        <SectorSearch />
      </Card>
    </main>
  )
}
