/** Run live AI redaction on the staged SAR case-file PDF (parse + selective extract). */
import { runRedactionDemo } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST() {
  try {
    const result = await runRedactionDemo()
    return Response.json({ ok: true, result })
  } catch (e) {
    console.error("redaction/demo/run error:", e)
    return Response.json({ ok: false, error: "Redaction run failed" }, { status: 500 })
  }
}
