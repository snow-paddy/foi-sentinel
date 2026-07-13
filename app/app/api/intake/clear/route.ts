/** Remove all demo-intake cases (the "-D" reference token) to reset a demo. */
import { clearDemoIntakeCases } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const { deleted } = await clearDemoIntakeCases()
    return Response.json({ ok: true, deleted })
  } catch (e) {
    console.error("intake/clear error:", e)
    return Response.json({ ok: false, error: "Cleanup failed" }, { status: 500 })
  }
}
