/**
 * Human-in-the-loop action on a precedent match.
 *
 * POST /api/precedent   body: { reference, action: "use" | "review" }
 *
 * Updates FOI_PRECEDENT_MATCH (USED / REVIEWED_BY / REVIEWED_AT) and logs a
 * PRECEDENT event on the case. Real mutation under owner's rights.
 */

import { markPrecedent } from "@/lib/queries"
import { errorResponse } from "@/lib/http"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown; action?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const action = body.action === "use" ? "use" : body.action === "review" ? "review" : ""

    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    if (!action) {
      return Response.json({ ok: false, error: "Invalid action" }, { status: 400 })
    }

    const result = await markPrecedent(reference, action)
    if (!result) {
      return Response.json({ ok: false, error: "No precedent for this case" }, { status: 409 })
    }
    return Response.json({ ok: true, used: result.used, reviewedBy: result.reviewedBy, advancedTo: result.advancedTo, canDraftFromPrecedent: result.canDraftFromPrecedent, hasExistingDraft: result.hasExistingDraft })
  } catch (e) {
    return errorResponse(e, "Precedent action")
  }
}
