import { Info } from "lucide-react"
import { HoverExplain, type HoverExplainRow } from "@/components/shared/hover-explain"

/**
 * Shared complexity chip — renders the triage complexity score with a consistent
 * hover popover (matching the Identity verified / Chain verified pattern) that
 * explains BOTH how the score is calculated (the method) and the concrete drivers
 * for this case (the "why"). Pure/client-safe so it can be used on the board cards,
 * the cases list and the case detail without duplicating the styling.
 */

// Honest, grounded explanation of how the score is derived (set by Cortex at
// triage — see SP_TRIAGE_CASE / FOI_TRIAGE.TRIAGE_JSON.complexity_score).
const COMPLEXITY_EXPLAINER =
  "Scored 0\u201310 by Snowflake Cortex at triage from the request's breadth, the number of departments and records likely involved, estimated officer hours, and whether exemptions or sensitive / third-party data are in play. Higher = more effort and risk. It is a triage signal for prioritisation, not a decision."

export function ComplexityChip({ score, factors = [] }: { score: number; factors?: string[] }) {
  const color = score >= 7 ? "var(--danger)" : score >= 4 ? "var(--warn)" : "var(--muted-foreground)"
  const rows: HoverExplainRow[] = factors.length ? [{ label: "Drivers", value: factors.join(" \u00b7 ") }] : []
  return (
    <HoverExplain
      className="rounded px-1.5 py-0.5 font-bold"
      style={{ background: "var(--muted)", color }}
      title={`How complexity is scored (${score.toFixed(0)}/10)`}
      description={COMPLEXITY_EXPLAINER}
      rows={rows}
    >
      Cx {score.toFixed(0)} <Info className="size-3 opacity-70" />
    </HoverExplain>
  )
}
