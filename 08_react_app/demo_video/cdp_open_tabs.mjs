// Ensure the three demo tabs exist in the CDP-attached Chrome, then leave them
// open for the user to log into. Does NOT drive anything.
import { chromium } from "playwright";

const URLS = {
  gmail: "https://mail.google.com/",
  outlook: "https://outlook.office.com/mail/",
  intake: "https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app/intake",
};

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = browser.contexts()[0];
const have = ctx.pages().map((p) => p.url());
console.log("existing tabs:", have);

async function ensure(url, matchFrag) {
  const hit = ctx.pages().find((p) => p.url().includes(matchFrag));
  if (hit) { console.log("kept   :", matchFrag); return; }
  const pg = await ctx.newPage();
  await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("nav warn", matchFrag, e.message));
  console.log("opened :", url);
}

await ensure(URLS.gmail, "mail.google.com");
await ensure(URLS.outlook, "outlook.office.com");
await ensure(URLS.intake, "snowflakecomputing.app");

console.log("\nTABS READY — log into each, then tell me 'done'.");
await browser.close(); // detaches CDP only; Chrome + tabs stay open
