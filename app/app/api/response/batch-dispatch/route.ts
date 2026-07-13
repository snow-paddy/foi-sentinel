/** Batch-dispatch the quick-win lane: send several confirmed responses at once. */
import { batchDispatch } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { references?: unknown }
    const references = Array.isArray(body.references)
      ? body.references.filter((r): r is string => typeof r === "string").map((r) => r.trim()).filter(Boolean)
      : []
    if (!references.length) return Response.json({ ok: false, error: "No cases selected" }, { status: 400 })
    const results = await batchDispatch(references)
    const sent = results.filter((r) => r.ok).length
    return Response.json({ ok: true, sent, total: results.length, results })
  } catch (e) {
    console.error("response/batch-dispatch error:", e)
    return Response.json({ ok: false, error: "Batch dispatch failed" }, { status: 500 })
  }
}
