import { Suspense } from "react"
import { Scale, AlertTriangle, Clock, CheckCircle2, TrendingUp, Activity } from "lucide-react"
import {
  getHeadline, getSlaTarget, getCouncilName, getPipeline,
  getPeerBenchmark, getRequesterPatterns, getWordCloud,
} from "@/lib/queries"
import { SlaGauge } from "@/components/command-centre/sla-gauge"
import { PipelineSection } from "@/components/command-centre/pipeline-section"
import { RequesterTable } from "@/components/command-centre/requester-table"
import { TermsPanel } from "@/components/command-centre/terms-panel"
import Link from "next/link"

// Snowflake is not reachable during docker build.
export const dynamic = "force-dynamic"

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function StatTile({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-background px-3 py-2"
         style={{ borderLeft: `4px solid ${accent}` }}>
      <span className="tnum text-2xl font-extrabold leading-none">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

async function CommandCentre() {
  const council = await getCouncilName()
  const [headline, target, pipeline, peer, requesters, words] = await Promise.all([
    getHeadline(),
    getSlaTarget(),
    getPipeline(),
    getPeerBenchmark(council),
    getRequesterPatterns(10),
    getWordCloud(45),
  ])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">
      {/* Statutory reference — slim strip framing the page */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
        <Scale className="size-3.5 shrink-0" style={{ color: "var(--brand-primary)" }} />
        <span><span className="font-semibold text-foreground">Statutory deadline:</span> respond within <span className="font-semibold text-foreground">20 working days</span></span>
        <span className="text-border">|</span>
        <span>FOIA 2000 s.10 · EIR 2004 reg.5(2)</span>
        <span className="text-border">|</span>
        <span>regulator target <span className="font-semibold tnum text-foreground">{target}%</span> answered in time</span>
      </div>

      {/* Title */}
      <div className="mt-4 mb-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Activity className="size-6" style={{ color: "var(--brand-primary)" }} />
          FOI Command Centre
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {council}: the headline view of Freedom of Information and Environmental Information work
        </p>
      </div>

      {/* Hero scorecard — headline numbers wrapped around the speedometer */}
      <Card className="p-5">
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          {/* Left — open work */}
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live · open</div>
              <div className="tnum text-5xl font-extrabold leading-none">{headline.open}</div>
              <div className="text-sm text-muted-foreground">open requests</div>
            </div>
            <div className="flex gap-2">
              <Link href="/cases?risk=atrisk"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                <AlertTriangle className="size-3.5" /> {headline.atRisk} at risk
              </Link>
              <Link href="/cases?risk=overdue"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                <Clock className="size-3.5" /> {headline.overdue} overdue
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-1.5 border-t border-border pt-2 text-center">
              {[["FOI", headline.foi], ["EIR", headline.eir], ["SAR", headline.sar]].map(([k, v]) => (
                <Link key={k as string} href={`/cases?regime=${k}`}
                      className="rounded-md py-0.5 transition-colors hover:bg-muted">
                  <div className="tnum text-lg font-bold">{v as number}</div>
                  <div className="text-[11px] text-muted-foreground">{k as string}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Centre — speedometer */}
          <div className="flex justify-center md:px-2">
            <SlaGauge pct={headline.pct} target={target} />
          </div>

          {/* Right — throughput */}
          <div className="flex flex-col gap-3 md:items-end md:text-right">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This period</div>
              <div className="tnum text-5xl font-extrabold leading-none" style={{ color: "var(--ok)" }}>{headline.closed}</div>
              <div className="text-sm text-muted-foreground">closed requests</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Peer benchmark */}
      {peer && (
        <Card className="mt-4 flex items-center gap-2 px-4 py-3 text-sm">
          <TrendingUp className="size-4 shrink-0" style={{ color: "var(--brand-primary)" }} />
          <span>
            <span className="font-semibold">Versus peers (WhatDoTheyKnow):</span> {council} discloses information on{" "}
            <span className="font-semibold tnum">{Math.round(peer.successRate * 100)}%</span> of requests,{" "}
            {peer.position} the peer median of <span className="tnum">{Math.round(peer.peerMedian * 100)}%</span>, ranked{" "}
            <span className="font-semibold tnum">{peer.rank} of {peer.peerCount}</span>.
          </span>
        </Card>
      )}

      {/* Pipeline — bottlenecks first, full funnel on demand */}
      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">Where requests are in the process</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Open requests across the 5-step statutory FOIA process. Expand a step to see the detailed lifecycle stages within it, or click through to the cases.
        </p>
        <PipelineSection stages={pipeline} />
      </Card>

      {/* Intelligence */}
      <div className="mt-6 mb-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="size-5" style={{ color: "var(--brand-primary)" }} />
          Intelligence, powered by Snowflake Cortex
        </h2>
        <p className="text-sm text-muted-foreground">
          Case systems store requests. Snowflake analyses them in place: themes, trends and patterns across the whole corpus.
          Synthetic test cases are excluded so these reflect the real request corpus.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <TermsPanel words={words} />
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold">Requester patterns</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Repeat requesters and potential campaigns. Individuals are anonymised: names are hashed inside Snowflake and never
            leave the database. Organisations are shown by name. <span className="font-medium">Section 14</span> lets a council
            refuse a <em>vexatious</em> request. The flag is a prompt for officer judgement, and it is not an automatic refusal.
          </p>
          <RequesterTable rows={requesters} />
        </Card>
      </div>
    </main>
  )
}

function CommandCentreSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-4">
      <div className="h-8 w-full animate-pulse rounded-lg bg-muted" />
      <div className="mt-4 h-56 w-full animate-pulse rounded-xl bg-muted" />
      <div className="mt-4 h-96 w-full animate-pulse rounded-xl bg-muted" />
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<CommandCentreSkeleton />}>
      <CommandCentre />
    </Suspense>
  )
}
