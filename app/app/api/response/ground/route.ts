/** Generate a grounded, ready-to-send letter (real cited figures + source provenance) for cases. */
import { generateGroundedLetter, type ResponseType } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { references?: unknown; type?: unknown }
    const references = Array.isArray(body.references)
      ? body.references.filter((r): r is string => typeof r === "string").map((r) => r.trim()).filter(Boolean)
      : []
    const type = (typeof body.type === "string" ? body.type : "DISCLOSURE") as ResponseType
    if (!references.length) return Response.json({ ok: false, error: "No references" }, { status: 400 })
    const results = []
    for (const ref of references) {
      try {
        const r = await generateGroundedLetter(ref, type)
        results.push({ reference: ref, ok: Boolean(r?.letter), sources: r?.sources?.length ?? 0 })
      } catch (e) {
        results.push({ reference: ref, ok: false, error: e instanceof Error ? e.message : "Failed" })
      }
    }
    return Response.json({ ok: true, done: results.filter((r) => r.ok).length, total: results.length, results })
  } catch (e) {
    console.error("response/ground error:", e)
    return Response.json({ ok: false, error: "Grounded generation failed" }, { status: 500 })
  }
}
