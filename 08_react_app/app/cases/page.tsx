import { Suspense } from "react"
import Link from "next/link"
import { Scale, AlertTriangle, Clock, Briefcase, Gavel, AlertOctagon, type LucideIcon } from "lucide-react"
import {
  getCases, getBoardCases, getCouncilName, PHASES,
  getInternalReviews, getIcoComplaints, getDisclosurePublications, getIcoBenchmarks, getPublishableCases,
  getEscalationCaseOptions, getFocusCases, getResponses,
  type CaseFilters, type CaseRow,
} from "@/lib/queries"
import { sentimentBand } from "@/lib/format"
import { KanbanBoard } from "@/components/board/kanban-board"
import { BoardOverview } from "@/components/board/board-overview"
import { ViewToggle } from "@/components/cases/view-toggle"
import { FocusDeck, type FocusCard } from "@/components/cases/focus-deck"
import { ComplexityChip } from "@/components/shared/complexity-chip"
import { DemoBadge } from "@/components/shared/demo-badge"
import { PrecedentPill } from "@/components/shared/precedent-match"
import { PriorityChip } from "@/components/shared/priority-chip"
import { ReviewWorkspace } from "@/components/review/review-workspace"
import { EscalationForm } from "@/components/escalations/escalation-form"
import { MyCasesStrip } from "@/components/cases/my-cases-strip"

export const dynamic = "force-dynamic"

type SP = { [k: string]: string | string[] | undefined }
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function ragStyle(rag: string): { bg: string; fg: string; label: string } {
  switch (rag.toUpperCase()) {
    case "RED": return { bg: "var(--danger-bg)", fg: "var(--danger)", label: "Red" }
    case "AMBER": return { bg: "var(--warn-bg)", fg: "var(--warn)", label: "Amber" }
    case "GREEN": return { bg: "var(--ok-bg)", fg: "var(--ok)", label: "Green" }
    case "PAUSED": return { bg: "var(--muted)", fg: "var(--muted-foreground)", label: "Paused" }
    default: return { bg: "var(--muted)", fg: "var(--muted-foreground)", label: rag || "—" }
  }
}

function fmtDate(d: string | null): string {
  if (!d) return "—"
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

// The reference prefix encodes the regime, so we drop the Regime column and
// explain the type on hover instead.
function regimeLabel(regime: string): string {
  switch (regime.toUpperCase()) {
    case "EIR": return "Environmental Information request (EIR)"
    case "SAR": return "Subject Access Request (SAR)"
    case "FOI": return "Freedom of Information request (FOI)"
    default: return regime || "Request"
  }
}

function deadlineCell(c: CaseRow) {
  const wd = c.wdRemaining
  if (wd == null) return <span className="text-muted-foreground">{fmtDate(c.deadline)}</span>
  if (wd < 0)
    return (
      <span className="font-semibold" style={{ color: "var(--danger)" }}>
        {Math.abs(wd)} day{Math.abs(wd) === 1 ? "" : "s"} overdue
      </span>
    )
  const tone = wd <= 3 ? "var(--danger)" : wd <= 7 ? "var(--warn-text)" : "var(--foreground)"
  return (
    <span style={{ color: tone }} className="tnum">
      {wd} day{wd === 1 ? "" : "s"} left
    </span>
  )
}

const FILTER_TABS: { label: string; href: string; match: (f: CaseFilters) => boolean }[] = [
  { label: "All open", href: "/cases", match: (f) => !f.risk && !f.regime && !f.stage },
  { label: "At risk", href: "/cases?risk=atrisk", match: (f) => f.risk === "atrisk" },
  { label: "Overdue", href: "/cases?risk=overdue", match: (f) => f.risk === "overdue" },
  { label: "FOI", href: "/cases?regime=FOI", match: (f) => f.regime === "FOI" },
  { label: "EIR", href: "/cases?regime=EIR", match: (f) => f.regime === "EIR" },
  { label: "SAR", href: "/cases?regime=SAR", match: (f) => f.regime === "SAR" },
]

/** Shared filter chips — apply across Focus, List and Board so one lens governs
 *  the whole Cases surface. The active filter lives in the URL. */
function FilterTabs({ filters, view }: { filters: CaseFilters; view: "focus" | "list" | "board" }) {
  const suffix = view === "board" ? "&view=board" : view === "list" ? "&view=list" : ""
  const base = view === "board" ? "/cases?view=board" : view === "list" ? "/cases?view=list" : "/cases"
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {FILTER_TABS.map((t) => {
        const active = t.match(filters) && !filters.stage
        // Preserve the current view when switching filter.
        const href = t.href === "/cases" ? base : `${t.href}${suffix}`
        return (
          <Link key={t.label} href={href}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </Link>
        )
      })}
      {filters.stage && (
        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--brand-primary)] bg-background px-2.5 py-1 text-xs font-medium text-foreground">
          Stage: {filters.stage}
          <Link href={base} className="text-muted-foreground hover:text-foreground" aria-label="Clear stage filter">✕</Link>
        </span>
      )}
    </div>
  )
}

