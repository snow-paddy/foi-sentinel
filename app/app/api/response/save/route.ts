/** Save an officer-edited response draft as final. */
import { saveResponseFinal } from "@/lib/queries"

export const dynamic = "force-dynamic"

const MAX = 60_000

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown; responseId?: unknown; finalText?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const responseId = typeof body.responseId === "string" ? body.responseId.trim() : ""
    const finalText = typeof body.finalText === "string" ? body.finalText.slice(0, MAX) : ""
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    if (!responseId || !/^[A-Za-z0-9-]+$/.test(responseId)) {
      return Response.json({ ok: false, error: "Invalid response" }, { status: 400 })
    }
    if (!finalText.trim()) return Response.json({ ok: false, error: "Empty text" }, { status: 400 })
    const result = await saveResponseFinal(reference, responseId, finalText)
    if (!result.ok) return Response.json({ ok: false, error: "Case not found" }, { status: 404 })
    return Response.json({ ok: true })
  } catch (e) {
    console.error("response/save error:", e)
    return Response.json({ ok: false, error: "Save failed" }, { status: 500 })
  }
}
