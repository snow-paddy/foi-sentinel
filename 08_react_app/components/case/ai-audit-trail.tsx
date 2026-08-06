import { ShieldCheck, ShieldAlert, Cpu, Gauge, Coins, Hash } from "lucide-react"
import type { AiAuditTrail } from "@/lib/queries"
import { HoverExplain } from "@/components/shared/hover-explain"

const TYPE_LABEL: Record<string, string> = {
  triage: "Triage",
  suggested_answer: "Suggested answer",
  eval: "Evaluation",
  response: "Compiled response",
  redaction: "Redaction",
  benchmark: "Peer benchmark",
}

function fmtTs(d: string): string {
  if (!d) return "—"
  const dt = new Date(d.replace(" ", "T"))
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

/** A6 - read-only, ICO-review-ready view of every AI decision on the case, with tamper-evidence. */
export function AiAuditTrail({ trail }: { trail: AiAuditTrail }) {
  const { decisions, chainIntact } = trail
  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="size-4" style={{ color: "var(--brand-primary)" }} /> AI evidence &amp; audit trail
        </h2>
        {chainIntact ? (
          <HoverExplain
            align="right"
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
            title="How this is verified"
            description="Each AI decision is hashed and linked to the one before it (SHA-256). Verified means the whole chain recomputes cleanly, so nothing has been altered, inserted or removed since it was recorded."
            footer="Prompts and responses are stored as hashes, never raw personal data."
          >
            <ShieldCheck className="size-3" /> Chain verified
          </HoverExplain>
        ) : (
          <HoverExplain
            align="right"
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
            title="Chain integrity check failed"
            description="The hash chain did not recompute cleanly. A decision may have been altered, inserted or removed since it was recorded. Treat the trail as unreliable and investigate."
          >
            <ShieldAlert className="size-3" /> Chain integrity check failed
          </HoverExplain>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every AI decision on this case, captured append-only and hash-chained (SHA-256). Prompts and responses are stored as
        hashes, never raw text, so the trail is defensible without duplicating personal data.
      </p>

      {decisions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No AI decisions recorded for this case yet.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {decisions.map((d) => (
            <li key={d.seq} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ background: "var(--muted)", color: "var(--brand-primary)" }}>
                  {TYPE_LABEL[d.decisionType] ?? d.decisionType}
                </span>
                <span className="text-xs text-muted-foreground">{fmtTs(d.decidedAt)}</span>
              </div>
              {d.summary && <p className="mt-1.5 text-foreground/90">{d.summary}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Cpu className="size-3" /> {d.model}{d.sfVersion && ` · Snowflake ${d.sfVersion}`}</span>
                {d.confidence != null && (
                  <span className="inline-flex items-center gap-1"><Gauge className="size-3" /> confidence {Math.round(d.confidence * 100)}%</span>
                )}
                {(d.inputTokens != null || d.outputTokens != null) && (
                  <span className="tnum">{(d.inputTokens ?? 0) + (d.outputTokens ?? 0)} tokens</span>
                )}
                {d.estGbp != null && (
                  <span className="inline-flex items-center gap-1 tnum"><Coins className="size-3" /> £{d.estGbp.toFixed(4)}</span>
                )}
              </div>
              <div className="mt-1.5 flex flex-col gap-0.5 font-mono text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Hash className="size-2.5" /> prompt {d.promptHash.slice(0, 24)}…</span>
                <span className="inline-flex items-center gap-1"><Hash className="size-2.5" /> response {d.responseHash.slice(0, 24)}…</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
