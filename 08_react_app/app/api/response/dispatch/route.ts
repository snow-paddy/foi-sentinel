/** Dispatch a response: timestamp, close the case, log the event. */
import { dispatchResponse } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown; responseId?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const responseId = typeof body.responseId === "string" ? body.responseId.trim() : ""
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    if (!responseId || !/^[A-Za-z0-9-]+$/.test(responseId)) {
      return Response.json({ ok: false, error: "Invalid response" }, { status: 400 })
    }
    const result = await dispatchResponse(reference, responseId)
    if (!result.ok) return Response.json({ ok: false, error: "Case not found" }, { status: 404 })
    return Response.json({ ok: true })
  } catch (e) {
    console.error("response/dispatch error:", e)
    return Response.json({ ok: false, error: "Dispatch failed" }, { status: 500 })
  }
}
