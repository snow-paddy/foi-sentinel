/** Internal-review / ICO / disclosure actions. */
import { recordReviewOutcome, updateIcoComplaint, publishCase } from "@/lib/queries"
import { errorResponse } from "@/lib/http"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = String(body.action ?? "")
    const id = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9-]+$/.test(v.trim()) ? v.trim() : "")

    if (action === "review-outcome") {
      const reviewId = id(body.reviewId)
      const outcome = typeof body.outcome === "string" ? body.outcome : ""
      if (!reviewId || !outcome) return Response.json({ ok: false, error: "Invalid input" }, { status: 400 })
      const r = await recordReviewOutcome(reviewId, outcome)
      return Response.json(r.ok ? { ok: true } : { ok: false, error: "Review not found" }, { status: r.ok ? 200 : 404 })
    }
    if (action === "ico-update") {
      const complaintId = id(body.complaintId)
      const status = typeof body.status === "string" ? body.status : ""
      const url = typeof body.url === "string" ? body.url.slice(0, 500) : ""
      if (!complaintId) return Response.json({ ok: false, error: "Invalid complaint" }, { status: 400 })
      const r = await updateIcoComplaint(complaintId, status, url)
      return Response.json({ ok: r.ok })
    }
    if (action === "publish") {
      const reference = id(body.reference)
      const topic = typeof body.topic === "string" ? body.topic.slice(0, 200) : ""
      if (!reference || !topic.trim()) return Response.json({ ok: false, error: "Invalid input" }, { status: 400 })
      const r = await publishCase(reference, topic)
      return Response.json(r.ok ? { ok: true } : { ok: false, error: r.error ?? "Case not found" }, { status: r.ok ? 200 : 409 })
    }
    return Response.json({ ok: false, error: "Unknown action" }, { status: 400 })
  } catch (e) {
    return errorResponse(e, "Action")
  }
}
