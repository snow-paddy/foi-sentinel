// record_demo.mjs — FOI Sentinel, PHASED automated capture.
//
// Reuses the AUTHENTICATED persistent profile primed by pw_login.mjs
// (~/foi_demo_pw_profile), so Gmail, Outlook, the SPCS app and SharePoint are
// already signed in. NO logins occur during a phase run, so nothing needs trimming.
//
// Recorded in 3 phases (de-risked; each is its own clip):
//   PHASE=1  FOI Sentinel walkthrough  (Command Centre + Cases + audit chain)      [FOI SSO only]
//   PHASE=2  Email + intake            (Gmail send -> Outlook receive -> intake -> Response Studio)
//   PHASE=3  SAR + SharePoint          (Redaction Studio -> SharePoint continuous sync)
//   PHASE=all  run everything in order (single clip)
//
// Screen capture is done SEPARATELY (screenrec.sh WITH mic for a live-narration
// attempt, or screenrec_noaudio.sh for silent + post VO). This script drives,
// then touches the stop sentinel at the end of the phase so the recorder stops.
//
// Env:
//   PHASE           1 | 2 | 3 | all   (default: all)
//   BASE            app base URL (default: deployed SPCS app)
//   STOP_SENTINEL   file to touch to stop the external recorder (default /tmp/foi_stop_recording)
//   SHAREPOINT_URL  SharePoint site URL for the FOISARDemo library
//
// Run (after pw_login.mjs primed the profile, and after starting the recorder):
//   PHASE=1 node demo_video/record_demo.mjs
import { chromium } from "playwright"
import fs from "node:fs"

const DEPLOYED = "https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app"
const BASE = process.env.BASE || DEPLOYED
const PHASE = (process.env.PHASE || "all").toLowerCase()
const UDD = process.env.HOME + "/foi_demo_chromium"  // Playwright bundled Chromium (unmanaged)
const STOP = process.env.STOP_SENTINEL || "/tmp/foi_stop_recording"
const MAILBOX = "foi@exampleton.onmicrosoft.com"
const isMac = process.platform === "darwin"

const GMAIL = "https://mail.google.com/"
const OUTLOOK = "https://outlook.office.com/mail/"
const SHAREPOINT = process.env.SHAREPOINT_URL || "https://exampleton.sharepoint.com/sites/FOISARDemo/Shared%20Documents"

const SUBJECT = "Freedom of Information request: senior officer salaries"
const BODY =
  "Dear Exampleton Borough Council,\n\nUnder the Freedom of Information Act 2000 please provide the job title and annual salary of every member of staff earning over \u00a3100,000, for the current financial year.\n\nMany thanks."

const log = (m) => console.log(`[rec] ${m}`)
const hold = (page, s) => page.waitForTimeout(Math.round(s * 1000))

async function smoothScroll(page, { step = 300, pause = 650, back = false } = {}) {
  const total = await page.evaluate(() => document.body.scrollHeight)
  const vh = await page.evaluate(() => window.innerHeight)
  let y = 0
  while (y < total - vh) {
    y += step
    await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: "smooth" }), y)
    await page.waitForTimeout(pause)
  }
  await page.waitForTimeout(800)
  if (back) { await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await page.waitForTimeout(700) }
}

async function moveTo(page, locator, dwell = 1.2) {
  try {
    const el = locator.first()
    await el.scrollIntoViewIfNeeded({ timeout: 5000 })
    const box = await el.boundingBox()
    if (box) { await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 40), { steps: 20 }); await hold(page, dwell) }
  } catch (e) { log(`  moveTo miss: ${e.message}`) }
}

async function show(page, s = 2.5) { await page.bringToFront(); await hold(page, s) }

