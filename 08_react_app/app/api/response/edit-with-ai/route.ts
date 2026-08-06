/** Revise a draft response in place per an officer's instruction (Cortex COMPLETE). */
import { editDraftWithAI } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { instruction?: unknown; currentText?: unknown }
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : ""
    const currentText = typeof body.currentText === "string" ? body.currentText : ""
    if (!instruction) return Response.json({ ok: false, error: "No instruction provided" }, { status: 400 })
    if (!currentText.trim()) return Response.json({ ok: false, error: "No draft to edit" }, { status: 400 })
    const result = await editDraftWithAI(currentText, instruction)
    if (!result.ok) return Response.json({ ok: false, error: "Could not revise the draft" }, { status: 502 })
    return Response.json({ ok: true, text: result.text })
  } catch (e) {
    console.error("response/edit-with-ai error:", e)
    return Response.json({ ok: false, error: "Edit failed" }, { status: 500 })
  }
}
