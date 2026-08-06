/** Mark an FOI redaction human-verified. */
import { verifyFoiRedaction } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown; redactionId?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const redactionId = typeof body.redactionId === "string" ? body.redactionId.trim() : ""
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    if (!redactionId || !/^[A-Za-z0-9-]+$/.test(redactionId)) {
      return Response.json({ ok: false, error: "Invalid redaction" }, { status: 400 })
    }
    const result = await verifyFoiRedaction(reference, redactionId)
    if (!result.ok) return Response.json({ ok: false, error: "Case not found" }, { status: 404 })
    return Response.json({ ok: true })
  } catch (e) {
    console.error("redaction error:", e)
    return Response.json({ ok: false, error: "Verify failed" }, { status: 500 })
  }
}
