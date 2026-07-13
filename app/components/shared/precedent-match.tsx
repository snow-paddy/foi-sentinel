"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Star, Loader2, Check, ExternalLink, Info, ArrowRight, FlaskConical } from "lucide-react"
import type { PrecedentMatch } from "@/lib/queries"
import { InspectPopover } from "./inspect-popover"
import { HoverExplain } from "@/components/shared/hover-explain"

// Honest, grounded explanation of how the score is derived (see
// 01_ddl/06_precedent_match.sql -> SP_REFRESH_PRECEDENT_MATCH).
export const SIMILARITY_EXPLAINER =
  "Snowflake Cortex AI_SIMILARITY compares this request against previously-answered \"clean\" cases (no complaint or review) across the council's own responses, the GLA log and WhatDoTheyKnow. The closest match scoring 40% or above is shown."

/** Compact board/list pill: "\u2605 96% match". Static, with a consistent hover explainer. */
export function PrecedentPill({ pct }: { pct: number }) {
  return (
    <HoverExplain
      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
      style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
      title={`How the precedent match is scored (${pct}% similar)`}
      description={SIMILARITY_EXPLAINER}
    >
      <Star className="size-2.5" /> {pct}% match
    </HoverExplain>
  )
}

/** Full detail card with the matched response + HITL "use / mark reviewed". */
export function PrecedentCard({ reference, match }: { reference: string; match: PrecedentMatch }) {
  const router = useRouter()
  const [used, setUsed] = useState(match.used)
  const [reviewedBy, setReviewedBy] = useState(match.reviewedBy)
  const [busy, setBusy] = useState<"use" | "review" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function act(action: "use" | "review") {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch("/api/precedent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference, action }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed")
      if (action === "use") {
        setUsed(true)
        const advanced = data.advancedTo ? ` Case advanced to ${data.advancedTo}.` : ""
        if (data.canDraftFromPrecedent) {
          // No draft yet: ground one on the adopted precedent (long-running Cortex call).
          setSuccess(`Precedent adopted.${advanced} Drafting a grounded reply from it, please wait.`)
          const gen = await fetch("/api/response/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ reference, type: data.suggestedType || "DISCLOSURE", usePrecedent: true }),
          })
          const gd = await gen.json().catch(() => ({}))
          setSuccess(gen.ok && gd.ok
            ? `Precedent adopted. The draft below is grounded on ${match.ref}.`
            : `Precedent adopted.${advanced} The draft did not complete. You can generate it in the studio.`)
        } else if (data.hasExistingDraft) {
          setSuccess(`Precedent adopted.${advanced} To make the draft mirror this precedent, use Regenerate from precedent in the studio.`)
        } else {
          setSuccess(`Precedent adopted.${advanced}`)
        }
      } else {
        setSuccess("Precedent marked reviewed.")
      }
      setReviewedBy(data.reviewedBy || "FOI Officer")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  const pct = match.similarityPct ?? 0

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Star className="size-4" style={{ color: "var(--ok)" }} />
        <h2 className="text-base font-semibold">Precedent match</h2>
        <div className="ml-auto">
          <InspectPopover
            align="end"
            label="How the precedent match is scored"
            explanation={SIMILARITY_EXPLAINER}
            sources={["FOI_PRECEDENT_MATCH", "V_PRECEDENT_CLEAN"]}
            query={`-- This case's precedent match (real AI_SIMILARITY score)\nSELECT REFERENCE, SIMILARITY_PCT, SOURCE, REF, IS_SYNTHETIC\nFROM FOI.FOI_SENTINEL_V2.FOI_PRECEDENT_MATCH\nWHERE REFERENCE = '${reference}';\n\n-- The corpus it searches (real GLA + WDTK + flagged synthetic):\n-- SELECT * FROM FOI.FOI_SENTINEL_V2.V_PRECEDENT_CLEAN LIMIT 20;`}
          >
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
              {pct}% similar <Info className="size-3 opacity-70" />
            </span>
          </InspectPopover>
        </div>
      </div>

      <div className="space-y-3 p-5">
        <p className="text-xs text-muted-foreground">
          {match.isSynthetic
            ? "The similarity score is a real Cortex AI_SIMILARITY measurement, but the closest match is an illustrative comparator seeded for demonstration. It is not a real authority's published response. Treat it as a worked example rather than a citable precedent."
            : "This request closely matches one the council answered before that drew no complaint or internal review. You can answer it the same way or handle it yourself."}
        </p>

        <div className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-semibold">{match.ref}</span>
            <div className="flex items-center gap-1.5">
              {match.isSynthetic && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: "var(--warning-bg, #fef3c7)", color: "var(--warning, #92400e)" }}
                      title="Synthetic comparator seeded for demonstration. It is not a real authority's published response. The similarity figure is real. The compared document is illustrative.">
                  <FlaskConical className="size-3" /> Illustrative example
                </span>
              )}
              {match.source && <span className="text-xs text-muted-foreground">{match.source}</span>}
            </div>
          </div>
          {match.title && <p className="mt-1 text-sm font-medium">{match.title}</p>}
          {match.cleanOutcome && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--ok)" }}>
              <Check className="size-3.5" /> {match.cleanOutcome}
            </p>
          )}
          {match.responseText && (
            <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{match.responseText}</p>
          )}
          {match.url && (
            <a href={match.url} target="_blank" rel="noopener noreferrer"
               className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--brand-primary)] hover:underline">
              View original <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy != null || used}
            onClick={() => act("use")}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--brand-primary)" }}
          >
            {busy === "use" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {used ? "Precedent adopted" : "Use this precedent"}
          </button>
          <button
            type="button"
            disabled={busy != null}
            onClick={() => act("review")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {busy === "review" ? <Loader2 className="size-4 animate-spin" /> : null}
            Mark reviewed
          </button>
          {reviewedBy && <span className="text-xs text-muted-foreground">Reviewed by {reviewedBy}</span>}
        </div>
        {success && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--ok)" }}>
            <Check className="size-3.5" /> {success}
            {used && <ArrowRight className="size-3.5 opacity-70" />}
          </p>
        )}
        {error && <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
    </div>
  )
}
