/** Generate a synthetic inbound FOI email (body + subject) at a chosen tone. */
import { generateEmail, INTAKE_TONES } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { tone?: unknown; seedTopic?: unknown }
    const tone = typeof body.tone === "string" && body.tone in INTAKE_TONES ? body.tone : "Neutral"
    const seedTopic = body.seedTopic === true
    const result = await generateEmail(tone, seedTopic)
    return Response.json({ ok: true, ...result })
  } catch (e) {
    console.error("intake/generate error:", e)
    return Response.json({ ok: false, error: "Could not generate email" }, { status: 500 })
  }
}
