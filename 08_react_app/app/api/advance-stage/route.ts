/**
 * Move a case to a new stage, via SP_ADVANCE_STAGE.
 *
 * POST /api/advance-stage
 *   body: { reference, toPhase }   — board drag: lands on the phase's first stage
 *   body: { reference, toStage }   — case page dropdown: an explicit stage code
 *
 * This is a real mutation (owner's rights): it advances CURRENT_STAGE on the
 * case and logs a STAGE_ADVANCE event.
 */

import { advanceCaseToPhase, setCaseStage, PHASE_FIRST_STAGE } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown; toPhase?: unknown; toStage?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const toPhase = typeof body.toPhase === "string" ? body.toPhase : ""
    const toStage = typeof body.toStage === "string" ? body.toStage : ""

    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }

    // Explicit stage code (case-page dropdown).
    if (toStage) {
      if (!/^[A-Z_]+$/.test(toStage)) {
        return Response.json({ ok: false, error: "Invalid stage" }, { status: 400 })
      }
      const moved = await setCaseStage(reference, toStage)
      if (!moved) {
        return Response.json({ ok: false, error: "No change applied" }, { status: 409 })
      }
      return Response.json({ ok: true, newStage: moved.stage, newStageName: moved.stageName })
    }

    // Phase target (board drag).
    if (!Object.prototype.hasOwnProperty.call(PHASE_FIRST_STAGE, toPhase)) {
      return Response.json({ ok: false, error: "Unknown phase" }, { status: 400 })
    }
    const moved = await advanceCaseToPhase(reference, toPhase)
    if (!moved) {
      return Response.json({ ok: false, error: "No change applied" }, { status: 409 })
    }
    return Response.json({ ok: true, newStage: moved.stage, newStageName: moved.stageName })
  } catch (e) {
    console.error("advance-stage error:", e)
    return Response.json({ ok: false, error: "Stage advance failed" }, { status: 500 })
  }
}
