/**
 * Submit a live AI redaction run over the staged SAR case-file PDF (parse plus
 * selective extraction).
 *
 * Returns a job id immediately; the client polls /api/jobs/status. A cold run is
 * around five minutes — far past the 90s SPCS ingress limit — because the PDF is
 * parsed and then selectively extracted.
 */
import { runRedactionDemo } from "@/lib/queries"
import { startJob } from "@/lib/jobs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST() {
  try {
    const { jobId, joined } = startJob("redaction-demo", () => runRedactionDemo(), "parsing and extracting")

    return Response.json({ ok: true, jobId, joined }, { status: 202 })
  } catch (e) {
    console.error("redaction/demo/run submit error:", e)
    return Response.json({ ok: false, error: "Could not start the redaction run" }, { status: 500 })
  }
}
