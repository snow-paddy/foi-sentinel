/** Detect personal data in a SAR document with Cortex AI_REDACT — no DB write. */
import { detectSarPii } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { docId?: unknown }
    const docId = typeof body.docId === "string" ? body.docId.trim() : ""
    if (!docId || !/^[A-Za-z0-9-]+$/.test(docId)) {
      return Response.json({ ok: false, error: "Invalid docId" }, { status: 400 })
    }
    const spans = await detectSarPii(docId)
    return Response.json({ ok: true, spans })
  } catch (e) {
    console.error("sar/detect error:", e)
    return Response.json({ ok: false, error: "Detection failed" }, { status: 500 })
  }
}