// ---- ACT 1 -------------------------------------------------------------
async function act1(app) {
  log("ACT 1 — Command Centre")
  await app.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }); await hold(app, 3.5)
  await smoothScroll(app, { step: 300, pause: 750 })
  // clickable word cloud -> filtered cases (best-effort)
  try {
    const wc = app.locator("svg text").filter({ hasText: /./ }).first()
    await moveTo(app, wc, 1.5)
  } catch {}
  log("ACT 1 — Cases")
  await app.goto(`${BASE}/cases`, { waitUntil: "domcontentloaded" })
  await app.getByText(/Quick wins/i).first().waitFor({ timeout: 12000 }).catch(() => {})
  await hold(app, 3)
  await moveTo(app, app.getByText(/% match|precedent/i), 2)
  await moveTo(app, app.locator("[class*='complexity'],[aria-label*='omplexity']"), 2)
  await smoothScroll(app, { step: 320, pause: 600 })
  log("ACT 1 — Case detail + audit chain")
  await app.goto(`${BASE}/cases/FOI-2026-0115`, { waitUntil: "domcontentloaded" })
  await app.getByText(/How AI triaged this case|AI triage/i).first().waitFor({ timeout: 12000 }).catch(() => {})
  await hold(app, 3.5)
  await smoothScroll(app, { step: 280, pause: 700 })
  await app.getByText(/AI evidence & audit trail/i).first().scrollIntoViewIfNeeded({ timeout: 6000 }).catch(() => {})
  await app.getByText(/Chain verified/i).first().waitFor({ timeout: 6000 }).catch(() => {})
  await hold(app, 4)
}

// ---- ACT 2 -------------------------------------------------------------
async function gmailSend(gmail) {
  // Default: you send the email by hand on camera (more authentic), so we only
  // surface Gmail's Sent view. Set SEND_EMAIL=1 to auto-send via deep-link.
  if (process.env.SEND_EMAIL === "1") {
    log("ACT 2 — Gmail compose + send (auto)")
    const url = `${GMAIL}mail/?view=cm&fs=1&to=${encodeURIComponent(MAILBOX)}&su=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`
    await gmail.goto(url, { waitUntil: "domcontentloaded" }).catch((e) => log(`  gmail nav: ${e.message}`))
    await hold(gmail, 4)
    await gmail.keyboard.press(isMac ? "Meta+Enter" : "Control+Enter").catch(() => {})
    await hold(gmail, 3)
    return
  }
  log("ACT 2 — Gmail Sent view (you sent it by hand)")
  await gmail.goto(`${GMAIL}mail/u/0/#sent`, { waitUntil: "domcontentloaded" }).catch((e) => log(`  gmail nav: ${e.message}`))
  await hold(gmail, 3)
  await moveTo(gmail, gmail.getByText(/senior officer salaries/i), 2)
}

async function outlookReceive(outlook) {
  log("ACT 2 — Outlook receive")
  await outlook.goto(OUTLOOK, { waitUntil: "domcontentloaded" }).catch((e) => log(`  outlook nav: ${e.message}`))
  await hold(outlook, 4)
  // Give Graph a moment to deliver, then show the top of the inbox.
  await outlook.reload({ waitUntil: "domcontentloaded" }).catch(() => {})
  await hold(outlook, 4)
  await moveTo(outlook, outlook.getByText(/senior officer salaries/i), 2.5)
}

async function act2Intake(app) {
  log("ACT 2 — Intake + pipeline")
  await app.goto(`${BASE}/intake`, { waitUntil: "domcontentloaded" }); await hold(app, 3)
  // Outlook Test tab is default; show "Waiting to be triaged" then run the pipeline.
  await app.getByText(/Waiting to be triaged/i).first().waitFor({ timeout: 12000 }).catch(() => {})
  await hold(app, 2.5)
  try {
    await app.getByRole("button", { name: /Run the pipeline/i }).first().click({ timeout: 8000 })
  } catch (e) { log(`  run pipeline miss: ${e.message}`) }
  // Let the 6 steps reveal.
  await app.getByText(/Compiled draft/i).first().waitFor({ timeout: 120000 }).catch(() => {})
  await smoothScroll(app, { step: 300, pause: 900 })
  await hold(app, 3)
  // Open the compiled case and its Response Studio draft.
  try {
    await app.getByRole("link", { name: /Open case|Open the case/i }).first().click({ timeout: 8000 })
    await hold(app, 4)
  } catch (e) { log(`  open case miss: ${e.message}`) }
  await smoothScroll(app, { step: 280, pause: 700 })
  // Provenance + citation legend + DISCLOSURE badges
  await app.getByText(/Exemption stated|Internal review|ICO route/i).first().scrollIntoViewIfNeeded({ timeout: 6000 }).catch(() => {})
  await hold(app, 4)
}

