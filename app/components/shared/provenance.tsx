import { CheckCircle2, ShieldCheck } from "lucide-react"
import type { AnswerSource } from "@/lib/queries"
import { InspectPopover } from "./inspect-popover"

/**
 * Data provenance strip: shows which VERIFIED Exampleton line-of-business tables the drafted
 * figures were grounded in, plus a count of peer/external references. The VQR-style trust signal.
 */
export function ProvenanceStrip({ sources }: { sources?: AnswerSource[] }) {
  if (!sources || sources.length === 0) return null
  const seen = new Set<string>()
  const verified = sources.filter((s) => {
    if (!s.verified || !s.sourceTable) return false
    if (seen.has(s.sourceTable)) return false
    seen.add(s.sourceTable)
    return true
  })
  const peerCount = sources.filter((s) => s.verified === false).length
  if (verified.length === 0 && peerCount === 0) return null
  return (
    <div className="mt-2 rounded-md border border-border bg-background px-2.5 py-2">
      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ShieldCheck className="size-3" /> Data provenance
      </p>
      <div className="flex flex-wrap gap-1.5">
        {verified.map((s) => (
          <InspectPopover
            key={s.sourceTable}
            label="Verified source of record"
            explanation={`A figure in this draft was grounded in this Exampleton system of record${s.owningService ? ` (${s.owningService})` : ""}. Trust metadata is resolved from DATA_SOURCE_REGISTRY; peer and external sources are shown for comparison only.`}
            sources={[s.sourceTable as string]}
            query={`-- Locate and inspect this source of record\nSHOW TABLES LIKE '%${s.sourceTable}%' IN DATABASE FOI;\nSELECT * FROM FOI.FOI_SENTINEL_V2.${s.sourceTable} LIMIT 20;`}
          >
            <span
              className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]"
              style={{ borderColor: "var(--ok)", background: "var(--ok-bg)", color: "var(--ok)" }}>
              <CheckCircle2 className="size-3" /> <span className="font-mono">{s.sourceTable}</span>
              {s.owningService ? <span className="opacity-70">· {s.owningService}</span> : null}
            </span>
          </InspectPopover>
        ))}
        {peerCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground"
            title="External or peer-authority references, shown for comparison, not the council's own record">
            {peerCount} peer reference{peerCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Verified figures cited from Exampleton systems of record; peer sources shown for comparison only.</p>
    </div>
  )
}

/**
 * Citation legend: resolves the inline [S1]/[S2] markers that ACTUALLY appear in the drafted text
 * to their source (origin, title, table), with a verified tick. Only lists tags present in the text.
 */
export function CitationLegend({ text, sources }: { text: string; sources?: AnswerSource[] }) {
  if (!sources || sources.length === 0 || !text) return null
  const cited = sources.filter((s) => s.tag && text.includes(`[${s.tag}]`))
  if (cited.length === 0) return null
  return (
    <div className="mt-2 rounded-md border border-border bg-background px-2.5 py-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Citations</p>
      <ul className="space-y-0.5">
        {cited.map((s) => (
          <li key={s.tag} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">[{s.tag}]</span>
            {s.verified ? <CheckCircle2 className="mt-0.5 size-3 shrink-0" style={{ color: "var(--ok)" }} /> : null}
            <span>
              {s.origin}{s.title ? `: ${s.title}` : ""}
              {s.sourceTable ? <span className="font-mono opacity-70"> ({s.sourceTable})</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
