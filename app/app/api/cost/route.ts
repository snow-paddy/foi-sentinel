/** Recalculate the s.12 cost estimate from prescribed-activity hours. */
import { recalcCost } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      reference?: unknown; determine?: unknown; locate?: unknown; retrieve?: unknown; extract?: unknown
    }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    const num = (v: unknown) => {
      const x = Number(v)
      return Number.isFinite(x) && x >= 0 ? Math.min(x, 1000) : 0
    }
    const result = await recalcCost(reference, {
      determine: num(body.determine),
      locate: num(body.locate),
      retrieve: num(body.retrieve),
      extract: num(body.extract),
    })
    if (!result.ok) return Response.json({ ok: false, error: "Case not found" }, { status: 404 })
    return Response.json({ ok: true })
  } catch (e) {
    console.error("cost error:", e)
    return Response.json({ ok: false, error: "Cost estimate failed" }, { status: 500 })
  }
}