/** Statutory strip — shared by both views, consistent with the Command Centre. */
function StatutoryStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
      <Scale className="size-3.5 shrink-0" style={{ color: "var(--brand-primary)" }} />
      <span><span className="font-semibold text-foreground">Statutory deadline:</span> respond within <span className="font-semibold text-foreground">20 working days</span></span>
      <span className="text-border" aria-hidden="true">|</span>
      <span>FOIA 2000 s.10 · EIR 2004 reg.5(2)</span>
    </div>
  )
}

/** Focus queue — the default view. Priority-ordered open cases, one card at a
 *  time, with triage + suggested answer + a fast-track flag on strong precedent
 *  matches. Drafts are preloaded so the embedded studio works inline. */
async function FocusView({ filters, council }: { filters: CaseFilters; council: string }) {
  const cases = await getFocusCases(filters, 100)
  const withDrafts: FocusCard[] = await Promise.all(
    cases.map(async (c) => ({ ...c, drafts: await getResponses(c.caseId) })),
  )
  return (
    <>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {council}: open requests, highest priority first. Step through the queue: review the AI triage, take the suggested answer, and send when you confirm.
      </p>
      <FocusDeck cases={withDrafts} />
    </>
  )
}

async function BoardView({ filters, council }: { filters: CaseFilters; council: string }) {
  const cases = await getBoardCases(filters)
  const phases = PHASES.map((p) => ({ id: p.id, label: p.label, note: p.note }))
  return (
    <>
      <BoardOverview cases={cases} council={council} />
      <KanbanBoard cases={cases} phases={phases} />
    </>
  )
}

/** Post-response workspace: internal reviews, ICO complaints, disclosure log,
 *  plus the demo escalation generator. Lives in Cases because it acts on cases. */
async function ReviewsView() {
  const [reviews, complaints, publications, benchmarks, publishable, escalationCases] = await Promise.all([
    getInternalReviews(), getIcoComplaints(), getDisclosurePublications(), getIcoBenchmarks(), getPublishableCases(),
    getEscalationCaseOptions(),
  ])

  const openReviews = reviews.filter((r) => (r.outcome ?? "").toUpperCase() === "PENDING" || r.completedDate == null).length
  const openComplaints = complaints.filter((c) => ["OPEN", "UNDER_INVESTIGATION"].includes((c.status ?? "").toUpperCase())).length
  const published = publications.length
  const bm = Object.fromEntries(benchmarks.map((b) => [b.metric, b.value]))
  const overturnPct = Math.round((bm.internal_review_overturn_rate ?? 0) * 100)

  return (
    <div className="mt-4 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Gavel className="size-5" style={{ color: "var(--brand-primary)" }} /> Reviews &amp; ICO
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          What happens after a decision is challenged. This is the statutory redress route, separate from the live queue:
          a requester can ask for an internal review (s.45 Code of Practice), then complain to the Information Commissioner (s.50).
          Closed cases are published to the disclosure log (s.19). Challenges are requester-led, so cases arrive here through escalation, not by dragging a card.
        </p>
      </div>

      {/* At-a-glance figures for the challenge workload. */}
      <div className="flex flex-wrap gap-3">
        <ReviewStat label="Internal reviews open" value={openReviews} tone="var(--brand-primary)" icon={Scale} />
        <ReviewStat label="ICO complaints open" value={openComplaints} tone="var(--warn-text)" icon={AlertOctagon} />
        <ReviewStat label="Published to log (s.19)" value={published} tone="var(--ok)" icon={Gavel} />
        <ReviewStat label="Sector overturn rate" value={`${overturnPct}%`} tone="var(--muted-foreground)" icon={Clock} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <ReviewWorkspace reviews={reviews} complaints={complaints} publications={publications} benchmarks={benchmarks} publishable={publishable} />
      </div>

      {/* Escalation generator — both intake and escalations create inbound work; this one feeds the queues above. */}
      <details className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-sm font-semibold">
          <AlertOctagon className="size-4" style={{ color: "var(--brand-primary)" }} /> Simulate an escalation (demo)
        </summary>
        <div className="border-t border-border p-5">
          <p className="mb-3 rounded-lg border border-border bg-[var(--warn-bg)] p-3 text-xs" style={{ color: "var(--warn-text)" }}>
            Synthetic test data. The escalation route runs Response → Internal Review → ICO. Generating one reopens the case and advances it to the Review stage, then it appears in the queues above.
          </p>
          <EscalationForm cases={escalationCases} />
        </div>
      </details>
    </div>
  )
}