// ---- ACT 3 -------------------------------------------------------------
async function act3Sar(app) {
  log("ACT 3 — SAR + Redaction Studio")
  await app.goto(`${BASE}/sar`, { waitUntil: "domcontentloaded" }); await hold(app, 3.5)
  await smoothScroll(app, { step: 300, pause: 750 })
  try {
    await app.getByRole("button", { name: /Run AI redaction/i }).first().click({ timeout: 8000 })
    await hold(app, 5)
  } catch (e) { log(`  run redaction miss: ${e.message}`) }
  await smoothScroll(app, { step: 280, pause: 700 })
  // untick the council officer's email to KEEP it (AI suggests, officer decides)
  try {
    await moveTo(app, app.getByText(/thomas\.lee@/i), 1.5)
    const row = app.getByText(/thomas\.lee@/i).first()
    const cb = row.locator("xpath=ancestor::*[self::li or self::tr or self::div][1]//input[@type='checkbox']").first()
    await cb.click({ timeout: 4000 }).catch(() => {})
    await hold(app, 2.5)
  } catch (e) { log(`  untick miss: ${e.message}`) }
  try { await app.getByRole("button", { name: /Confirm & release|Release/i }).first().click({ timeout: 6000 }); await hold(app, 3) } catch {}
  try { await app.getByRole("button", { name: /Re-run|Rerun/i }).first().click({ timeout: 6000 }); await hold(app, 4) } catch {}
  await app.getByText(/Learned from|kept last time/i).first().waitFor({ timeout: 8000 }).catch(() => {})
  await hold(app, 3.5)
}

async function act3SharePoint(sp) {
  log("ACT 3 — SharePoint continuous sync")
  await sp.goto(SHAREPOINT, { waitUntil: "domcontentloaded" }).catch((e) => log(`  sharepoint nav: ${e.message}`))
  await hold(sp, 5)
  // The upload of 2026-04-02_ASC-2026-04021_file_note.docx is done manually/off-camera
  // just before this beat (see RECORD.md). Here we simply dwell on the library.
  await smoothScroll(sp, { step: 250, pause: 700 }).catch(() => {})
  await hold(sp, 3)
}

async function main() {
  const localhost = BASE.includes("localhost")
  const ctx = await chromium.launchPersistentContext(UDD, {
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run", "--no-default-browser-check",
      "--window-size=1920,1080", "--window-position=0,0",
      "--start-maximized",
    ],
  })

  // Reuse existing tabs where present, else open fresh ones.
  const pageFor = async (frag, url) => {
    const hit = ctx.pages().find((p) => p.url().includes(frag))
    if (hit) return hit
    const p = await ctx.newPage()
    if (url) await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {})
    return p
  }

  const appFrag = localhost ? "localhost" : "snowflakecomputing.app"
  const app = await pageFor(appFrag, BASE)
  await hold(app, 1)

  const doP1 = PHASE === "1" || PHASE === "all"
  const doP2 = PHASE === "2" || PHASE === "all"
  const doP3 = PHASE === "3" || PHASE === "all"

  if (doP1) {
    await show(app, 1)
    await act1(app)
  }

  if (doP2) {
    if (!localhost) {
      const gmail = await pageFor("mail.google.com", GMAIL)
      await show(gmail, 1); await gmailSend(gmail)
      const outlook = await pageFor("outlook.office.com", OUTLOOK)
      await show(outlook, 1); await outlookReceive(outlook)
    } else {
      log("localhost — skipping Gmail/Outlook beats (in-app dry-run)")
    }
    await show(app, 1); await act2Intake(app)
  }

  if (doP3) {
    await show(app, 1); await act3Sar(app)
    if (!localhost) {
      const sp = await pageFor("sharepoint.com", SHAREPOINT)
      await show(sp, 1); await act3SharePoint(sp)
    }
  }

  log(`phase ${PHASE} choreography complete — stopping recorder`)
  try { fs.writeFileSync(STOP, "stop") } catch {}
  await hold(app, 1.5)
  await ctx.close()
  log("DONE")
}

main().catch((e) => { console.error("RECORD ERROR", e); try { fs.writeFileSync(STOP, "stop") } catch {}; process.exit(1) })
