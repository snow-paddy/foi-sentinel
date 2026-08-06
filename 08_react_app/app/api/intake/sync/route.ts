/**
 * Submit a mailbox poll: read the shared Outlook mailbox via Microsoft Graph and
 * triage new mail into cases.
 *
 * Returns a job id immediately rather than holding the request open. The poll has
 * been measured at 97.7s, past the 90s SPCS ingress limit, which previously made
 * a successful run look like a network failure. The client polls /api/jobs/status.
 */
import { syncOutlookInbox } from "@/lib/queries"
import { startJob } from "@/lib/jobs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { mailbox?: unknown }
    const mailbox = typeof body.mailbox === "string" && body.mailbox.trim() ? body.mailbox.trim() : undefined

    const { jobId, joined } = startJob("intake-sync", async () => {
      const result = await syncOutlookInbox(mailbox)
      if (!result.ok) throw new Error(result.error ?? "Mailbox sync failed")
      return { ...result, ok: true }
    }, "reading the mailbox")

    return Response.json({ ok: true, jobId, joined }, { status: 202 })
  } catch (e) {
    console.error("intake/sync submit error:", e)
    return Response.json({ ok: false, error: "Could not start the mailbox sync" }, { status: 500 })
  }
}
