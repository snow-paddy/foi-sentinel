import { Scale, Check, ExternalLink } from "lucide-react"
import type { DecisionRationale } from "@/lib/format"

const TONE: Record<DecisionRationale["tone"], { fg: string; bg: string }> = {
  ok: { fg: "var(--ok)", bg: "var(--ok-bg)" },
  warn: { fg: "var(--warn)", bg: "var(--warn-bg)" },
  danger: { fg: "var(--danger)", bg: "var(--danger-bg)" },
}

/**
 * Plain-English, case-specific explanation of WHY the response has its outcome,
 * shown outside the draft letter. Values come from the officer's own exemption
 * assessments (see buildDecisionRationale), so it is grounded, not AI narration.
 */
export function DecisionSummary({ decision }: { decision: DecisionRationale }) {
  const t = TONE[decision.tone]
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: t.fg, background: t.bg }}>
      <div className="flex items-center gap-2">
        <Scale className="size-4 shrink-0" style={{ color: t.fg }} />
        <h3 className="text-sm font-semibold" style={{ color: t.fg }}>{decision.headline}</h3>
      </div>
      <p className="mt-1 text-sm text-foreground/90">{decision.summary}</p>

      {decision.releasing.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What we release</p>
          <ul className="mt-1 space-y-1">
            {decision.releasing.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-foreground/85">
                <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--ok)" }} /> <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {decision.withholding.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What we withhold and why</p>
          <ul className="mt-1 space-y-1">
            {decision.withholding.map((w, i) => (
              <li key={i} className="text-xs text-foreground/85">
                <span className="font-semibold">
                  {w.sectionUrl ? (
                    <a href={w.sectionUrl} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-0.5 hover:underline" style={{ color: "var(--brand-primary)" }}>
                      {w.section} <ExternalLink className="size-3" />
                    </a>
                  ) : w.section}
                </span>
                {w.reason ? <>: {w.reason}</> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {decision.s21Ref && (
        <p className="mt-2 text-xs text-foreground/85">
          Already published, matches <span className="font-mono font-semibold">{decision.s21Ref}</span>.
        </p>
      )}

      {decision.letterPointer && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          In the letter: &ldquo;{decision.letterPointer}&rdquo;
        </p>
      )}

      <p className="mt-2.5 text-[11px] text-muted-foreground">Based on the exemption assessments recorded for this case.</p>
    </div>
  )
}
