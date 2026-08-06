// New-features persona audit (WI-13) — SAR/redaction integration + word cloud de-skew & drill-down.
// Fresh chromium context per page (no shared cache) → avoids the stale-DOM artifact seen in the agentic browser.
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3100"
const SHOTS = "audit/screenshots"
fs.mkdirSync(SHOTS, { recursive: true })
const results = []
const rec = (id, status, detail) => { results.push({ id, status, detail }); console.log(`${status.padEnd(6)} ${id} — ${detail}`) }

// Phase 4b dark-surface probe: flag visible, sizeable elements whose averaged bg RGB < 90 on the light canvas.
const DARK_PROBE = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 20) continue;
    if (/REDACTED/.test(el.textContent||'')) continue; // intentional redaction blackout chip
    const s = getComputedStyle(el); const bg = s.backgroundColor || '';
    const m = bg.match(/rgba?\\(([0-9.]+),\\s*([0-9.]+),\\s*([0-9.]+)(?:,\\s*([0-9.]+))?\\)/);
    if (!m) continue; const [rr,gg,bb] = [+m[1],+m[2],+m[3]]; const a = m[4]===undefined?1:+m[4];
    if (a < 0.5) continue; if (rr<90 && gg<90 && bb<90) {
      // allow intentionally-dark chips (redaction blackout, brand buttons) — flag only large surfaces
      if (r.width*r.height > 8000) out.push({ tag: el.tagName.toLowerCase(), cls: (el.className||'').toString().slice(0,40), bg, w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  return out.slice(0, 12);
})()`

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })

  // ---------- Command Centre (/) : US-EU-01 + US-EU-07 (word cloud) ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/?audit=cc`, { waitUntil: "networkidle" })
    await p.waitForFunction(() => [...document.querySelectorAll("svg text")].some(t => /click to see these cases/.test((t.querySelector("title")||{}).textContent||"")), { timeout: 20000 }).catch(()=>{})
    await p.waitForTimeout(800) // settle
    const kpiText = await p.locator("body").innerText()
    rec("US-EU-01", /\d/.test(kpiText) ? "PASS" : "FAIL", "Command Centre KPIs render numbers")

    const wc = await p.evaluate(() => {
      const nodes = [...document.querySelectorAll("svg text")].filter(t => /click to see these cases/.test((t.querySelector("title")||{}).textContent||""))
      const terms = nodes.map(t => { const m = t.querySelector("title").textContent.match(/^(.+?): (\d+) mention/); return m ? { term: m[1], w: +m[2] } : null }).filter(Boolean)
      const clickable = nodes.length > 0 && nodes.every(t => (t.getAttribute("class")||"").includes("cursor-pointer"))
      const maxW = terms.reduce((a,b)=>Math.max(a,b.w),0)
      return { n: nodes.length, maxW, clickable, hasName: /paddy|gardner/i.test(terms.map(t=>t.term).join(" ")), sample: terms.slice(0,8) }
    })
    const wcOk = wc.n >= 10 && !wc.hasName && wc.maxW < 100 && wc.clickable
    rec("US-EU-07a", wcOk ? "PASS" : "FAIL", `word cloud: ${wc.n} terms, maxCount=${wc.maxW} (<100 ok), noName=${!wc.hasName}, clickable=${wc.clickable}`)
    await p.screenshot({ path: `${SHOTS}/cc-wordcloud.png`, fullPage: true })

    // drill-down: click the top term, expect /cases?...keyword=
    const term0 = wc.sample[0]?.term
    await p.evaluate(() => { const el=[...document.querySelectorAll("svg text")].find(t=>/click to see these cases/.test((t.querySelector("title")||{}).textContent||"")); el && el.dispatchEvent(new MouseEvent("click",{bubbles:true})) })
    await p.waitForURL(/\/cases\?.*keyword=/, { timeout: 8000 }).catch(()=>{})
    const url = p.url()
    const drillOk = /\/cases\?.*keyword=/.test(url)
    rec("US-EU-07b", drillOk ? "PASS" : "FAIL", `click '${term0}' → ${url}`)
    if (drillOk) {
      await p.getByText(/Showing cases mentioning/i).waitFor({ timeout: 8000 }).catch(()=>{})
      const body = await p.locator("body").innerText()
      const banner = /Showing cases mentioning/.test(body)
      const count = (body.match(/(\d+)\s+requests?/i)||[])[0] || "?"
      rec("US-EU-07c", banner ? "PASS" : "FAIL", `drill-down banner + list (${count})`)
      await p.screenshot({ path: `${SHOTS}/cases-keyword-drilldown.png`, fullPage: true })
    }
    // visual sweep on /
    await p.goto(`${BASE}/?audit=ccv`, { waitUntil: "networkidle" }); await p.waitForTimeout(2000)
    const darkCC = await p.evaluate(DARK_PROBE)
    rec("VIS-/", darkCC.length === 0 ? "PASS" : "FAIL", `dark surfaces on /: ${darkCC.length}${darkCC.length?" "+JSON.stringify(darkCC.slice(0,3)):""}`)
    await p.close()
  }

  // ---------- /redaction redirect : US-CH-03 ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/redaction`, { waitUntil: "networkidle" })
    rec("US-CH-03", /\/sar$/.test(p.url()) ? "PASS" : "FAIL", `/redaction → ${p.url()}`)
    await p.close()
  }

  // ---------- /sar integrated studio : US-EU-06 (+ released doc spacing, confirm&release) ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/sar`, { waitUntil: "networkidle" })
    const sarText = await p.locator("body").innerText()
    const embedded = /Redact the actual document held about/.test(sarText) && /Snowflake AI redaction/.test(sarText) && /Source document/.test(sarText)
    const noLinkOut = !/Open the Redaction Studio/.test(sarText)
    rec("US-EU-06a", embedded && noLinkOut ? "PASS" : "FAIL", `studio embedded in /sar, no link-out (embedded=${embedded}, noLinkOut=${noLinkOut})`)

    // run AI redaction
    await p.getByRole("button", { name: /Run AI redaction/i }).click()
    await p.getByRole("button", { name: /Confirm & release/i }).waitFor({ timeout: 90000 })
    const panelH = await p.evaluate(() => { const d=[...document.querySelectorAll("div")].find(x=>(x.className||"").includes("max-h-[640px]")); return d?getComputedStyle(d).maxHeight:null })
    const hasRedacted = /REDACTED/.test(await p.locator("body").innerText())
    rec("US-EU-06b", (hasRedacted && panelH==="640px") ? "PASS" : "FAIL", `released doc: REDACTED markers=${hasRedacted}, panelMaxH=${panelH}`)
    await p.screenshot({ path: `${SHOTS}/sar-redaction-released.png`, fullPage: true })

    // confirm & release
    await p.getByRole("button", { name: /Confirm & release/i }).click()
    const saved = await p.getByText(/decisions saved/i).waitFor({ timeout: 20000 }).then(()=>true).catch(()=>false)
    rec("US-EU-06c", saved ? "PASS" : "FAIL", `Confirm & release → decisions saved chip=${saved}`)

    // visual sweep on /sar (post-run)
    const darkSar = await p.evaluate(DARK_PROBE)
    rec("VIS-/sar", darkSar.length === 0 ? "PASS" : "FAIL", `dark surfaces on /sar: ${darkSar.length}${darkSar.length?" "+JSON.stringify(darkSar.slice(0,3)):""}`)
    await p.close()
  }

  // ---------- Live Outlook intake renders : US-EU-04b ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/intake`, { waitUntil: "networkidle" })
    const t = await p.locator("body").innerText()
    const ok = /Outlook Test/.test(t) && /Waiting to be triaged/.test(t) && /Run the pipeline/.test(t)
    rec("US-EU-04b", ok ? "PASS" : "FAIL", `Intake Outlook Test tab + waiting inbox + run control render`)
    await p.close()
  }

  // ---------- A6 AI audit trail panel : US-EB-04 ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/cases/FOI-2026-D07060953030`, { waitUntil: "networkidle" })
    const t = await p.locator("body").innerText()
    const panel = /AI evidence & audit trail/.test(t)
    const chain = /Chain verified/.test(t)
    const decisioned = /mistral-large2/.test(t) && /prompt [0-9a-f]{12}/.test(t)
    rec("US-EB-04", (panel && chain && decisioned) ? "PASS" : "FAIL", `A6 panel=${panel}, chainVerified=${chain}, decisions+hashes=${decisioned}`)
    await p.screenshot({ path: `${SHOTS}/case-ai-audit-trail.png`, fullPage: true })
    await p.close()
  }

  await browser.close()
  const fail = results.filter(r => r.status === "FAIL")
  console.log("\n===== SUMMARY =====")
  console.log(`total=${results.length} pass=${results.filter(r=>r.status==="PASS").length} fail=${fail.length}`)
  console.log(fail.length ? "GATE: BLOCKED\n" + fail.map(f=>` - ${f.id}: ${f.detail}`).join("\n") : "GATE: PASS")
  fs.writeFileSync(`${SHOTS}/../new-features-audit-results.json`, JSON.stringify(results, null, 2))
  process.exit(fail.length ? 1 : 0)
}
main().catch(e => { console.error("AUDIT ERROR", e); process.exit(2) })
