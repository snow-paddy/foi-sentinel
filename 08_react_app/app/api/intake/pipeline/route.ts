/**
 * Submit the downstream pipeline (triage → precedent → answer → eval → draft →
 * benchmark) for a case.
 *
 * Returns a job id immediately; the client polls /api/jobs/status. The pipeline
 * chains six Cortex round-trips in Node, so it routinely exceeds the 90s SPCS
 * ingress limit — and because it is many statements rather than one, there is no
 * Snowflake query id to poll instead.
 */
import { runIntakePipeline } from "@/lib/queries"
import { startJob } from "@/lib/jobs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }

    // Keyed by reference so two different cases can run at once, but the same
    // case submitted twice joins the run already in flight.
    const { jobId, joined } = startJob(`intake-pipeline-${reference}`, async (setStage) => {
      const result = await runIntakePipeline(reference, setStage)
      if (!result.ok) throw new Error(result.error ?? "Pipeline failed")
      return result
    }, "running the pipeline")

    return Response.json({ ok: true, jobId, joined }, { status: 202 })
  } catch (e) {
    console.error("intake/pipeline submit error:", e)
    return Response.json({ ok: false, error: "Could not start the pipeline" }, { status: 500 })
  }
}
