/** Presigned URL + requester identity for the staged SAR case-file PDF. */
import { getRedactionDemoDoc } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  try {
    const doc = await getRedactionDemoDoc()
    return Response.json({ ok: true, doc })
  } catch (e) {
    console.error("redaction/demo/doc error:", e)
    return Response.json({ ok: false, error: "Failed to load document" }, { status: 500 })
  }
}
