/**
 * Background job registry for work that outlives an HTTP request.
 *
 * SPCS ingress hard-terminates a request at 90 seconds. Several operations here
 * legitimately exceed that — SP_POLL_OUTLOOK_INBOX has been measured at 97.7s,
 * and the intake pipeline chains six Cortex round-trips. Holding the request
 * open therefore produced a failure that was not a failure: the work completed
 * server-side while the client saw a dropped connection.
 *
 * The fix is to submit the work, return an id, and let the client poll. Note
 * that the pipeline is orchestrated in Node across many statements, so there is
 * no single Snowflake query id to poll — the job identity has to live here.
 *
 * Storage is deliberately behind {@link startJob} / {@link getJob} so it can be
 * moved to a table later without touching callers. In-memory is correct for now:
 * the app runs as a single instance, and polls cost no warehouse time. The one
 * case it cannot cover is the container restarting mid-job, for which intake
 * keeps its own recovery path (see getLatestIntakeCase).
 */

export type JobStatus = "running" | "done" | "error"

export interface JobView<T = unknown> {
  id: string
  kind: string
  status: JobStatus
  stage: string
  startedAt: number
  finishedAt: number | null
  result: T | null
  error: string | null
}

type JobRecord = JobView<unknown>

/** Finished jobs are readable for this long, then swept. */
const RETAIN_MS = 30 * 60 * 1000
/** A job still running after this is abandoned as failed, so nothing polls for ever. */
const MAX_RUN_MS = 15 * 60 * 1000

// Pinned to globalThis so a dev hot-reload (or any duplicate module instance)
// cannot silently create a second, empty registry that loses running jobs.
const store: Map<string, JobRecord> = ((globalThis as Record<string, unknown>).__foiJobs as Map<
  string,
  JobRecord
>) ?? new Map<string, JobRecord>()
;(globalThis as Record<string, unknown>).__foiJobs = store

let seq = 0

function sweep(): void {
  const now = Date.now()
  for (const [id, job] of store) {
    if (job.finishedAt !== null && now - job.finishedAt > RETAIN_MS) store.delete(id)
  }
}

/** The job of this kind currently in flight, if any. */
function inFlight(kind: string): JobRecord | null {
  for (const job of store.values()) {
    if (job.kind === kind && job.status === "running") {
      if (Date.now() - job.startedAt > MAX_RUN_MS) {
        job.status = "error"
        job.error = "The job did not finish within 15 minutes and was abandoned."
        job.finishedAt = Date.now()
        continue
      }
      return job
    }
  }
  return null
}

export interface StartJobResult {
  jobId: string
  /** True when an identical job was already running and this submit joined it. */
  joined: boolean
}

/**
 * Run `work` detached and return an id immediately.
 *
 * If a job of the same `kind` is already running, its id is returned instead of
 * starting a second one. That is not just tidiness: SP_POLL_OUTLOOK_INBOX marks
 * mail as read as it goes, so two concurrent polls would divide one mailbox
 * between two runs.
 */
export function startJob<T>(
  kind: string,
  work: (setStage: (stage: string) => void) => Promise<T>,
  initialStage = "starting",
): StartJobResult {
  sweep()

  const existing = inFlight(kind)
  if (existing) return { jobId: existing.id, joined: true }

  seq += 1
  const id = `${kind}-${Date.now().toString(36)}-${seq.toString(36)}`

  const job: JobRecord = {
    id,
    kind,
    status: "running",
    stage: initialStage,
    startedAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null,
  }
  store.set(id, job)

  const setStage = (stage: string) => {
    if (job.status === "running") job.stage = stage
  }

  // Detached on purpose. The catch is what keeps a rejection from becoming an
  // unhandled rejection and taking the server process down.
  void (async () => {
    try {
      const result = await work(setStage)
      job.result = result
      job.status = "done"
      job.stage = "complete"
    } catch (e) {
      job.error = e instanceof Error ? e.message : String(e)
      job.status = "error"
      console.error(`[jobs] ${kind} (${id}) failed:`, e)
    } finally {
      job.finishedAt = Date.now()
    }
  })()

  return { jobId: id, joined: false }
}

/** Current state of a job, or null if unknown (never submitted, or swept). */
export function getJob<T = unknown>(id: string): JobView<T> | null {
  sweep()
  const job = store.get(id)
  if (!job) return null
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    result: job.result as T | null,
    error: job.error,
  }
}
