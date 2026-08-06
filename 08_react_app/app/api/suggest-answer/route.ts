/** Draft a grounded suggested answer (Cortex Search + COMPLETE). */
import { suggestAnswer } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    const result = await suggestAnswer(reference)
    if (!result) return Response.json({ ok: false, error: "Case not found" }, { status: 404 })
    return Response.json({ ok: true, ...result })
  } catch (e) {
    console.error("suggest-answer error:", e)
    return Response.json({ ok: false, error: "Suggestion failed" }, { status: 500 })
  }
}
