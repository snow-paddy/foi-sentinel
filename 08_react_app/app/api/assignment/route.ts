/**
 * Case assignment: claim (first-come, UNIQUE-guarded), assign (manager reassign),
 * release. Permission errors from the query layer surface as 403.
 */
import { claimCase, assignCase, releaseCase, getCaseAssignment } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function isForbidden(e: unknown): boolean {
  return Boolean(e && typeof e === "object" && (e as { code?: string }).code === "FORBIDDEN")
}

export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference") ?? ""
  if (!reference) return Response.json({ ok: false, error: "Missing reference" }, { status: 400 })
  try {
    return Response.json({ ok: true, assignment: await getCaseAssignment(reference) })
  } catch (e) {
    return Response.json({ ok: false, error: "Could not read assignment" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; reference?: string; officerId?: string }
    const action = body.action ?? ""
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    if (!reference) return Response.json({ ok: false, error: "Missing reference" }, { status: 400 })

    if (action === "claim") return Response.json(await claimCase(reference))
    if (action === "assign") {
      if (!body.officerId) return Response.json({ ok: false, error: "Missing officerId" }, { status: 400 })
      return Response.json(await assignCase(reference, body.officerId))
    }
    if (action === "release") return Response.json(await releaseCase(reference))
    return Response.json({ ok: false, error: "Unknown action" }, { status: 400 })
  } catch (e) {
    if (isForbidden(e)) {
      return Response.json({ ok: false, error: e instanceof Error ? e.message : "Not permitted", forbidden: true }, { status: 403 })
    }
    console.error("assignment error:", e)
    return Response.json({ ok: false, error: "Assignment failed" }, { status: 500 })
  }
}
