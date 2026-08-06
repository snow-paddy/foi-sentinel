import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft, Scale, Clock, Briefcase, Building2, FileText, History,
  Flag, PoundSterling, AlertTriangle, CheckCircle2, PauseCircle, Info,
} from "lucide-react"
import {
  getCaseDetail, getCaseTimeline, getCaseExemptions, getLifecycleStages, getCaseTriage, getPrecedentMatch, getSarDocs, getFoiRedactions, getResponses, getAiAuditTrail, getCaseAiCost, composeResponseType,
  type CaseDetail, type ResponseType,
} from "@/lib/queries"
import { StageField } from "@/components/case/stage-changer"
import { TriagePanel } from "@/components/case/triage-panel"
import { PrecedentCard } from "@/components/shared/precedent-match"
import { SarRedactionPanel } from "@/components/case/sar-redaction-panel"
import { AiAuditTrail } from "@/components/case/ai-audit-trail"
import { ClockControl, RedactionVerify } from "@/components/case/case-actions"
import { ResponseStudio } from "@/components/studio/response-studio"
import { buildDecisionRationale } from "@/lib/format"
import { PriorityChip } from "@/components/shared/priority-chip"
import { InspectPopover } from "@/components/shared/inspect-popover"
import { HoverExplain } from "@/components/shared/hover-explain"
import { DemoBadge } from "@/components/shared/demo-badge"

export const dynamic = "force-dynamic"

type Params = Promise<{ reference: string }>

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
}

function ragStyle(rag: string) {
  switch (rag.toUpperCase()) {
    case "RED": return { bg: "var(--danger-bg)", fg: "var(--danger)", label: "Red" }
    case "AMBER": return { bg: "var(--warn-bg)", fg: "var(--warn)", label: "Amber" }
    case "GREEN": return { bg: "var(--ok-bg)", fg: "var(--ok)", label: "Green" }
    case "PAUSED": return { bg: "var(--muted)", fg: "var(--muted-foreground)", label: "Paused" }
    default: return { bg: "var(--muted)", fg: "var(--muted-foreground)", label: rag || "—" }
  }
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtDateTime(d: string) {
  if (!d) return "—"
  const dt = new Date(d.replace(" ", "T"))
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  )
}

function DeadlineBanner({ c }: { c: CaseDetail }) {
  const wd = c.wdRemaining
  const closed = c.status.toUpperCase() === "CLOSED"
  let tone = "var(--ok)"
  let headline = ""
  let icon = <CheckCircle2 className="size-5" />
  if (closed) {
    tone = c.outcome ? "var(--muted-foreground)" : "var(--ok)"
    headline = `Closed${c.outcome ? `: ${c.outcome}` : ""}`
  } else if (c.clockState && c.clockState.toUpperCase() !== "RUNNING") {
    tone = "var(--warn-text)"
    headline = "Clock stopped, awaiting clarification"
    icon = <PauseCircle className="size-5" />
  } else if (wd == null) {
    tone = "var(--muted-foreground)"
    headline = "No deadline set"
  } else if (wd < 0) {
    tone = "var(--danger)"
    headline = `${Math.abs(wd)} working day${Math.abs(wd) === 1 ? "" : "s"} overdue`
    icon = <AlertTriangle className="size-5" />
  } else {
    tone = wd <= 3 ? "var(--danger)" : wd <= 7 ? "var(--warn-text)" : "var(--ok)"
    headline = `${wd} working day${wd === 1 ? "" : "s"} remaining`
    icon = wd <= 7 ? <Clock className="size-5" /> : <CheckCircle2 className="size-5" />
  }
  return (
    <Card className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
      <div className="flex items-center gap-2" style={{ color: tone }}>
        {icon}
        <span className="text-lg font-bold">{headline}</span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>Received <span className="font-medium text-foreground">{fmtDate(c.receivedDate)}</span></span>
        <span>Statutory deadline <span className="font-medium text-foreground">{fmtDate(c.deadline)}</span></span>
        {c.workingDaysUsed != null && (
          <span>Working days used <span className="tnum font-medium text-foreground">{c.workingDaysUsed}</span></span>
        )}
      </div>
    </Card>
  )
}

