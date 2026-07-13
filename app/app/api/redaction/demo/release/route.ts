/** Persist the officer's keep/redact decisions from the Redaction Studio (learning flywheel). */
import { releaseRedactionDemo } from "@/lib/queries"

export const dynamic = "force-dynamic"

type DecisionIn = { category?: unknown; value?: unknown; confidence?: unknown; action?: unknown }

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { docKey?: unknown; decisions?: unknown }
    const docKey = typeof body.docKey === "string" ? body.docKey.trim() : ""
    const rawDecisions = Array.isArray(body.decisions) ? (body.decisions as DecisionIn[]) : []

    const decisions = rawDecisions
      .map((d) => ({
        category: typeof d.category === "string" ? d.category : "",
        value: typeof d.value === "string" ? d.value : "",
        confidence: typeof d.confidence === "number" ? d.confidence : null,
        action: d.action === "KEEP" || d.action === "REDACT" ? (d.action as "KEEP" | "REDACT") : null,
      }))
      .filter((d): d is { category: string; value: string; confidence: number | null; action: "KEEP" | "REDACT" } =>
        Boolean(d.value) && d.action !== null,
      )

    if (!docKey) return Response.json({ ok: false, error: "Missing docKey" }, { status: 400 })
    if (decisions.length === 0) return Response.json({ ok: false, error: "No decisions to save" }, { status: 400 })

    const result = await releaseRedactionDemo({ docKey, decisions })
    return Response.json({ ok: true, saved: result.saved })
  } catch (e) {
    console.error("redaction/demo/release error:", e)
    return Response.json({ ok: false, error: "Release failed" }, { status: 500 })
  }
}
