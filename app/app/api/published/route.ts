/** Answer a public question from already-published council info (Cortex Search + COMPLETE, s.21). */
import { searchPublished } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { query?: unknown }
    const query = typeof body.query === "string" ? body.query.trim() : ""
    if (!query) {
      return Response.json({ ok: false, error: "Enter a question" }, { status: 400 })
    }
    const result = await searchPublished(query)
    return Response.json({ ok: true, ...result })
  } catch (e) {
    console.error("published search error:", e)
    return Response.json({ ok: false, error: "Search failed" }, { status: 500 })
  }
}
