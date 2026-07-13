/** Generate a compliant response draft (Cortex via SP_GENERATE_RESPONSE). */
import { generateResponse, type ResponseType } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const TYPES = ["DISCLOSURE", "PARTIAL", "REFUSAL", "S21_REUSE"]

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown; type?: unknown; usePrecedent?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const type = typeof body.type === "string" && TYPES.includes(body.type) ? (body.type as ResponseType) : null
    const usePrecedent = body.usePrecedent === true
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    if (!type) return Response.json({ ok: false, error: "Invalid response type" }, { status: 400 })
    const result = await generateResponse(reference, type, usePrecedent)
    if (!result.ok) return Response.json({ ok: false, error: "Case not found" }, { status: 404 })
    return Response.json({ ok: true })
  } catch (e) {
    console.error("response/generate error:", e)
    return Response.json({ ok: false, error: "Generation failed" }, { status: 500 })
  }
}
