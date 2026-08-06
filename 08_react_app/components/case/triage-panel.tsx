import { Sparkles, Building2, Clock3, Flag, Copy } from "lucide-react"
import type { CaseTriage } from "@/lib/queries"
import { sentimentBand } from "@/lib/format"

/**
 * Presentational panel that explains how the AI triaged a case — classification,
 * complexity (with the concrete drivers), requester sentiment (with rationale),
 * suggested departments, effort, vexatious flag and a provenance footer. Fed a
 * normalised CaseTriage, so the same panel serves the case detail page now and
 * the live Email Intake demo later (stored vs freshly-computed triage).
 */
export function TriagePanel({ triage }: { triage: CaseTriage }) {
  const sb = triage.sentimentScore == null ? null : sentimentBand(triage.sentimentScore)
  const cx = triage.complexityScore
  const cxColor = cx == null ? "var(--muted-foreground)" : cx >= 7 ? "var(--danger)" : cx >= 4 ? "var(--warn-text)" : "var(--ok)"

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Sparkles className="size-4" style={{ color: "var(--brand-primary)" }} />
        <h2 className="text-base font-semibold">How AI triaged this case</h2>
      </div>

      <div className="space-y-4 p-5">
        {/* Classification + priority */}
        <div className="flex flex-wrap items-center gap-2">
          {triage.classification && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">{triage.classification}</span>
          )}
          {triage.priority && (
            <span className="text-xs text-muted-foreground">
              Priority <span className="font-semibold text-foreground">{triage.priority}</span>
            </span>
          )}
          {triage.isVexatious && (
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold"
                  style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
              <Flag className="size-3" /> Potentially vexatious (s.14)
            </span>
          )}
        </div>

        {/* Complexity + factors */}
        {cx != null && (
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Complexity</span>
              <span className="tnum text-sm font-bold" style={{ color: cxColor }}>{cx.toFixed(1)} / 10</span>
            </div>
            {triage.complexityFactors.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {triage.complexityFactors.map((f, i) => (
                  <li key={i} className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs">{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Sentiment + rationale */}
        {sb && (
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requester tone</span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: sb.color }}>
                {sb.glyph} {sb.label}
                {triage.sentimentScore != null && (
                  <span className="tnum font-normal text-muted-foreground">
                    ({triage.sentimentScore > 0 ? "+" : ""}{triage.sentimentScore.toFixed(2)})
                  </span>
                )}
              </span>
            </div>
            {triage.sentimentRationale && (
              <p className="mt-1 text-sm text-foreground/80">{triage.sentimentRationale}</p>
            )}
          </div>
        )}

        {/* Suggested departments + effort */}
        {(triage.departments.length > 0 || triage.estimatedHours != null) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {triage.departments.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="size-3.5" />
                {triage.departments.map((d, i) => (
                  <span key={i} className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">{d}</span>
                ))}
              </span>
            )}
            {triage.estimatedHours != null && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock3 className="size-3.5" />
                Est. <span className="font-semibold text-foreground">{triage.estimatedHours}h</span> officer effort
              </span>
            )}
          </div>
        )}

        {/* Extracted scope (AI_EXTRACT) */}
        {triage.scope && (triage.scope.dateRange || triage.scope.departments || triage.scope.documents) && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scope (AI_EXTRACT)</span>
            <ul className="mt-1.5 space-y-1 text-sm text-foreground/80">
              {triage.scope.dateRange && <li><span className="text-muted-foreground">Period:</span> {triage.scope.dateRange}</li>}
              {triage.scope.departments && <li><span className="text-muted-foreground">Areas:</span> {triage.scope.departments}</li>}
              {triage.scope.documents && <li><span className="text-muted-foreground">Records:</span> {triage.scope.documents}</li>}
            </ul>
          </div>
        )}

        {/* s.21 duplicate */}
        {triage.s21MatchRef && (
          <div className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
               style={{ background: "var(--warn-bg)", color: "var(--warn-text)" }}>
            <Copy className="size-3.5" /> Possible s.21 duplicate of {triage.s21MatchRef}
            {triage.s21SimilarityPct != null && (
              <span className="ml-1 rounded px-1.5 py-0.5 tabular-nums"
                style={{ background: "var(--warn)", color: "var(--warn-bg)" }}>
                {Math.round(triage.s21SimilarityPct)}% match
              </span>
            )}
          </div>
        )}

        {/* Provenance */}
        {(triage.model || triage.confidence != null || triage.computedAt) && (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Assessed by{triage.model ? <> <span className="font-medium text-foreground">{triage.model}</span></> : " AI"}
            {triage.confidence != null && <> · {Math.round(triage.confidence * 100)}% confidence</>}
            {triage.computedAt && <> · {fmt(triage.computedAt)}</>}
            . Scores are advisory. A human officer confirms.
          </p>
        )}
      </div>
    </div>
  )
}

function fmt(d: string): string {
  const dt = new Date(d.replace(" ", "T"))
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}
