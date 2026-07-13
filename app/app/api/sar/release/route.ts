/** Release a human-verified SAR redaction bundle: writes SAR_REDACTION + event. */
import { releaseSarDoc } from "@/lib/queries"

export const dynamic = "force-dynamic"

const MAX = 200_000

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      reference?: unknown; docId?: unknown; releasedText?: unknown
      spansTotal?: unknown; spansRedacted?: unknown; decisions?: unknown
    }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const docId = typeof body.docId === "string" ? body.docId.trim() : ""
    const releasedText = typeof body.releasedText === "string" ? body.releasedText.slice(0, MAX) : ""
    const spansTotal = Number(body.spansTotal)
    const spansRedacted = Number(body.spansRedacted)

    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    if (!docId || !/^[A-Za-z0-9-]+$/.test(docId)) {
      return Response.json({ ok: false, error: "Invalid docId" }, { status: 400 })
    }
    if (!releasedText.trim() || !Number.isFinite(spansTotal) || !Number.isFinite(spansRedacted)) {
      return Response.json({ ok: false, error: "Missing released text or counts" }, { status: 400 })
    }

    const decisions = (Array.isArray(body.decisions) ? body.decisions : [])
      .map((d) => {
        const o = d as { category?: unknown; value?: unknown; action?: unknown }
        return {
          category: typeof o.category === "string" ? o.category : "PII",
          value: typeof o.value === "string" ? o.value : "",
          action: o.action === "KEEP" || o.action === "REDACT" ? (o.action as "KEEP" | "REDACT") : null,
        }
      })
      .filter((d): d is { category: string; value: string; action: "KEEP" | "REDACT" } => Boolean(d.value) && d.action !== null)

    const result = await releaseSarDoc({ reference, docId, releasedText, spansTotal, spansRedacted, decisions })
    if (!result.ok) {
      return Response.json({ ok: false, error: "Document not found for this case" }, { status: 409 })
    }
    return Response.json({ ok: true })
  } catch (e) {
    console.error("sar/release error:", e)
    return Response.json({ ok: false, error: "Release failed" }, { status: 500 })
  }
}
