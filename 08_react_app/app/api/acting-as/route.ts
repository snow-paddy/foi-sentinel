/**
 * The simulated user-switcher endpoint.
 * GET  — list active officers (for the switcher and Assign-to controls).
 * POST — set the acting officer (validated against FOI_OFFICER), cookie {id,name,persona}.
 * DELETE — clear the selection (back to the ingress-header / fallback actor).
 */
import { cookies } from "next/headers"
import { listActiveOfficers, getOfficerById, readActingOfficer, ACTING_AS_COOKIE } from "@/lib/actor"
import { allowedActions } from "@/lib/permissions"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  try {
    const [officers, current] = await Promise.all([listActiveOfficers(), readActingOfficer()])
    return Response.json({ ok: true, officers, current, allowed: allowedActions(current?.persona ?? null) })
  } catch (e) {
    console.error("acting-as GET error:", e)
    return Response.json({ ok: false, error: "Could not list officers" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { officerId?: unknown }
    const officerId = typeof body.officerId === "string" ? body.officerId : ""
    if (!officerId) return Response.json({ ok: false, error: "Missing officerId" }, { status: 400 })

    const officer = await getOfficerById(officerId)
    if (!officer) return Response.json({ ok: false, error: "Unknown officer" }, { status: 404 })

    ;(await cookies()).set(ACTING_AS_COOKIE, JSON.stringify({ id: officer.id, name: officer.name, persona: officer.persona }), {
      path: "/",
      httpOnly: false, // the nav reads it to show who you're acting as; not a security boundary in this demo
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
    })
    return Response.json({ ok: true, current: { id: officer.id, name: officer.name, persona: officer.persona } })
  } catch (e) {
    console.error("acting-as POST error:", e)
    return Response.json({ ok: false, error: "Could not set acting officer" }, { status: 500 })
  }
}

export async function DELETE() {
  ;(await cookies()).delete(ACTING_AS_COOKIE)
  return Response.json({ ok: true })
}
