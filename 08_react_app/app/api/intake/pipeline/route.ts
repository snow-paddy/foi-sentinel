/** Run the downstream pipeline (triage → precedent → answer → eval → draft) for a case. */
import { runIntakePipeline } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { reference?: unknown }
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    if (!reference || !/^[A-Za-z0-9-]+$/.test(reference)) {
      return Response.json({ ok: false, error: "Invalid reference" }, { status: 400 })
    }
    const result = await runIntakePipeline(reference)
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error ?? "Pipeline failed" }, { status: 502 })
    }
    return Response.json(result)
  } catch (e) {
    console.error("intake/pipeline error:", e)
    return Response.json({ ok: false, error: "Pipeline failed" }, { status: 500 })
  }
}
