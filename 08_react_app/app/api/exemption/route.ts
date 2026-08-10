/** Record a human PIT decision on a qualified exemption. */
import { decideExemption } from "@/lib/queries"
import { errorResponse } from "@/lib/http"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown; assessmentId?: unknown; decision?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const assessmentId = typeof body.assessmentId === "string" ? body.assessmentId.trim() : ""
    const decision = body.decision === "apply" ? "apply" : body.decision === "disclose" ? "disclose" : ""
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    if (!assessmentId || !/^[A-Za-z0-9-]+$/.test(assessmentId)) {
      return Response.json({ ok: false, error: "Invalid assessment" }, { status: 400 })
    }
    if (!decision) return Response.json({ ok: false, error: "Invalid decision" }, { status: 400 })
    const result = await decideExemption(reference, assessmentId, decision)
    if (!result.ok) return Response.json({ ok: false, error: "Case not found" }, { status: 404 })
    return Response.json({ ok: true })
  } catch (e) {
    return errorResponse(e, "Decision")
  }
}
