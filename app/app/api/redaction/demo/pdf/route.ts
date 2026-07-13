/** Proxy the staged PDF so it renders inline (avoids Content-Disposition: attachment). */
import { getRedactionDemoDoc } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  try {
    const { presignedUrl } = await getRedactionDemoDoc()
    if (!presignedUrl) {
      return Response.json({ ok: false, error: "No document URL" }, { status: 404 })
    }
    const upstream = await fetch(presignedUrl)
    if (!upstream.ok || !upstream.body) {
      return Response.json({ ok: false, error: "Upstream fetch failed" }, { status: 502 })
    }
    const bytes = await upstream.arrayBuffer()
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="sar_casefile.pdf"',
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("redaction/demo/pdf error:", e)
    return Response.json({ ok: false, error: "PDF proxy failed" }, { status: 500 })
  }
}
