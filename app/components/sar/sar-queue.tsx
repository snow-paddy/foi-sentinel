import Link from "next/link"
import { Clock, ChevronRight, ShieldCheck, ShieldAlert } from "lucide-react"
import type { SarQueueRow } from "@/lib/queries"

const STAGE_LABEL: Record<string, string> = {
  RECEIPT: "Awaiting identity verification",
  VALIDITY: "Awaiting identity verification",
  SAR_REDIRECT: "Ready to process",
  REVIEW: "In review",
  REDACTION: "In redaction",
  DISPATCH: "Ready to release",
}

function stageLabel(stage: string, verified: boolean): string {
  if (!verified) return STAGE_LABEL[stage] ?? "Awaiting identity verification"
  return STAGE_LABEL[stage] ?? "In progress"
}

/** SAR inbox: pick a request to open. Requester stays pseudonymised here; the verified
 * data subject is only revealed once the case is opened into the workspace. */
export function SarQueue({ rows, selectedRef }: { rows: SarQueueRow[]; selectedRef?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Reference</th>
            <th className="px-3 py-2 text-left">Requester</th>
            <th className="px-3 py-2 text-left">Request</th>
            <th className="px-3 py-2 text-left">Received</th>
            <th className="px-3 py-2 text-left">Due (1 month)</th>
            <th className="px-3 py-2 text-left">Stage</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isSelected = r.reference === selectedRef
            const paused = /STOPPED|PAUSE/i.test(r.clockState)
            return (
              <tr
                key={r.reference}
                className="border-t border-border"
                style={isSelected ? { background: "var(--muted)" } : undefined}
              >
                <td className="px-3 py-2 font-mono text-xs">{r.reference}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.requester}</td>
                <td className="px-3 py-2">{r.subjectSummary}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.received}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" style={{ color: paused ? "var(--warn)" : "var(--muted-foreground)" }} />
                    {r.due}{paused ? " (paused)" : ""}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {r.verified ? (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium" style={{ color: "var(--ok)", backgroundColor: "var(--ok-bg)" }}>
                      <ShieldCheck className="size-3" /> {stageLabel(r.stage, true)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium" style={{ color: "var(--warn)", backgroundColor: "var(--warn-bg)" }}>
                      <ShieldAlert className="size-3" /> {stageLabel(r.stage, false)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.verified ? (
                    <Link
                      href={`/sar?case=${encodeURIComponent(r.reference)}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold"
                      style={{ color: "var(--brand-primary)", backgroundColor: "color-mix(in srgb, var(--brand-primary) 10%, transparent)" }}
                    >
                      {isSelected ? "Open" : "Open"} <ChevronRight className="size-3" />
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">Identity pending</span>
                  )}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">No Subject Access Requests in the queue.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
