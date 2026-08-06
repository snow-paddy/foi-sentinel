/**
 * Precompute + evaluate suggested answers (the tuning loop). Drafts a grounded
 * answer for each case and runs an LLM-as-judge eval, upserting both into
 * FOI_SUGGESTED_ANSWER so the case panel renders instantly. Backfill driver:
 * POST { references?: string[], withLetter?: boolean } — references defaults to
 * all open cases when omitted. When withLetter is true, also seeds a grounded
 * response letter of the outcome type triage suggests (disclosure / partial /
 * refusal / already-published), so demo cases open with a ready, correctly typed
 * draft rather than an empty studio.
 */
import { precomputeSuggestedAnswer, suggestedResponseType, generateGroundedLetter } from "@/lib/queries"
import { querySnowflake } from "@/lib/snowflake"
import { SCHEMA } from "@/lib/constants"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { references?: unknown; withLetter?: unknown; guidanceNote?: unknown }
    const withLetter = body.withLetter === true
    const guidanceNote = typeof body.guidanceNote === "string" && body.guidanceNote.trim() ? body.guidanceNote.trim() : undefined
    let references = Array.isArray(body.references)
      ? body.references.filter((r): r is string => typeof r === "string").map((r) => r.trim()).filter(Boolean)
      : []
    if (!references.length) {
      const rows = await querySnowflake(
        `SELECT REFERENCE FROM ${SCHEMA}.V_CASE WHERE STATUS = 'OPEN' ORDER BY REFERENCE`,
      )
      references = rows.map((r) => String(r.REFERENCE ?? "")).filter(Boolean)
    }
    const results = []
    for (const ref of references) {
      try {
        const r = await precomputeSuggestedAnswer(ref)
        let letterType: string | undefined
        if (withLetter) {
          const { type } = await suggestedResponseType(ref)
          await generateGroundedLetter(ref, type, guidanceNote)
          letterType = type
        }
        results.push({ ...r, letterType })
      } catch (e) {
        results.push({ reference: ref, ok: false, error: e instanceof Error ? e.message : "Failed" })
      }
    }
    const done = results.filter((r) => r.ok).length
    return Response.json({ ok: true, done, total: results.length, results })
  } catch (e) {
    console.error("suggest-answer/precompute error:", e)
    return Response.json({ ok: false, error: "Precompute failed" }, { status: 500 })
  }
}
