// validate_selectors.mjs — headless check that the recorder's in-app anchors resolve on localhost.
import { chromium } from "playwright"
const BASE = process.env.BASE || "http://localhost:3000"
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } })
const p = await ctx.newPage()
const results = []
async function check(label, url, rx, timeout = 15000) {
  try {
    await p.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 30000 })
    await p.getByText(rx).first().waitFor({ timeout })
    results.push(`OK    ${label}  (${url})`)
  } catch (e) {
    results.push(`MISS  ${label}  (${url})  -> ${String(e).split("\n")[0]}`)
  }
}
await check("Command Centre header", "/", /Command Centre|command centre|FOI Sentinel|Intelligence/i)
await check("Cases lanes", "/cases", /Quick wins|Needs review|Complex/i)
await check("Case triage panel", "/cases/FOI-2026-0115", /How AI triaged this case|AI triage/i)
await check("Audit chain verified", "/cases/FOI-2026-0115", /Chain verified/i)
await check("Intake waiting", "/intake", /Waiting to be triaged|Run the pipeline/i)
await check("SAR redaction", "/sar", /Run AI redaction|Redaction|Subject Access/i)
console.log(results.join("\n"))
await b.close()
