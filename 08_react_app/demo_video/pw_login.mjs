// Phase 1 (login): Playwright-controlled Chrome with automation fingerprints
// stripped, so a managed Google account logs in normally. Opens the three demo
// tabs and stays alive until /tmp/foi_login_done appears, then persists profile.
import { chromium } from "playwright";
import fs from "fs";

const UDD = process.env.HOME + "/foi_demo_chromium";  // Playwright bundled Chromium (unmanaged)
const SENT = "/tmp/foi_login_done";
try { fs.unlinkSync(SENT); } catch {}

const ctx = await chromium.launchPersistentContext(UDD, {
  headless: false,
  viewport: null,
  ignoreDefaultArgs: ["--enable-automation"],
  args: [
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1456,948",
    "--window-position=0,0",
  ],
});

const urls = [
  "https://mail.google.com/",
  "https://outlook.office.com/mail/",
  "https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app/intake",
  "https://exampleton.sharepoint.com/sites/FOISARDemo/Shared%20Documents",
];

const first = ctx.pages()[0] || (await ctx.newPage());
await first.goto(urls[0], { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("gmail nav:", e.message));
for (const u of urls.slice(1)) {
  const p = await ctx.newPage();
  await p.goto(u, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("nav:", u, e.message));
}

console.log("LOGIN_TABS_READY — log into Gmail, Outlook and the SSO app, then: touch " + SENT);
while (!fs.existsSync(SENT)) { await new Promise((r) => setTimeout(r, 1000)); }
try { fs.unlinkSync(SENT); } catch {}
await ctx.close();
console.log("LOGIN_PHASE_DONE — profile saved to " + UDD);
