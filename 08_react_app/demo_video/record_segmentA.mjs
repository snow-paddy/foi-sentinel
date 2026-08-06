// Segment A recorder — automated FOI walkthrough (I drive), headless, records .webm.
// Order (user's narrative): Command Centre -> Cases -> Knowledge Base, with REAL interactions.
// localhost:3000 (no SSO). Output: demo_video/raw/segmentA.webm
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const BASE = process.env.BASE || "http://localhost:3000"
const RAW = path.resolve("demo_video/raw")
const VP = { width: 1440, height: 900 }
fs.mkdirSync(RAW, { recursive: true })
const log = (m) => console.log(m)
const hold = (page, s) => page.waitForTimeout(Math.round(s * 1000))

async function slowScroll(page, { step = 300, pause = 700, back = true } = {}) {
  const total = await page.evaluate(() => document.body.scrollHeight)
  let y = 0
  while (y < total - VP.height) {
    y += step
    await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: "smooth" }), y)
    await page.waitForTimeout(pause)
  }
  await page.waitForTimeout(1000)
  if (back) { await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await page.waitForTimeout(800) }
}

async function tryHover(page, locator, label, dwell = 2.0) {
  try {
    const el = locator.first()
    await el.scrollIntoViewIfNeeded({ timeout: 5000 })
    await el.hover({ timeout: 5000 })
    await hold(page, dwell)
    log(`  hover ok: ${label}`)
  } catch (e) { log(`  hover miss ${label}: ${e.message}`) }
}

async function commandCentre(page) {
  log("S1 Command Centre")
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => [...document.querySelectorAll("svg text")].some(t => /click to see these cases/i.test((t.querySelector("title") || {}).textContent || "")),
    { timeout: 20000 }
  ).catch(() => {})
  await hold(page, 3)
  await slowScroll(page, { step: 300, pause: 750, back: false })
  const term = await page.evaluate(() => {
    const n = [...document.querySelectorAll("svg text")].filter(t => /click to see these cases/i.test((t.querySelector("title") || {}).textContent || ""))
    if (!n.length) return null
    const m = n[0].querySelector("title").textContent.match(/^(.+?):/)
    return m ? m[1] : null
  })
  if (term) {
    const wc = page.locator("svg text", { hasText: term }).first()
    await tryHover(page, wc, `word-cloud '${term}'`, 2.0)
    try {
      await wc.click({ timeout: 5000 })
      await page.waitForURL(/\/cases\?.*keyword=/, { timeout: 8000 })
      await page.getByText(/Showing cases mentioning/i).first().waitFor({ timeout: 6000 }).catch(() => {})
      await hold(page, 4)
      log(`  drilldown -> ${page.url()}`)
    } catch (e) { log(`  word-cloud click miss: ${e.message}`) }
  }
}

async function cases(page) {
  log("S2 Cases")
  await page.goto(`${BASE}/cases`, { waitUntil: "networkidle" })
  await page.getByText("Quick wins", { exact: false }).first().waitFor({ timeout: 12000 }).catch(() => {})
  await hold(page, 4)
  await tryHover(page, page.getByText(/% precedent match/i), "precedent pill", 2.5)
  await tryHover(page, page.locator("[class*='complexity'],[aria-label*='omplexity']"), "complexity chip", 2.5)
  for (const name of ["List view", "List", "Table"]) {
    try { await page.getByRole("button", { name: new RegExp(name, "i") }).first().click({ timeout: 3000 }); await hold(page, 3); log(`  switched to ${name}`); break } catch { /* next */ }
  }
  await slowScroll(page, { step: 320, pause: 650, back: false })
}

async function caseDetail(page) {
  log("S2 Case detail FOI-2026-0115")
  await page.goto(`${BASE}/cases/FOI-2026-0115`, { waitUntil: "networkidle" })
  await page.getByText(/How AI triaged this case|AI triage/i).first().waitFor({ timeout: 12000 }).catch(() => {})
  await hold(page, 4)
  await slowScroll(page, { step: 280, pause: 750, back: false })
  try {
    await page.getByText(/AI evidence & audit trail/i).first().scrollIntoViewIfNeeded({ timeout: 6000 })
    await hold(page, 4)
  } catch { /* ok */ }
}

async function knowledge(page) {
  log("S4 Knowledge Base")
  await page.goto(`${BASE}/guidance`, { waitUntil: "networkidle" })
  await hold(page, 3)
  await slowScroll(page, { step: 320, pause: 650, back: true })
  try {
    const box = page.getByPlaceholder(/search/i).first()
    await box.scrollIntoViewIfNeeded({ timeout: 6000 })
    await box.click(); await hold(page, 0.6)
    await box.fill("personal data"); await hold(page, 0.6)
    await box.press("Enter")
    await page.waitForTimeout(2800)
    await hold(page, 3)
    await slowScroll(page, { step: 300, pause: 700, back: false })
    log("  KB search done")
  } catch (e) { log(`  KB search miss: ${e.message}`) }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: VP, recordVideo: { dir: RAW, size: VP } })
  const page = await ctx.newPage()
  await commandCentre(page)
  await cases(page)
  await caseDetail(page)
  await knowledge(page)
  const video = page.video()
  await ctx.close()
  if (video) {
    const src = await video.path()
    const out = path.join(RAW, "segmentA.webm")
    fs.copyFileSync(src, out)
    log(`SEGMENT_A_SAVED ${out}`)
  }
  await browser.close()
  log("DONE")
}
main().catch((e) => { console.error("RECORD ERROR", e); process.exit(1) })
