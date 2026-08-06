/** Escalations demo: generate an inbound internal-review or ICO complaint. */
import { createEscalation } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown; type?: unknown; note?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const type = body.type === "ico" ? "ico" : body.type === "review" ? "review" : ""
    const note = typeof body.note === "string" ? body.note.slice(0, 2000) : ""
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    if (!type) return Response.json({ ok: false, error: "Invalid type" }, { status: 400 })
    const r = await createEscalation(reference, type, note)
    return Response.json(r.ok ? { ok: true } : { ok: false, error: "Case not found" }, { status: r.ok ? 200 : 404 })
  } catch (e) {
    console.error("escalation error:", e)
    return Response.json({ ok: false, error: "Escalation failed" }, { status: 500 })
  }
}
