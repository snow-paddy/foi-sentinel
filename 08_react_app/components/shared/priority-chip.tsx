import { priorityStyle } from "@/lib/format"
import { HoverExplain, type HoverExplainRow } from "@/components/shared/hover-explain"

/**
 * Filled priority chip (High = red, Medium = amber, Low = slate) on the GOV.UK
 * palette. Shared by the Focus cards, the cases list, the board and case detail
 * so priority reads consistently. Pure/client-safe. Hover reveals the same
 * explanatory card as complexity / precedent (via HoverExplain).
 */

// Honest, grounded explanation of how the band is derived (set by Cortex at
// triage — see SP_TRIAGE_CASE / FOI_TRIAGE priority scoring).
const PRIORITY_EXPLAINER =
  "Set at triage by Snowflake Cortex from how close the statutory deadline is, the request's complexity, requester sentiment and any risk flags. It orders the queue so the most pressing cases surface first. It is a prioritisation signal, not a decision."

export function PriorityChip({
  band,
  size = "sm",
  score,
  align = "left",
}: {
  band: string | null | undefined
  size?: "sm" | "md"
  score?: number | null
  align?: "left" | "right"
}) {
  if (!band) return null
  const p = priorityStyle(band)
  const cls = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
  const rows: HoverExplainRow[] = score != null ? [{ label: "Score", value: `${score}/10` }] : []
  return (
    <HoverExplain
      align={align}
      className={`rounded-full font-bold ${cls}`}
      style={{ background: p.bg, color: p.fg }}
      title="How priority is set"
      description={PRIORITY_EXPLAINER}
      rows={rows}
    >
      <span className="size-1.5 rounded-full" style={{ background: p.dot }} />
      {p.label} priority
    </HoverExplain>
  )
}
