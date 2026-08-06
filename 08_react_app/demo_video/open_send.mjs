// open_send.mjs — reopen the authenticated profile with the FOI email pre-filled
// so you can send it by hand, then watch it arrive in Outlook. Stays open until
// you: touch /tmp/foi_send_done
import { chromium } from "playwright"
import fs from "node:fs"

const UDD = process.env.HOME + "/foi_demo_chromium"  // Playwright bundled Chromium (unmanaged)
const SENT = "/tmp/foi_send_done"
const MAILBOX = "foi@exampleton.onmicrosoft.com"
const SUBJECT = "Freedom of Information request: senior officer salaries"
const BODY =
  "Dear Exampleton Borough Council,\n\nUnder the Freedom of Information Act 2000, please provide the job title and annual salary of every member of staff earning more than \u00a3100,000 in the current financial year.\n\nIf any of this is already published, a link is fine.\n\nMany thanks,\nA. Member of Public"
try { fs.unlinkSync(SENT) } catch {}

const ctx = await chromium.launchPersistentContext(UDD, {
  headless: false,
  viewport: null,
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled", "--no-first-run",
         "--no-default-browser-check", "--window-size=1920,1080", "--window-position=0,0", "--start-maximized"],
})

const compose = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(MAILBOX)}&su=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`
const g = ctx.pages()[0] || (await ctx.newPage())
await g.goto(compose, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("gmail:", e.message))
const o = await ctx.newPage()
await o.goto("https://outlook.office.com/mail/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("outlook:", e.message))

console.log("COMPOSE_READY — the email is pre-filled in Gmail. Review it, click Send,")
console.log("then (after it lands in Outlook):  touch /tmp/foi_send_done")
while (!fs.existsSync(SENT)) { await new Promise((r) => setTimeout(r, 1000)) }
try { fs.unlinkSync(SENT) } catch {}
await ctx.close()
console.log("SEND_PHASE_DONE — profile preserved")
