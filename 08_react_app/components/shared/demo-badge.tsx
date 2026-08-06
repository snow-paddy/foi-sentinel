import { FlaskConical } from "lucide-react"
import { isDemoCase } from "@/lib/format"

/**
 * Small badge marking a case created via the Email Intake demo (detected by the
 * "-D" reference token). Renders nothing for normal cases. Pure/client-safe so
 * it works on the board card, list row and detail header.
 */
export function DemoBadge({ reference, className = "" }: { reference: string; className?: string }) {
  if (!isDemoCase(reference)) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${className}`}
      style={{ background: "var(--warn-bg)", color: "var(--warn-text)" }}
      title="Created via the Email Intake demo"
    >
      <FlaskConical className="size-2.5" /> Demo intake
    </span>
  )
}
