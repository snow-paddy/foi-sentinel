/** Cases assigned to the acting officer (reads the acting-as cookie). */
import { getMyCases } from "@/lib/queries"
import { errorResponse } from "@/lib/http"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  try {
    return Response.json({ ok: true, ...(await getMyCases()) })
  } catch (e) {
    return errorResponse(e, "My cases")
  }
}
