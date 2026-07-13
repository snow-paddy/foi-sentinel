/** Run live Cortex triage (SENTIMENT + COMPLETE) over an email — no DB write. */
import { triageEmail } from "@/lib/queries"

export const dynamic = "force-dynamic"

const MAX = 8000

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { subject?: unknown; body?: unknown; tone?: unknown }
    const subject = typeof body.subject === "string" ? body.subject.slice(0, 500) : ""
    const text = typeof body.body === "string" ? body.body.slice(0, MAX) : ""
    const tone = typeof body.tone === "string" && body.tone.trim() ? body.tone.trim() : undefined
    if (!text.trim() && !subject.trim()) {
      return Response.json({ ok: false, error: "Empty email" }, { status: 400 })
    }
    const triage = await triageEmail(`${subject}\n\n${text}`, tone)
    if (!triage) {
      return Response.json({ ok: false, error: "Could not parse AI classification — try again" }, { status: 502 })
    }
    return Response.json({ ok: true, triage })
  } catch (e) {
    console.error("intake/triage error:", e)
    return Response.json({ ok: false, error: "Triage failed" }, { status: 500 })
  }
}
