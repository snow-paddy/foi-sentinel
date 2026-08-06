/** Live connectivity probe for the Entra ID → Graph → mailbox path. Status codes only. */
import { probeOutlookConnection } from "@/lib/connections"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST() {
  const result = await probeOutlookConnection()
  return Response.json({ ok: true, probe: result })
}
