/**
 * Client helper for the submit-and-poll endpoints.
 *
 * Submits the work, then polls /api/jobs/status until it finishes. Every request
 * it makes is short, so none of them can hit the 90-second SPCS ingress limit
 * however long the underlying job runs.
 */

export interface RunJobOptions {
  /** Called whenever the server reports a new coarse stage (e.g. "triage"). */
  onStage?: (stage: string) => void
  /** Give up after this long. Default 12 minutes. */
  timeoutMs?: number
  /** Gap between polls. Default 2 seconds. */
  pollIntervalMs?: number
}

export class JobLostError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "JobLostError"
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Parse defensively: a gateway error page is HTML, and res.json() would throw. */
async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Submit a job and resolve with its result.
 *
 * Throws {@link JobLostError} when the job id stops being recognised — which
 * means the work may well have completed but its result is unrecoverable, so
 * callers with a recovery path should take it rather than reporting failure.
 */
export async function runJob<T>(url: string, body?: unknown, options: RunJobOptions = {}): Promise<T> {
  const { onStage, timeoutMs = 12 * 60 * 1000, pollIntervalMs = 2000 } = options

  const submit = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })
  const submitted = await readJson(submit)
  if (!submit.ok || !submitted?.ok || typeof submitted.jobId !== "string") {
    const detail = typeof submitted?.error === "string" ? submitted.error : `HTTP ${submit.status}`
    throw new Error(detail)
  }
  const jobId = submitted.jobId

  const deadline = Date.now() + timeoutMs
  let lastStage = ""
  // A poll can fail transiently (a redeploy, a blip) without the job being gone.
  // Only a run of consecutive failures is treated as fatal.
  let consecutiveFailures = 0

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs)

    let res: Response
    try {
      res = await fetch(`/api/jobs/status?id=${encodeURIComponent(jobId)}`, { method: "GET" })
    } catch {
      consecutiveFailures += 1
      if (consecutiveFailures >= 5) throw new JobLostError("Lost contact with the job while it was running.")
      continue
    }

    if (res.status === 404) throw new JobLostError("The job is no longer being tracked.")

    const data = await readJson(res)
    if (!res.ok || !data?.ok) {
      consecutiveFailures += 1
      if (consecutiveFailures >= 5) throw new JobLostError("The job status could not be read.")
      continue
    }
    consecutiveFailures = 0

    const stage = typeof data.stage === "string" ? data.stage : ""
    if (stage && stage !== lastStage) {
      lastStage = stage
      onStage?.(stage)
    }

    if (data.status === "done") return data.result as T
    if (data.status === "error") throw new Error(typeof data.error === "string" ? data.error : "The job failed.")
  }

  throw new JobLostError("The job did not finish in time.")
}
