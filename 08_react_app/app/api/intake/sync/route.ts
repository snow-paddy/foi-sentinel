/** Poll the shared Outlook mailbox via Microsoft Graph and triage new mail into cases. */
import { syncOutlookInbox } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { mailbox?: unknown }
    const mailbox = typeof body.mailbox === "string" && body.mailbox.trim() ? body.mailbox.trim() : undefined
    const result = await syncOutlookInbox(mailbox)
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error ?? "Mailbox sync failed", mailbox: result.mailbox },
        { status: 502 },
      )
    }
    return Response.json({ ...result, ok: true })
  } catch (e) {
    console.error("intake/sync error:", e)
    return Response.json({ ok: false, error: "Mailbox sync failed" }, { status: 500 })
  }
}
