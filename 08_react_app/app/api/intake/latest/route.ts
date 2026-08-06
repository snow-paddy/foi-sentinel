/**
 * Most recent email-intake case. Used to recover the intake demo when the mailbox
 * poll completes server-side but the HTTP response is lost (see getLatestIntakeCase).
 */
import { getLatestIntakeCase } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { withinMinutes?: unknown }
    const withinMinutes = typeof body.withinMinutes === "number" ? body.withinMinutes : 20
    const found = await getLatestIntakeCase(withinMinutes)
    return Response.json({ ok: true, case: found })
  } catch (e) {
    console.error("intake/latest error:", e)
    return Response.json({ ok: false, error: "Could not look up the latest case" }, { status: 500 })
  }
}