async function CaseView({ params }: { params: Params }) {
  const { reference } = await params
  const ref = decodeURIComponent(reference)
  const detail = await getCaseDetail(ref)
  if (!detail) notFound()

  const [timeline, exemptions, stages, triage, precedent] = await Promise.all([
    getCaseTimeline(detail.caseId),
    getCaseExemptions(detail.caseId),
    getLifecycleStages(),
    getCaseTriage(detail.caseId),
    getPrecedentMatch(detail.reference),
  ])
  const [aiTrail, aiCost] = await Promise.all([getAiAuditTrail(detail.reference), getCaseAiCost(detail.reference)])

  const rag = ragStyle(detail.rag)
  const closed = detail.status.toUpperCase() === "CLOSED"
  const sarDocs = detail.regime === "SAR" ? await getSarDocs(detail.reference) : []
  const foiRedactions = detail.regime === "SAR" ? [] : await getFoiRedactions(detail.caseId)
  const responses = await getResponses(detail.caseId)

  // Pre-suggest the response type by COMPOSING the dispositions (already-published,
  // withheld, released) rather than letting the first matching rule win — so a request
  // that is part published and part new is shown as mixed, not collapsed to s.21.
  const applied = exemptions.filter((e) => e.decision.toLowerCase() === "apply")
  const disclosed = exemptions.filter((e) => e.decision.toLowerCase() === "disclose")
  const composed = composeResponseType({
    published: Boolean(triage?.s21MatchRef),
    publishedRef: triage?.s21MatchRef ?? "",
    publishedPct: triage?.s21SimilarityPct ?? null,
    withheldSections: [...new Set(applied.map((e) => e.sectionRef).filter(Boolean))],
    releasing: disclosed.length > 0,
  })
  let suggestedType: ResponseType = composed.type
  let suggestedReason = composed.reason

  // A typed, undispatched draft already reflects the officer's decision. Open the
  // studio on that type so the selector matches the letter below it, overriding the
  // triage guess only when the two disagree.
  const VALID_TYPES: ResponseType[] = ["DISCLOSURE", "PARTIAL", "REFUSAL", "S21_REUSE", "MIXED_S21"]
  const DRAFT_TYPE_REASON: Record<ResponseType, string> = {
    DISCLOSURE: "Existing draft releases the information in full.",
    PARTIAL: "Existing draft withholds part of the information under exemptions.",
    REFUSAL: "Existing draft withholds the information under exemptions.",
    S21_REUSE: "Existing draft reuses an already-published response.",
    MIXED_S21: "Existing draft answers the request in parts: some already published, some newly answered.",
  }
  const liveDraft = responses.find((r) => !r.dispatchedAt)
  const draftType = liveDraft ? (liveDraft.responseType.toUpperCase() as ResponseType) : null
  if (draftType && VALID_TYPES.includes(draftType) && draftType !== suggestedType) {
    suggestedType = draftType
    suggestedReason = DRAFT_TYPE_REASON[draftType]
  }

  // Plain-English "why this outcome" summary, shown outside the draft box. Built from the
  // officer's own exemption assessments + triage so it always matches the letter's outcome.
  const draftText = liveDraft ? (liveDraft.finalText || liveDraft.draftText) : (responses[0]?.finalText || responses[0]?.draftText || "")
  const decision = buildDecisionRationale({
    type: suggestedType,
    exemptions: exemptions.map((e) => ({ sectionRef: e.sectionRef, pitFor: e.pitFor, pitAgainst: e.pitAgainst, decision: e.decision })),
    s21MatchRef: triage?.s21MatchRef || undefined,
    draftText,
  }) ?? undefined

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">
      <Link href="/cases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to cases
      </Link>

      {/* Statutory strip */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
        <Scale className="size-3.5 shrink-0" style={{ color: "var(--brand-primary)" }} />
        <span>{detail.regime === "EIR" ? "EIR 2004 reg.5(2)" : detail.regime === "SAR" ? "UK GDPR Art.12 / DPA 2018" : "FOIA 2000 s.10"}</span>
        {detail.legalBasis && (<><span className="text-border" aria-hidden="true">|</span><span>{detail.legalBasis}</span></>)}
      </div>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-muted-foreground">{detail.reference}</span>
            <DemoBadge reference={detail.reference} />
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold">{detail.regime}</span>
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold"
                  style={{ background: rag.bg, color: rag.fg }}>
              {detail.rag.toUpperCase() === "RED" && <AlertTriangle className="size-3" />}{rag.label}
            </span>
            {detail.isVexatious && (
              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold"
                    style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                <Flag className="size-3" /> s.14 flagged
              </span>
            )}
          </div>
          <h1 className="mt-1 max-w-3xl text-2xl font-bold tracking-tight">{detail.subject}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            From <span className="font-medium text-foreground">{detail.requester}</span>
            {detail.source && <> · via {detail.source}</>}
          </p>
        </div>
      </div>

      <DeadlineBanner c={detail} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <FileText className="size-4" style={{ color: "var(--brand-primary)" }} /> The request
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {detail.requestText || "No request text recorded."}
            </p>
          </Card>

          {/* Drafting the answer — the operator's primary action, given full width for clarity */}
          {detail.regime === "SAR" && <SarRedactionPanel reference={detail.reference} docs={sarDocs} />}

          {triage && <TriagePanel triage={triage} />}

          {(!closed || responses.length > 0) && (
            <ResponseStudio reference={detail.reference} drafts={responses} initialType={suggestedType} suggestedReason={suggestedReason} precedentRef={precedent?.ref || undefined} decision={decision} />
          )}

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <History className="size-4" style={{ color: "var(--brand-primary)" }} /> Case history
            </h2>
            {timeline.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No recorded events yet.</p>
            ) : (
              <ol className="mt-3 space-y-0">
                {timeline.map((e, i) => (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: "var(--brand-primary)" }} />
                      {i < timeline.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="-mt-0.5 pb-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold">{e.eventType || "Event"}</span>
                        {e.fromStage && e.toStage && (
                          <span className="text-xs text-muted-foreground">{e.fromStage} → {e.toStage}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(e.ts)}{e.actor && <> · {e.actor}{e.actorType && ` (${e.actorType})`}</>}
                      </div>
                      {e.note && <p className="mt-0.5 text-sm text-foreground/80">{e.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Details</h2>
            <div className="mt-2">
              <Fact label="Status">{detail.status}</Fact>
              <StageField
                reference={detail.reference}
                stageCode={detail.stageCode}
                stageName={detail.stage}
                stageOrder={detail.stageOrder}
                stages={stages}
                editable={!closed}
              />
              <Fact label="Owner"><span className="inline-flex items-center gap-1"><Briefcase className="size-3.5 text-muted-foreground" />{detail.ownerTitle}</span></Fact>
              <Fact label="Department"><span className="inline-flex items-center gap-1"><Building2 className="size-3.5 text-muted-foreground" />{detail.department || "—"}</span></Fact>
              <Fact label="Priority">{detail.priorityBand ? (
                <InspectPopover
                  label="How priority is calculated"
                  explanation="Priority is set at AI triage. Cortex produces a PRIORITY_SCORE from four signals: complexity, negative sentiment, deadline pressure (working days remaining) and any vexatious flag. It is then banded High (score 6+), Medium (4+) or Low."
                  sources={["V_CASE"]}
                  query={`-- How this case's priority was scored\nSELECT REFERENCE, PRIORITY_BAND, PRIORITY_SCORE,\n       COMPLEXITY_RANK, SENTIMENT_SCORE, WD_REMAINING, IS_VEXATIOUS\nFROM FOI.FOI_SENTINEL_V2.V_CASE\nWHERE REFERENCE = '${detail.reference}';`}
                >
                  <PriorityChip band={detail.priorityBand} />
                </InspectPopover>
              ) : "—"}</Fact>
              {closed && <Fact label="Outcome">{detail.outcome || "—"}</Fact>}
              {closed && <Fact label="Closed">{fmtDate(detail.closedDate)}</Fact>}
            </div>
            {!closed && <ClockControl reference={detail.reference} clockState={detail.clockState} />}
          </Card>

          {precedent && <PrecedentCard reference={detail.reference} match={precedent} />}

          {aiTrail.decisions.length > 0 && <AiAuditTrail trail={aiTrail} />}

          {aiCost && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <PoundSterling className="size-4" style={{ color: "var(--brand-primary)" }} /> AI cost of this response
                <HoverExplain
                  title="How this is metered"
                  description={<>Metered from real Cortex token usage via the editable <code>AI_MODEL_RATE_CARD</code> (list rates, confirm against your contract).</>}
                  className="text-muted-foreground"
                >
                  <Info className="size-3.5" />
                </HoverExplain>
              </h2>
              <div className="mt-2">
                <InspectPopover
                  label="How this is metered"
                  explanation="Every Cortex call on this case is logged to FOI_AI_USAGE with real token counts (COUNT_TOKENS) and costed via the editable AI_MODEL_RATE_CARD at list rates. This is the metered spend to triage, ground, draft and self-check the response."
                  sources={["FOI_AI_USAGE", "AI_MODEL_RATE_CARD"]}
                  query={`-- Metered AI cost for this case, by stage\nSELECT STAGE, COUNT(*) AS calls, SUM(INPUT_TOKENS + OUTPUT_TOKENS) AS tokens, ROUND(SUM(EST_GBP), 4) AS gbp\nFROM FOI.FOI_SENTINEL_V2.FOI_AI_USAGE\nWHERE CASE_REF = '${detail.reference}'\nGROUP BY STAGE ORDER BY gbp DESC;`}
                >
                  <span className="text-3xl font-bold tnum" style={{ color: "var(--ok)" }}>£{aiCost.gbp.toFixed(4)}</span>
                </InspectPopover>
              </div>
              <p className="mt-1 text-xs text-muted-foreground tnum">
                {aiCost.calls} Cortex call{aiCost.calls === 1 ? "" : "s"} · {aiCost.tokens.toLocaleString()} tokens{aiCost.avgLatencyMs != null ? ` · ${(aiCost.avgLatencyMs / 1000).toFixed(1)}s avg` : ""}
              </p>
            </Card>
          )}

          {foiRedactions.length > 0 && (
            <Card className="p-5">
              <h2 className="text-base font-semibold">Redactions</h2>
              <p className="mt-1 text-xs text-muted-foreground">AI-suggested. Every redaction must be verified by a human before release.</p>
              <ul className="mt-2 space-y-2">
                {foiRedactions.map((rd) => (
                  <li key={rd.redactionId} className="rounded-lg border border-border p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{rd.basisSection || "—"}</span>
                      {rd.verified
                        ? <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--ok)" }}><CheckCircle2 className="size-3.5" /> Verified</span>
                        : <span className="text-xs font-medium" style={{ color: "var(--warn-text)" }}>Unverified</span>}
                    </div>
                    <p className="mt-1 text-foreground/80">{rd.excerpt}</p>
                    {!closed && !rd.verified && <RedactionVerify reference={detail.reference} redactionId={rd.redactionId} />}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}

function Skeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-4">
      <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-24 w-full animate-pulse rounded-xl bg-muted" />
      <div className="mt-4 h-96 w-full animate-pulse rounded-xl bg-muted" />
    </main>
  )
}

export default function CaseDetailPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <CaseView params={params} />
    </Suspense>
  )
}
