/**
 * Sign-off chain: GET returns the chain for a case; POST appends one step as
 * the acting officer. Permission errors surface as 403.
 */
import { getSignoffs, submitSignoff, type SignoffStep } from "@/lib/queries"
import { errorResponse } from "@/lib/http"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const STEPS: SignoffStep[] = ["OFFICER_DRAFT", "REVIEWER", "MONITORING"]

export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference") ?? ""
  if (!reference) return Response.json({ ok: false, error: "Missing reference" }, { status: 400 })
  try {
    return Response.json({ ok: true, signoffs: await getSignoffs(reference) })
  } catch (e) {
    return errorResponse(e, "Sign-off read")
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      reference?: string
      step?: string
      decision?: string
      note?: string
    }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const step = body.step as SignoffStep
    const decision = body.decision === "REJECTED" ? "REJECTED" : "APPROVED"
    const note = typeof body.note === "string" ? body.note.slice(0, 500) : ""
    if (!reference) return Response.json({ ok: false, error: "Missing reference" }, { status: 400 })
    if (!STEPS.includes(step)) return Response.json({ ok: false, error: "Invalid step" }, { status: 400 })
    return Response.json(await submitSignoff(reference, step, decision, note))
  } catch (e) {
    return errorResponse(e, "Sign-off")
  }
}
