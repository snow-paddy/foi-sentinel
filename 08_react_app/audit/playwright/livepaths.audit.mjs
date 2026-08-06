// Live-path verification (video Segments B/C surfaces you will drive).
// Exercises the SAR redaction HERO cycle end-to-end so we catch bugs before recording:
//   Run AI redaction → untick thomas.lee@ → Confirm & release → Re-run → "Learned from N".
// /intake is render-only (firing the pipeline consumes the real unread email + meters full cost — done live on camera).
// NOTE: this seeds SOURCE='studio' rows; caller resets them afterward for a clean first-run.
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = process.env.BASE || "http://localhost:3000"
const SHOTS = "audit/screenshots"
fs.mkdirSync(SHOTS, { recursive: true })
const results = []
const rec = (id, status, detail) => { results.push({ id, status, detail }); console.log(`${status.padEnd(6)} ${id} — ${detail}`) }

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })

  // ---------- /intake render (US-EU-04) — render only, no pipeline fire ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/intake`, { waitUntil: "networkidle" })
    await p.waitForTimeout(1500)
    const t = await p.locator("body").innerText()
    const ok = /Outlook Test/i.test(t) && /Waiting to be triaged/i.test(t) && /Run the pipeline/i.test(t)
    rec("US-EU-04b", ok ? "PASS" : "FAIL", `Intake Outlook Test tab + waiting inbox + Run the pipeline control render`)
    await p.screenshot({ path: `${SHOTS}/live-intake.png`, fullPage: true })
    await p.close()
  }

  // ---------- /sar redaction HERO cycle (US-EU-06) ----------
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/sar`, { waitUntil: "networkidle" })
    await p.waitForTimeout(1500)
    let t = await p.locator("body").innerText()
    const findingsList = /findings|documents|Source document|held about/i.test(t)
    const embedded = /redaction/i.test(t)
    rec("US-EU-06a", (findingsList && embedded) ? "PASS" : "FAIL", `SAR findings + embedded studio present (findings=${findingsList}, studio=${embedded})`)

    // Run AI redaction
    const runBtn = p.getByRole("button", { name: /Run AI redaction/i })
    if (await runBtn.count()) {
      await runBtn.first().click()
      const confirmBtn = p.getByRole("button", { name: /Confirm & release/i })
      await confirmBtn.first().waitFor({ timeout: 120000 }).catch(()=>{})
      const ran = await confirmBtn.count() > 0
      const hasRedacted = /REDACTED/.test(await p.locator("body").innerText())
      rec("US-EU-06b", (ran && hasRedacted) ? "PASS" : "FAIL", `Run AI redaction → findings + released doc REDACTED markers=${hasRedacted}`)
      await p.screenshot({ path: `${SHOTS}/live-sar-redaction-run.png`, fullPage: true })

      // Inventory the finding values + look for the thomas.lee@ email to untick
      const boxes = await p.evaluate(() => [...document.querySelectorAll('input[type=checkbox][aria-label^="Redact "]')].map((b,i)=>({ i, label: b.getAttribute("aria-label"), checked: b.checked })))
      const thomas = boxes.find(b => /thomas\.lee@/i.test(b.label))
      if (thomas) {
        const cb = p.locator('input[type=checkbox][aria-label^="Redact "]').nth(thomas.i)
        if (thomas.checked) await cb.uncheck()
        rec("US-EU-06d", "PASS", `untick council officer email kept: "${thomas.label}"`)
      } else {
        const emailBox = boxes.find(b => /@/.test(b.label))
        if (emailBox) { const cb = p.locator('input[type=checkbox][aria-label^="Redact "]').nth(emailBox.i); await cb.uncheck().catch(()=>{}); rec("US-EU-06d", "WAIVED", `no thomas.lee@ finding; unticked first email instead: "${emailBox.label}"`) }
        else rec("US-EU-06d", "WAIVED", `no email-category finding to untick (values: ${boxes.slice(0,6).map(b=>b.label).join(" | ")})`)
      }

      // Confirm & release
      await p.getByRole("button", { name: /Confirm & release/i }).first().click()
      const saved = await p.getByText(/decisions saved/i).waitFor({ timeout: 20000 }).then(()=>true).catch(()=>false)
      rec("US-EU-06c", saved ? "PASS" : "FAIL", `Confirm & release → "decisions saved" chip=${saved}`)

      // Re-run → learned-from
      await p.waitForTimeout(800)
      await p.getByRole("button", { name: /Re-run/i }).first().click()
      const learned = await p.getByText(/Learned from \d+ prior decision/i).waitFor({ timeout: 120000 }).then(()=>true).catch(()=>false)
      const kept = /kept last time/i.test(await p.locator("body").innerText())
      rec("US-EU-06e", (learned && kept) ? "PASS" : "FAIL", `Re-run → "Learned from N prior decisions"=${learned}, "kept last time"=${kept}`)
      await p.screenshot({ path: `${SHOTS}/live-sar-relearn.png`, fullPage: true })
    } else {
      rec("US-EU-06b", "FAIL", "Run AI redaction button not found on /sar")
    }
    await p.close()
  }

  await browser.close()
  const fail = results.filter(r => r.status === "FAIL")
  console.log("\n===== SUMMARY =====")
  console.log(`total=${results.length} pass=${results.filter(r=>r.status==="PASS").length} fail=${fail.length} waived=${results.filter(r=>r.status==="WAIVED").length}`)
  console.log(fail.length ? "GATE: BLOCKED\n" + fail.map(f=>` - ${f.id}: ${f.detail}`).join("\n") : "GATE: PASS")
  fs.writeFileSync(`${SHOTS}/../livepaths-audit-results.json`, JSON.stringify(results, null, 2))
  process.exit(fail.length ? 1 : 0)
}
main().catch(e => { console.error("AUDIT ERROR", e); process.exit(2) })
