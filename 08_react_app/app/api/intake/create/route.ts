/** Create a real (non-synthetic, demo-marked) case from a triaged email. */
import { createIntakeCase, type CaseTriage } from "@/lib/queries"

export const dynamic = "force-dynamic"

const MAX = 8000

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      subject?: unknown; body?: unknown; senderName?: unknown; triage?: unknown
    }
    const subject = typeof body.subject === "string" ? body.subject.slice(0, 500) : ""
    const text = typeof body.body === "string" ? body.body.slice(0, MAX) : ""
    const senderName = typeof body.senderName === "string" ? body.senderName.slice(0, 120) : "Demo requester"
    const triage = body.triage as CaseTriage | undefined

    if (!text.trim() || !triage || typeof triage.classification !== "string") {
      return Response.json({ ok: false, error: "Missing email body or triage" }, { status: 400 })
    }
    const { reference } = await createIntakeCase({ subject, body: text, senderName, triage })
    return Response.json({ ok: true, reference })
  } catch (e) {
    console.error("intake/create error:", e)
    return Response.json({ ok: false, error: "Could not create case" }, { status: 500 })
  }
}
