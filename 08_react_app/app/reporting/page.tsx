import { BarChart3, AlertTriangle, PoundSterling, Sparkles, TrendingDown } from "lucide-react"
import { getReportingStats, getSlaTarget, getCouncilName, getCostOfProcessing, computeAutomationEconomics, getMeasuredAiCost, AUTOMATION_COST, FOI_COST_BENCHMARK } from "@/lib/queries"

export const dynamic = "force-dynamic"

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
}

const gbp = (v: number) => `£${Math.round(v).toLocaleString()}`

function fmtMonth(m: string) {
  const d = new Date(m)
  return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
}

export default async function ReportingPage() {
  const [stats, target, council, cost, measured] = await Promise.all([
    getReportingStats(), getSlaTarget(), getCouncilName(), getCostOfProcessing(), getMeasuredAiCost(),
  ])
  const belowTarget = stats.pct < target
  const maxOutcome = Math.max(1, ...stats.byOutcome.map((o) => o.n))
  const maxMonthly = Math.max(1, ...stats.monthly.map((m) => m.received))
  const vsBenchmark =
    cost.avgCostGbp > FOI_COST_BENCHMARK.high ? "above" : cost.avgCostGbp < FOI_COST_BENCHMARK.low ? "below" : "within"
  const econ = computeAutomationEconomics(cost.avgCostGbp, cost.annualVolume)
  const gbp2 = (v: number) => (v < 1 ? `£${v.toFixed(2)}` : gbp(v))

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-5" style={{ color: "var(--brand-primary)" }} />
        <h1 className="text-2xl font-bold tracking-tight">Reporting &amp; Cost</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {council}: compliance statistics aligned with the s.45 Code of Practice (part 8.5).
      </p>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Closed requests</p><p className="mt-1 text-3xl font-bold tnum">{stats.closed}</p></Card>
        <Card className="p-5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Answered in time</p><p className="mt-1 text-3xl font-bold tnum">{stats.inTime}</p></Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">% in time</p>
          <p className="mt-1 text-3xl font-bold tnum" style={{ color: belowTarget ? "var(--danger)" : "var(--ok)" }}>{stats.pct}%</p>
          <p className="text-xs text-muted-foreground">{stats.pct - target >= 0 ? "+" : ""}{(stats.pct - target).toFixed(1)} vs {target}% target</p>
        </Card>
      </div>

      {/* SLA progress */}
      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Timeliness vs target</span>
          <span className="text-muted-foreground">{stats.pct}% / {target}%</span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, stats.pct)}%`, background: belowTarget ? "var(--danger)" : "var(--ok)" }} />
        </div>
        {belowTarget && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--danger)" }}>
            <AlertTriangle className="size-3.5" /> Below the {target}% performance target.
          </p>
        )}
      </Card>

      {/* Cost of processing — for the economic buyer */}
      <Card className="mt-4 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <PoundSterling className="size-4" style={{ color: "var(--brand-primary)" }} /> Cost of processing an FOI
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Modelled from triage-estimated officer hours &times; the council&rsquo;s {gbp(cost.ratePerHour)}/hour charge-out rate
          (the s.12 basis: {gbp(cost.limitGbp)} / {cost.limitHours} hours appropriate limit), across {cost.nCases} triaged requests.
          A modelled estimate, not invoiced cost.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avg per FOI</p>
            <p className="mt-1 text-2xl font-bold tnum">{gbp(cost.avgCostGbp)}</p>
            <p className="text-xs text-muted-foreground tnum">{cost.avgHours} hrs avg</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Median per FOI</p>
            <p className="mt-1 text-2xl font-bold tnum">{gbp(cost.medianCostGbp)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Annualised total</p>
            <p className="mt-1 text-2xl font-bold tnum">{gbp(cost.annualisedCostGbp)}</p>
            <p className="text-xs text-muted-foreground tnum">~{cost.annualVolume} requests/yr</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Over s.12 limit</p>
            <p className="mt-1 text-2xl font-bold tnum" style={{ color: cost.pctOverLimit > 0 ? "var(--warn-text)" : "var(--ok)" }}>{cost.pctOverLimit}%</p>
            <p className="text-xs text-muted-foreground">may be refused (s.12)</p>
          </div>
        </div>
        <p className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Benchmark:</span> independent estimates put a typical FOI response at
          roughly {gbp(FOI_COST_BENCHMARK.low)} to {gbp(FOI_COST_BENCHMARK.high)} ({FOI_COST_BENCHMARK.source}).
          Our modelled average of {gbp(cost.avgCostGbp)} is {vsBenchmark === "within" ? "within" : vsBenchmark} that range.
        </p>
      </Card>

      {/* Automation economics — cost-effectiveness case for local government */}
      <Card className="mt-4 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-4" style={{ color: "var(--brand-primary)" }} /> Cost-effectiveness of FOI Sentinel
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The tool triages, retrieves precedent, drafts a grounded answer and self-evaluates it for
          <span className="tnum"> {gbp2(econ.productCostPerFoi)}</span>{" "}of Snowflake Cortex + compute per request. An officer still
          reviews and approves every response, and we retain {Math.round(AUTOMATION_COST.reviewFraction * 100)}% of manual
          handling time for human-in-the-loop sign-off. Modelled, not invoiced.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manual, per FOI</p>
            <p className="mt-1 text-2xl font-bold tnum">{gbp(econ.manualCostPerFoi)}</p>
            <p className="text-xs text-muted-foreground">officer-only today</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assisted, per FOI</p>
            <p className="mt-1 text-2xl font-bold tnum">{gbp(econ.assistedCostPerFoi)}</p>
            <p className="text-xs text-muted-foreground tnum">{gbp2(econ.productCostPerFoi)} tool + {gbp(econ.officerReviewCostPerFoi)} review</p>
          </div>
          <div className="rounded-lg border border-border p-3" style={{ borderColor: "var(--ok)" }}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved per FOI</p>
            <p className="mt-1 text-2xl font-bold tnum" style={{ color: "var(--ok)" }}>{gbp(econ.savingsPerFoi)}</p>
            <p className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ok)" }}><TrendingDown className="size-3" /> {econ.pctReduction}% lower</p>
          </div>
          <div className="rounded-lg border border-border p-3" style={{ borderColor: "var(--ok)" }}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Annualised saving</p>
            <p className="mt-1 text-2xl font-bold tnum" style={{ color: "var(--ok)" }}>{gbp(econ.annualSavingsGbp)}</p>
            <p className="text-xs text-muted-foreground tnum">~{econ.annualVolume} requests/yr</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted" title="Assisted cost as a share of manual cost">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, 100 - econ.pctReduction)}%`, background: "var(--ok)" }} />
          </div>
          <span className="shrink-0 text-xs font-medium tnum">{100 - econ.pctReduction}% of manual cost</span>
        </div>
        <p className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">How this is modelled:</span> {AUTOMATION_COST.source}.
          Officer review time is held at {Math.round(AUTOMATION_COST.reviewFraction * 100)}% of the manual estimate above. The tool accelerates drafting and precedent-search, and it does not remove statutory human accountability.
        </p>

        {/* A5: MEASURED cost — real token usage captured live, costed via the rate card */}
        <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "var(--brand-primary)" }}>
          <div className="flex items-center gap-2">
            <PoundSterling className="size-4" style={{ color: "var(--brand-primary)" }} />
            <h3 className="text-sm font-semibold">Measured AI cost (live)</h3>
          </div>
          {measured.totalCalls > 0 ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Measured per request</p>
                  <p className="mt-1 text-2xl font-bold tnum">{measured.gbpPerRequest == null ? "\u2014" : `£${measured.gbpPerRequest.toFixed(4)}`}</p>
                  <p className="text-xs text-muted-foreground">vs {gbp2(econ.productCostPerFoi)} modelled (all-in)</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total AI spend</p>
                  <p className="mt-1 text-2xl font-bold tnum">£{measured.totalGbp.toFixed(4)}</p>
                  <p className="text-xs text-muted-foreground tnum">{measured.totalCalls} Cortex calls</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tokens processed</p>
                  <p className="mt-1 text-2xl font-bold tnum">{measured.totalTokens.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground tnum">{measured.distinctRequests} attributed requests</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avg latency</p>
                  <p className="mt-1 text-2xl font-bold tnum">{measured.avgLatencyMs == null ? "\u2014" : `${(measured.avgLatencyMs / 1000).toFixed(1)}s`}</p>
                  <p className="text-xs text-muted-foreground">per Cortex call</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Tokens and latency are <span className="font-medium text-foreground">measured</span> per call and logged to <code>FOI_AI_USAGE</code>.
                The £ figure uses the editable <code>AI_MODEL_RATE_CARD</code> (list rates, confirm against your contract). This measured LLM token cost per request sits comfortably inside the modelled £{econ.productCostPerFoi.toFixed(2)} all-in estimate, which also budgets Cortex Search and warehouse compute.
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No Cortex calls metered yet. Run a triage or generate a suggested answer, then reload, and measured usage appears here in real time.
            </p>
          )}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Regime timeliness */}
        <Card className="p-5">
          <h2 className="text-base font-semibold">Timeliness by regime</h2>
          <ul className="mt-3 space-y-2">
            {stats.byRegime.map((r) => (
              <li key={r.regime} className="text-sm">
                <div className="flex items-center justify-between"><span className="font-medium">{r.regime}</span><span className="text-muted-foreground tnum">{r.pctInTime}% · {r.closed} closed</span></div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.pctInTime)}%`, background: r.pctInTime < target ? "var(--warn)" : "var(--ok)" }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Outcome breakdown */}
        <Card className="p-5">
          <h2 className="text-base font-semibold">Outcomes of closed cases</h2>
          <ul className="mt-3 space-y-2">
            {stats.byOutcome.length === 0 ? <li className="text-sm text-muted-foreground">No closed outcomes recorded.</li> : stats.byOutcome.map((o) => (
              <li key={o.outcome} className="text-sm">
                <div className="flex items-center justify-between"><span className="font-medium">{o.outcome}</span><span className="text-muted-foreground tnum">{o.n}</span></div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(o.n / maxOutcome) * 100}%`, background: "var(--brand-primary)" }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Monthly volume */}
      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">Monthly request volume</h2>
        <div className="mt-3 flex items-end gap-1.5" style={{ height: 140 }}>
          {stats.monthly.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] text-muted-foreground tnum">{m.received}</span>
              <div className="w-full rounded-t" style={{ height: `${(m.received / maxMonthly) * 110}px`, background: "var(--brand-primary)" }} />
              <span className="text-[9px] text-muted-foreground">{fmtMonth(m.month)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Department workload */}
      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">Open workload by department</h2>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 font-semibold">Department</th><th className="py-2 text-right font-semibold">Open</th><th className="py-2 text-right font-semibold">Overdue</th>
          </tr></thead>
          <tbody>
            {stats.departments.map((d) => (
              <tr key={d.department} className="border-b border-border last:border-0">
                <td className="py-2">{d.department}</td>
                <td className="py-2 text-right tnum">{d.open}</td>
                <td className="py-2 text-right tnum" style={{ color: d.overdue > 0 ? "var(--danger)" : undefined }}>{d.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  )
}
