/**
 * Cortex Search across the public/precedent corpora. mode=sector -> WhatDoTheyKnow
 * + GLA + Camden disclosure logs; mode=guidance -> council policy + disclosure log
 * + WhatDoTheyKnow.
 */
import { cortexSearch, getCamdenLinks, getWdtkRefusalReasons } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { query?: unknown; mode?: unknown }
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 500) : ""
    const mode = body.mode === "guidance" ? "guidance" : "sector"
    if (!query) return Response.json({ ok: false, error: "Empty query" }, { status: 400 })

    if (mode === "guidance") {
      const [policy, disclosure, wdtk] = await Promise.all([
        cortexSearch("COUNCIL_POLICY_SEARCH", query, ["DOC_TITLE", "DOC_TYPE", "SECTION_REF", "CONTENT"], 4),
        cortexSearch("DISCLOSURE_SEARCH", query, ["REFERENCE_NUMBER", "TOPIC", "REQUEST_SUMMARY", "RESPONSE_SUMMARY", "EXEMPTIONS_APPLIED"], 4),
        cortexSearch("WDTK_PRECEDENT_SEARCH", query, ["AUTHORITY_NAME", "OUTCOME", "THEME", "LAW_USED", "REQUEST_TITLE", "REQUEST_URL", "SNIPPET"], 6),
      ])
      return Response.json({ ok: true, policy, disclosure, wdtk })
    }

    const [wdtk, gla, camden] = await Promise.all([
      cortexSearch("WDTK_PRECEDENT_SEARCH", query, ["EVENT_ID", "AUTHORITY_NAME", "OUTCOME", "THEME", "LAW_USED", "EXEMPTIONS", "REQUEST_TITLE", "REQUEST_URL", "SNIPPET"], 6),
      cortexSearch("GLA_DISCLOSURE_SEARCH", query, ["REFERENCE_NUMBER", "TITLE", "REGIME", "RESPONSE_TEXT", "SOURCE_URL"], 3),
      cortexSearch("CAMDEN_FOI_SEARCH", query, ["IDENTIFIER", "DOCUMENT_TITLE", "DOCUMENT_DATE", "DOCUMENT_TEXT"], 3),
    ])
    // Enrich WDTK hits with the pre-extracted "why refused" reason (by EVENT_ID), and
    // Camden hits with their real source-PDF link (DOCUMENT_LINK isn't a returnable
    // Cortex Search attribute) by IDENTIFIER.
    const [reasons, links] = await Promise.all([
      getWdtkRefusalReasons(wdtk.map((r) => String(r.EVENT_ID ?? ""))),
      getCamdenLinks(camden.map((r) => String(r.IDENTIFIER ?? ""))),
    ])
    const wdtkHits = wdtk.map((r) => {
      const m = reasons[String(r.EVENT_ID ?? "")]
      return { ...r, REFUSAL_REASON: m?.reason ?? "", REFUSAL_SECTIONS: m?.sections ?? "" }
    })
    const camdenHits = camden.map((r) => ({ ...r, DOCUMENT_LINK: links[String(r.IDENTIFIER ?? "")] ?? "" }))
    return Response.json({ ok: true, wdtk: wdtkHits, gla, camden: camdenHits })
  } catch (e) {
    console.error("search error:", e)
    return Response.json({ ok: false, error: "Search failed" }, { status: 500 })
  }
}
