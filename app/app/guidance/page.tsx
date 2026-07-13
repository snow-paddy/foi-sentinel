import { BookOpen, Database, ExternalLink } from "lucide-react"
import { getLegislation, getPublishedTopics, getCorpusCoverage, getCouncilName, type LegislationRow, type CorpusRow, type CorpusGroup } from "@/lib/queries"
import { legislationUrl } from "@/lib/format"
import { KnowledgeTabs } from "@/components/knowledge/knowledge-tabs"
import { PeerSources } from "@/components/knowledge/peer-sources"

export const dynamic = "force-dynamic"

type Search = Promise<{ tab?: string }>

const TYPE_LABEL: Record<string, string> = {
  EXEMPTION_ABSOLUTE: "Absolute exemption",
  EXEMPTION_QUALIFIED: "Qualified exemption",
  PROCEDURE: "Procedure",
}

function CorpusCard({ r, accent, showSubSources = true }: { r: CorpusRow; accent: string; showSubSources?: boolean }) {
  const nf = (v: number) => v.toLocaleString()
  return (
    <div className="rounded-lg border border-l-4 border-border bg-card p-3" style={{ borderLeftColor: accent }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{r.label}</span>
        <span className="text-lg font-bold tnum" style={{ color: accent }}>{nf(r.count)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{r.unit} &middot; {r.scope}</p>
      <p className="mt-1 text-[11px] text-foreground/70">Accessed via: {r.access}</p>
      {showSubSources && r.subSources && r.subSources.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {r.subSources.map((s) => (
            <li key={s.label} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-foreground/80">{s.label} <span className="text-muted-foreground">&mdash; {s.access}</span></span>
              <span className="font-semibold tnum" style={{ color: accent }}>{nf(s.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EvidenceBase({ rows, total, wdtkAuthorities, council }: { rows: CorpusRow[]; total: number; wdtkAuthorities: number; council: string }) {
  const nf = (v: number) => v.toLocaleString()
  const external = rows.filter((r) => !r.internal).reduce((s, r) => s + r.count, 0)
  const internal = rows.filter((r) => r.internal).reduce((s, r) => s + r.count, 0)

  const sections: { id: CorpusGroup; label: string; note: string; accent: string }[] = [
    { id: "records", label: `${council}'s records`, note: "Factual holdings the pipeline cites directly", accent: "var(--brand-primary)" },
    { id: "logs", label: "Disclosure logs", note: "Previously published answers, used as precedent and for s.21 duplicate detection", accent: "var(--chart-6)" },
    { id: "guidance", label: "Guidance & legislation", note: "Procedure, regulator guidance and the statutory basis", accent: "var(--warn)" },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Database className="size-4" style={{ color: "var(--brand-primary)" }} /> Evidence base the pipeline retrieves against
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Every suggested answer is grounded in these corpora via Cortex Search. {nf(total)}{" "}records in total:{" "}
        {nf(external)} from external or peer-authority sources, and {nf(internal)}{" "}from this council&rsquo;s own records and published log.
      </p>

      <div className="mt-4 space-y-5">
        {sections.map((s) => {
          const items = rows.filter((r) => r.group === s.id)
          if (items.length === 0) return null
          const gridCls = s.id === "records" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
          return (
            <div key={s.id}>
              <div className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full" style={{ background: s.accent }} />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">{s.label}</h3>
                <span className="text-[11px] text-muted-foreground">{s.note}</span>
              </div>
              <div className={`mt-2 grid gap-2.5 ${gridCls}`}>
                {items.map((r) => <CorpusCard key={r.key} r={r} accent={s.accent} showSubSources={s.id !== "logs"} />)}
              </div>
              {s.id === "logs" && items.filter((r) => r.subSources && r.subSources.length > 0).map((r) => (
                <PeerSources key={`sub-${r.key}`} subSources={r.subSources!} accent={s.accent} />
              ))}
              {s.id === "logs" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  At triage the pipeline compares each incoming FOI request against this published corpus with Cortex <code className="rounded bg-muted px-1 py-0.5">AI_SIMILARITY</code> and auto-flags a likely <span className="font-medium text-foreground">s.21 duplicate</span> (information already reasonably accessible) when the closest match clears 85 per cent, pre-selecting an s.21 reuse reply that points the requester to where it is published.
                  Peer content is third-party public-sector information, re-used under the Open Government Licence / Re-use of Public Sector Information Regulations 2015. WhatDoTheyKnow material is attributed to mySociety; we store short snippets and link back to each source request, not bulk copies.
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Limitations.</span> Cross-authority precedent is concentrated in
        Camden&rsquo;s log (WhatDoTheyKnow spans {wdtkAuthorities}&nbsp;councils and GLA is a small sample), so precedent matching
        is strongest on themes those bodies have answered. This council&rsquo;s own records are wired in and cited with real
        figures, but they are <em>synthetic</em> demo tables rather than a live feed from a finance or HR system.
      </p>
    </div>
  )
}

// Map a statutory section ref to its legislation.gov.uk deep link. Only real
// statutory refs (FOIA 2000 sections, EIR 2004 regulations) are linkable;
// procedure / Code-of-Practice codes (CAT-*, CoP-Ch*, ICO, NCND, ...) are not.
function LegislationLibrary({ legislation }: { legislation: LegislationRow[] }) {
  const byType = new Map<string, LegislationRow[]>()
  for (const l of legislation) {
    const arr = byType.get(l.type) ?? []
    arr.push(l); byType.set(l.type, arr)
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground">{legislation.length} sections and Code-of-Practice references across FOIA 2000, EIR 2004 and the DPA 2018. Statutory sections link out to legislation.gov.uk.</p>
      <div className="mt-3 space-y-4">
        {[...byType.entries()].map(([type, items]) => (
          <div key={type}>
            <h3 className="text-sm font-semibold">{TYPE_LABEL[type] ?? type}</h3>
            <ul className="mt-1.5 space-y-1.5">
              {items.map((l) => {
                const url = legislationUrl(l.sectionRef)
                const pit = l.publicInterestTest && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>PIT</span>
                )
                const inner = (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {l.sectionRef}: {l.title}
                        {url && <ExternalLink className="ml-1 inline size-3 align-[-1px]" style={{ color: "var(--brand-primary)" }} />}
                      </span>
                      {pit}
                    </div>
                    {l.summary && <p className="mt-1 text-xs text-muted-foreground">{l.summary}</p>}
                  </>
                )
                return url ? (
                  <li key={l.sectionRef}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-border p-2.5 text-sm transition-colors hover:border-[var(--brand-primary)] hover:bg-muted/40">
                      {inner}
                    </a>
                  </li>
                ) : (
                  <li key={l.sectionRef} className="rounded-lg border border-border p-2.5 text-sm">
                    {inner}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function KnowledgeBasePage({ searchParams }: { searchParams: Search }) {
  const { tab } = await searchParams
  const [legislation, topics, coverage, council] = await Promise.all([getLegislation(), getPublishedTopics(), getCorpusCoverage(), getCouncilName()])
  const initialTab = tab === "legislation" ? "legislation" : "guidance"

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">
      <div className="flex items-center gap-2">
        <BookOpen className="size-5" style={{ color: "var(--brand-primary)" }} />
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        One place for the knowledge an FOI officer needs: council &amp; ICO guidance, cross-authority precedent,
        already-published information (s.21), and the legislation library.
      </p>

      <div className="mt-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <KnowledgeTabs topics={topics} legislationSlot={<LegislationLibrary legislation={legislation} />} initialTab={initialTab} />
      </div>

      <div className="mt-4">
        <EvidenceBase rows={coverage.rows} total={coverage.total} wdtkAuthorities={coverage.wdtkAuthorities} council={council} />
      </div>
    </main>
  )
}
