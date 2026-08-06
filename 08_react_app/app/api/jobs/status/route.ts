/**
 * Status of a background job submitted by /api/intake/sync, /api/intake/pipeline
 * or /api/redaction/demo/run. Small and fast by design, so it always returns
 * well inside the 90-second SPCS ingress limit however long the job itself runs.
 */
import { getJob } from "@/lib/jobs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? ""
  if (!id) return Response.json({ ok: false, error: "Missing job id" }, { status: 400 })

  const job = getJob(id)
  if (!job) {
    // Unknown means never submitted, swept after 30 minutes, or lost to a
    // container restart. The caller decides how to recover; for intake that is
    // getLatestIntakeCase, and redaction is simply re-runnable.
    return Response.json({ ok: false, status: "unknown", error: "No such job" }, { status: 404 })
  }

  return Response.json({
    ok: true,
    status: job.status,
    stage: job.stage,
    elapsedMs: (job.finishedAt ?? Date.now()) - job.startedAt,
    result: job.status === "done" ? job.result : null,
    error: job.error,
  })
}