function ReviewStat({ label, value, tone, icon: Icon }: { label: string; value: number | string; tone: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2">
      <Icon className="size-5" style={{ color: tone }} />
      <div>
        <div className="tnum text-2xl font-bold leading-none" style={{ color: tone }}>{value}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

async function ListView({ filters, council }: { filters: CaseFilters; council: string }) {
  const cases = await getCases(filters, 250)

  const lens =
    filters.stage ? `at stage “${filters.stage}”`
    : filters.risk === "atrisk" ? "at risk of breaching the deadline"
    : filters.risk === "overdue" ? "already overdue"
    : filters.regime ? `under ${filters.regime}`
    : "open"

  return (
    <>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {council}: <span className="tnum font-semibold text-foreground">{cases.length}</span> request{cases.length === 1 ? "" : "s"} {lens}.
        Requester identities are not shown here.
      </p>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {cases.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No cases match this view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-semibold" title="Type (FOI / EIR / SAR) and case number">Reference</th>
                  <th className="px-3 py-2 font-semibold">Subject</th>
                  <th className="px-3 py-2 font-semibold">Stage</th>
                  <th className="px-3 py-2 font-semibold">RAG</th>
                  <th className="px-3 py-2 font-semibold">Deadline</th>
                  <th className="px-3 py-2 font-semibold">Complexity</th>
                  <th className="px-3 py-2 font-semibold">Sentiment</th>
                  <th className="px-3 py-2 font-semibold" title="Closest previously-answered clean request (Cortex AI_SIMILARITY)">Match</th>
                  <th className="px-3 py-2 font-semibold">Owner</th>
                  <th className="px-3 py-2 font-semibold">Priority</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const r = ragStyle(c.rag)
                  const sb = c.sentiment == null ? null : sentimentBand(c.sentiment)
                  return (
                    <tr key={c.reference} className="border-b border-border transition-colors last:border-0 hover:bg-muted/50">
                      <td className="whitespace-nowrap px-2 py-2 font-mono text-xs font-semibold"
                          title={`${regimeLabel(c.regime)} · ${c.reference}`}>
                        <Link href={`/cases/${encodeURIComponent(c.reference)}`} className="rounded text-[var(--brand-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">
                          {c.reference}
                        </Link>
                        <DemoBadge reference={c.reference} className="ml-1.5 align-middle" />
                      </td>
                      <td className="max-w-[22rem] px-3 py-2">
                        <Link href={`/cases/${encodeURIComponent(c.reference)}`} className="hover:underline">
                          <span className="line-clamp-1">{c.subject}</span>
                        </Link>
                        {c.department && <span className="mt-0.5 block text-xs text-muted-foreground">{c.department}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{c.stage}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold"
                              style={{ background: r.bg, color: r.fg }}>
                          {c.rag.toUpperCase() === "RED" && <AlertTriangle className="size-3" />}
                          {r.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">{deadlineCell(c)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {c.complexity == null ? <span className="text-muted-foreground">—</span>
                          : <ComplexityChip score={c.complexity} factors={c.complexityFactors} />}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {sb == null ? <span className="text-muted-foreground">—</span>
                          : <span className="inline-flex items-center gap-1 font-semibold" style={{ color: sb.color }}
                                  title={c.sentimentRationale || undefined}>{sb.glyph} {sb.label}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {c.precedentPct == null ? <span className="text-muted-foreground">—</span>
                          : <PrecedentPill pct={c.precedentPct} />}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="flex max-w-[11rem] items-start gap-1 text-muted-foreground">
                          <Briefcase className="mt-0.5 size-3 shrink-0" /> <span>{c.ownerTitle}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs"><PriorityChip band={c.priorityBand} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        Ordered by urgency: overdue first, then red, then by working days remaining. Showing up to 250 cases.
      </p>
    </>
  )
}

async function CasesPageInner({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const viewParam = one(sp.view)
  const view = viewParam === "board" ? "board" : viewParam === "reviews" ? "reviews" : viewParam === "list" ? "list" : "focus"
  const filters: CaseFilters = {
    stage: one(sp.stage),
    regime: one(sp.regime),
    risk: one(sp.risk) === "overdue" ? "overdue" : one(sp.risk) === "atrisk" ? "atrisk" : undefined,
    status: one(sp.status),
    keyword: one(sp.keyword),
  }
  const council = await getCouncilName()

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-4">
      <StatutoryStrip />

      <div className="mt-4 mb-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Cases</h1>
        <ViewToggle />
      </div>

      <MyCasesStrip />

      {filters.keyword && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 px-3 py-2 text-sm">
          <span>Showing cases mentioning <span className="font-semibold">&ldquo;{filters.keyword}&rdquo;</span></span>
          <Link href="/cases?view=list" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Clear</Link>
        </div>
      )}

      {view !== "reviews" && <FilterTabs filters={filters} view={view} />}

      {view === "board" ? (
        <BoardView filters={filters} council={council} />
      ) : view === "reviews" ? (
        <ReviewsView />
      ) : view === "list" ? (
        <ListView filters={filters} council={council} />
      ) : (
        <FocusView filters={filters} council={council} />
      )}
    </main>
  )
}

function Skeleton() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pt-4">
      <div className="h-8 w-full animate-pulse rounded-lg bg-muted" />
      <div className="mt-4 h-96 w-full animate-pulse rounded-xl bg-muted" />
    </main>
  )
}

export default function CasesPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <CasesPageInner searchParams={searchParams} />
    </Suspense>
  )
}
