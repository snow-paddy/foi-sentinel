/** Stop or resume the statutory clock on a case. */
import { setCaseClock } from "@/lib/queries"
import { errorResponse } from "@/lib/http"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown; action?: unknown; reason?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const action = body.action === "stop" ? "stop" : body.action === "resume" ? "resume" : ""
    const reason = typeof body.reason === "string" ? body.reason.trim() : undefined
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    if (!action) return Response.json({ ok: false, error: "Invalid action" }, { status: 400 })
    const result = await setCaseClock(reference, action, reason)
    if (!result.ok) return Response.json({ ok: false, error: "Case not found" }, { status: 404 })
    return Response.json({ ok: true })
  } catch (e) {
    return errorResponse(e, "Clock action")
  }
}
