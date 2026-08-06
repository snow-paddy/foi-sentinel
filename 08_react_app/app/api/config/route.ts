/** Update council configuration (bulk key/value). */
import { updateCouncilConfig } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { updates?: unknown }
    const raw = body.updates && typeof body.updates === "object" ? (body.updates as Record<string, unknown>) : {}
    const updates: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (/^[A-Z0-9_]+$/.test(k)) updates[k] = String(v).slice(0, 200)
    }
    if (!Object.keys(updates).length) return Response.json({ ok: false, error: "No valid updates" }, { status: 400 })
    await updateCouncilConfig(updates)
    return Response.json({ ok: true })
  } catch (e) {
    console.error("config error:", e)
    return Response.json({ ok: false, error: "Update failed" }, { status: 500 })
  }
}
