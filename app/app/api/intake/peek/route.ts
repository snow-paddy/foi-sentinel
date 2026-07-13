/** Read-only peek at unread mail in the shared Outlook mailbox (no triage). */
import { peekOutlookInbox } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { mailbox?: unknown }
    const mailbox = typeof body.mailbox === "string" && body.mailbox.trim() ? body.mailbox.trim() : undefined
    const result = await peekOutlookInbox(mailbox)
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error ?? "Could not read mailbox", mailbox: result.mailbox }, { status: 502 })
    }
    return Response.json({ ok: true, mailbox: result.mailbox, messages: result.messages })
  } catch (e) {
    console.error("intake/peek error:", e)
    return Response.json({ ok: false, error: "Could not read mailbox" }, { status: 500 })
  }
}
