"""
Segment A recorder — automated FOI walkthrough (I drive), headless, records .webm.

Final-video order (user's narrative): Command Centre -> Cases -> Knowledge Base.
Unlike the rejected URL-flythrough, this performs REAL interactions:
  - word-cloud hover + click -> filtered cases drill-down
  - Cases focus lanes, hover precedent/complexity chips, switch to List view
  - open FOI-2026-0115: AI triage, precedent card, hash-chained audit trail
  - Knowledge Base semantic search ("personal data") -> cross-authority precedent

Runs against localhost:3000 (no SSO). Output: demo_video/raw/segmentA.webm
"""
import asyncio, os, re, shutil
from playwright.async_api import async_playwright, Page

BASE = "http://localhost:3000"
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
VIEWPORT = {"width": 1440, "height": 900}
WC_TITLE = re.compile(r"click to see these cases", re.I)


async def hold(page: Page, s: float):
    await page.wait_for_timeout(int(s * 1000))


async def slow_scroll(page: Page, step: int = 300, pause: int = 700, back: bool = True):
    total = await page.evaluate("() => document.body.scrollHeight")
    y = 0
    while y < total - VIEWPORT["height"]:
        y += step
        await page.evaluate(f"window.scrollTo({{top:{y},behavior:'smooth'}})")
        await page.wait_for_timeout(pause)
    await page.wait_for_timeout(1000)
    if back:
        await page.evaluate("window.scrollTo({top:0,behavior:'smooth'})")
        await page.wait_for_timeout(800)


async def try_hover(page: Page, locator, label: str, dwell: float = 2.0):
    try:
        el = locator.first
        await el.scroll_into_view_if_needed(timeout=5000)
        await el.hover(timeout=5000)
        await hold(page, dwell)
        print(f"  hover ok: {label}", flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"  hover miss {label}: {e}", flush=True)


async def section_command_centre(page: Page):
    print("S1 Command Centre", flush=True)
    await page.goto(BASE + "/", wait_until="networkidle")
    # wait for clickable word-cloud terms to render
    try:
        await page.wait_for_function(
            "() => [...document.querySelectorAll('svg text')].some(t => /click to see these cases/i.test((t.querySelector('title')||{}).textContent||''))",
            timeout=20000,
        )
    except Exception:
        pass
    await hold(page, 3)
    # slow read of scorecard / SLA gauge / peer benchmark, then down to Cortex section
    await slow_scroll(page, step=300, pause=750, back=False)
    # find the top word-cloud term, hover then click -> drill-down
    term = await page.evaluate(
        "() => { const n=[...document.querySelectorAll('svg text')].filter(t=>/click to see these cases/i.test((t.querySelector('title')||{}).textContent||'')); if(!n.length) return null; const t=n[0].querySelector('title').textContent.match(/^(.+?):/); return t?t[1]:null }"
    )
    if term:
        wc = page.locator("svg text", has_text=term).first
        await try_hover(page, wc, f"word-cloud '{term}'", dwell=2.0)
        try:
            await wc.click(timeout=5000)
            await page.wait_for_url(re.compile(r"/cases\?.*keyword="), timeout=8000)
            await page.wait_for_timeout(500)
            try:
                await page.get_by_text(re.compile(r"Showing cases mentioning", re.I)).first.wait_for(timeout=6000)
            except Exception:
                pass
            await hold(page, 4)
            print(f"  drilldown -> {page.url}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"  word-cloud click miss: {e}", flush=True)


async def section_cases(page: Page):
    print("S2 Cases", flush=True)
    await page.goto(BASE + "/cases", wait_until="networkidle")
    try:
        await page.get_by_text("Quick wins", exact=False).first.wait_for(timeout=12000)
    except Exception:
        pass
    await hold(page, 4)
    # hover a precedent pill and a complexity chip (tooltips)
    await try_hover(page, page.get_by_text(re.compile(r"% precedent match", re.I)), "precedent pill", 2.5)
    await try_hover(page, page.locator("[class*='complexity'], [aria-label*='omplexity']"), "complexity chip", 2.5)
    # switch to List view if a toggle exists
    for name in ["List", "List view", "Table"]:
        try:
            await page.get_by_role("button", name=re.compile(name, re.I)).first.click(timeout=3000)
            await hold(page, 3)
            print(f"  switched to {name} view", flush=True)
            break
        except Exception:
            continue
    await slow_scroll(page, step=320, pause=650, back=False)


async def section_case_detail(page: Page):
    print("S2 Case detail FOI-2026-0115", flush=True)
    await page.goto(BASE + "/cases/FOI-2026-0115", wait_until="networkidle")
    try:
        await page.get_by_text(re.compile(r"How AI triaged this case|AI triage", re.I)).first.wait_for(timeout=12000)
    except Exception:
        pass
    await hold(page, 4)
    await slow_scroll(page, step=280, pause=750, back=False)
    # ensure the audit trail (Chain verified) gets screen time
    try:
        await page.get_by_text(re.compile(r"AI evidence & audit trail", re.I)).first.scroll_into_view_if_needed(timeout=6000)
        await hold(page, 4)
    except Exception:
        pass


async def section_knowledge(page: Page):
    print("S4 Knowledge Base", flush=True)
    await page.goto(BASE + "/guidance", wait_until="networkidle")
    await hold(page, 3)
    await slow_scroll(page, step=320, pause=650, back=True)
    try:
        box = page.get_by_placeholder(re.compile(r"search", re.I)).first
        await box.scroll_into_view_if_needed(timeout=6000)
        await box.click()
        await hold(page, 0.6)
        await box.fill("personal data")
        await hold(page, 0.6)
        await box.press("Enter")
        await page.wait_for_timeout(2800)
        await hold(page, 3)
        await slow_scroll(page, step=300, pause=700, back=False)
        print("  KB search done", flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"  KB search miss: {e}", flush=True)


async def main():
    os.makedirs(RAW, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=VIEWPORT, record_video_dir=RAW, record_video_size=VIEWPORT)
        page = await ctx.new_page()
        await section_command_centre(page)
        await section_cases(page)
        await section_case_detail(page)
        await section_knowledge(page)
        video = page.video
        await ctx.close()
        out = None
        if video:
            src = await video.path()
            out = os.path.join(RAW, "segmentA.webm")
            shutil.copyfile(src, out)
            print(f"SEGMENT_A_SAVED {out}", flush=True)
        await browser.close()
        print("DONE", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
