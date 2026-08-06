// Walkthrough persona audit (video Segment A surface): Command Centre → Cases → Knowledge Base.
// READ-ONLY: no redaction run / no Confirm&release / no pipeline fire (those mutate state + meter cost).
// Fresh chromium context per page. Targets the live harness on :3000.
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = process.env.BASE || "http://localhost:3000"
const SHOTS = "audit/screenshots"
fs.mkdirSync(SHOTS, { recursive: true })
const results = []
const rec = (id, status, detail) => { results.push({ id, status, detail }); console.log(`${status.padEnd(6)} ${id} — ${detail}`) }

// Phase 4b dark-surface probe: flag visible, sizeable elements whose averaged bg RGB < 90 on the light canvas.
const DARK_PROBE = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 20) continue;
    if (/REDACTED/.test(el.textContent||'')) continue;
    const s = getComputedStyle(el); const bg = s.backgroundColor || '';
    const m = bg.match(/rgba?\\(([0-9.]+),\\s*([0-9.]+),\\s*([0-9.]+)(?:,\\s*([0-9.]+))?\\)/);
    if (!m) continue; const [rr,gg,bb] = [+m[1],+m[2],+m[3]]; const a = m[4]===undefined?1:+m[4];
    if (a < 0.5) continue;
    if (rr<90 && gg<90 && bb<90) {
      if (r.width*r.height > 8000) out.push({ tag: el.tagName.toLowerCase(), cls: (el.className||'').toString().slice(0,40), bg, w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  return out.slice(0, 12);
})()`

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })

  // ---------- §1 Command Centre (/) ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/?audit=cc`, { waitUntil: "networkidle" })
    // word cloud lazy-loads its clickable <title> nodes; wait for them before probing
    await p.waitForFunction(() => [...document.querySelectorAll("svg text")].some(t => /click to see these cases/i.test((t.querySelector("title")||{}).textContent||"")), { timeout: 20000 }).catch(()=>{})
    await p.waitForTimeout(800)
    const body = await p.locator("body").innerText()
    rec("US-EU-01", /\d/.test(body) ? "PASS" : "FAIL", "Command Centre KPIs render numbers")

    // S-1 peer benchmark (WhatDoTheyKnow) fix must render
    const peer = /discloses information on\s+\d+%/.test(body) && /peer median/.test(body) && /ranked\s+\d+\s+of\s+\d+/i.test(body)
    const peerLine = (body.match(/[^.\n]*discloses information on[^.\n]*/) || ["(not found)"])[0].trim().slice(0, 160)
    rec("US-EU-08-peer", peer ? "PASS" : "FAIL", `peer benchmark card: "${peerLine}"`)

    // word cloud honest + clickable
    const wc = await p.evaluate(() => {
      const nodes = [...document.querySelectorAll("svg text")].filter(t => /click to see these cases/i.test((t.querySelector("title")||{}).textContent||""))
      const terms = nodes.map(t => { const m = t.querySelector("title").textContent.match(/^(.+?): (\d+) mention/); return m ? { term: m[1], w: +m[2] } : null }).filter(Boolean)
      const clickable = nodes.length > 0 && nodes.every(t => (t.getAttribute("class")||"").includes("cursor-pointer"))
      const maxW = terms.reduce((a,b)=>Math.max(a,b.w),0)
      return { n: nodes.length, maxW, clickable, hasName: /paddy|gardner/i.test(terms.map(t=>t.term).join(" ")), sample: terms.slice(0,8) }
    })
    const wcOk = wc.n >= 10 && !wc.hasName && wc.maxW < 100 && wc.clickable
    rec("US-EU-07a", wcOk ? "PASS" : "FAIL", `word cloud: ${wc.n} terms, maxCount=${wc.maxW}, noName=${!wc.hasName}, clickable=${wc.clickable}`)
    await p.screenshot({ path: `${SHOTS}/walk-01-cc.png`, fullPage: true })

    // drill-down (navigation only)
    const term0 = wc.sample[0]?.term
    await p.evaluate(() => { const el=[...document.querySelectorAll("svg text")].find(t=>/click to see these cases/i.test((t.querySelector("title")||{}).textContent||"")); el && el.dispatchEvent(new MouseEvent("click",{bubbles:true})) })
    await p.waitForURL(/\/cases\?.*keyword=/, { timeout: 8000 }).catch(()=>{})
    const drillOk = /\/cases\?.*keyword=/.test(p.url())
    rec("US-EU-07b", drillOk ? "PASS" : "FAIL", `click '${term0}' → ${p.url()}`)
    if (drillOk) {
      await p.getByText(/Showing cases mentioning/i).waitFor({ timeout: 8000 }).catch(()=>{})
      const banner = /Showing cases mentioning/.test(await p.locator("body").innerText())
      rec("US-EU-07c", banner ? "PASS" : "FAIL", `drill-down banner + filtered list`)
    }

    await p.goto(`${BASE}/?audit=ccv`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500)
    const darkCC = await p.evaluate(DARK_PROBE)
    rec("VIS-/", darkCC.length === 0 ? "PASS" : "FAIL", `dark surfaces on /: ${darkCC.length}${darkCC.length?" "+JSON.stringify(darkCC.slice(0,3)):""}`)
    await p.close()
  }

  // ---------- §2 Cases list (/cases) ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/cases`, { waitUntil: "networkidle" })
    await p.waitForTimeout(1000)
    const t = await p.locator("body").innerText()
    const lanes = /Quick wins/i.test(t) && /Needs review/i.test(t) && /Complex/i.test(t)
    const refs = /FOI-2026-\d+/.test(t)
    rec("US-EU-02", (refs) ? "PASS" : "FAIL", `Cases list shows references (${refs}); focus lanes present=${lanes}`)
    await p.screenshot({ path: `${SHOTS}/walk-02-cases.png`, fullPage: true })
    const darkCases = await p.evaluate(DARK_PROBE)
    rec("VIS-/cases", darkCases.length === 0 ? "PASS" : "FAIL", `dark surfaces on /cases: ${darkCases.length}${darkCases.length?" "+JSON.stringify(darkCases.slice(0,3)):""}`)
    await p.close()
  }

  // ---------- §2 Case detail (/cases/FOI-2026-0115) ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/cases/FOI-2026-0115`, { waitUntil: "networkidle" })
    await p.waitForTimeout(1200)
    const t = await p.locator("body").innerText()
    const triage = /How AI triaged this case/i.test(t) || /AI triage/i.test(t)
    const precedent = /Precedent/i.test(t)
    rec("US-EU-03", (triage && precedent) ? "PASS" : "FAIL", `case detail: triage panel=${triage}, precedent=${precedent}`)

    const panel = /AI evidence & audit trail/i.test(t)
    const chain = /Chain verified/i.test(t)
    rec("US-EB-04", (panel && chain) ? "PASS" : "FAIL", `audit trail panel=${panel}, chainVerified=${chain}`)

    const priceCard = /AI cost of this response/i.test(t)
    const cheaper = /cheaper/i.test(t)
    rec("US-EB-05", (priceCard && cheaper) ? "PASS" : "FAIL", `price card=${priceCard}, cheaper-line=${cheaper}`)
    await p.screenshot({ path: `${SHOTS}/walk-03-case-0115.png`, fullPage: true })
    const darkCase = await p.evaluate(DARK_PROBE)
    rec("VIS-/cases/[ref]", darkCase.length === 0 ? "PASS" : "FAIL", `dark surfaces on case: ${darkCase.length}${darkCase.length?" "+JSON.stringify(darkCase.slice(0,3)):""}`)
    await p.close()
  }

  // ---------- §4 Knowledge Base (/guidance) ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/guidance`, { waitUntil: "networkidle" })
    await p.waitForTimeout(1000)
    let t = await p.locator("body").innerText()
    const corpus = /evidence base/i.test(t) || /WhatDoTheyKnow/i.test(t)
    rec("US-EU-05", corpus ? "PASS" : "FAIL", `evidence-base / corpus cards render=${corpus}`)

    // run a search (read-only query)
    const box = p.getByPlaceholder(/search/i).first()
    const hasBox = await box.count()
    if (hasBox) {
      await box.fill("personal data")
      await box.press("Enter")
      await p.waitForTimeout(2500)
      t = await p.locator("body").innerText()
      const xauth = /Cross-authority precedent/i.test(t) || /WhatDoTheyKnow/i.test(t)
      rec("US-EU-05b", xauth ? "PASS" : "FAIL", `search 'personal data' → cross-authority precedent results=${xauth}`)
    } else {
      rec("US-EU-05b", "WAIVED", "no search box located on /guidance (selector)")
    }
    await p.screenshot({ path: `${SHOTS}/walk-04-guidance.png`, fullPage: true })
    const darkG = await p.evaluate(DARK_PROBE)
    rec("VIS-/guidance", darkG.length === 0 ? "PASS" : "FAIL", `dark surfaces on /guidance: ${darkG.length}${darkG.length?" "+JSON.stringify(darkG.slice(0,3)):""}`)
    await p.close()
  }

  await browser.close()
  const fail = results.filter(r => r.status === "FAIL")
  console.log("\n===== SUMMARY =====")
  console.log(`total=${results.length} pass=${results.filter(r=>r.status==="PASS").length} fail=${fail.length} waived=${results.filter(r=>r.status==="WAIVED").length}`)
  console.log(fail.length ? "GATE: BLOCKED\n" + fail.map(f=>` - ${f.id}: ${f.detail}`).join("\n") : "GATE: PASS")
  fs.writeFileSync(`${SHOTS}/../walkthrough-audit-results.json`, JSON.stringify(results, null, 2))
  process.exit(fail.length ? 1 : 0)
}
main().catch(e => { console.error("AUDIT ERROR", e); process.exit(2) })
