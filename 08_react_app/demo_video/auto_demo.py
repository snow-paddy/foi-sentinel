"""
Automated FOI Sentinel demo walkthrough (operator only logs in).

Opens a HEADED Chromium window at the SPCS app and records the whole session.
It waits for the operator to complete Snowflake SSO (detected when the Command
Centre renders), then automatically navigates every demo URL in chronological
order with smooth scrolls and holds so the tour plays hands-free. On completion
the context is closed so the .webm is flushed to demo_video/raw/.

The operator's ONLY job is to log in when the window opens.
"""
import asyncio
import os
from playwright.async_api import async_playwright, Page

BASE = "https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app"
RAW_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
VIEWPORT = {"width": 1440, "height": 900}
LOGIN_TIMEOUT_MS = 300_000  # 5 min for manual SSO
READY_TEXT = "FOI Command Centre"  # home <h1>, only present after login

# (path, label, hold_s at top, scroll?, settle_selector)
SECTIONS = [
    ("/",                              "S1 Command Centre",        4, True,  "FOI Command Centre"),
    ("/cases",                         "S2 Cases list",            4, True,  "Cases"),
    ("/cases/FOI-2026-0115",           "S2 Case detail + audit",   5, True,  "How AI triaged this case"),
    ("/intake",                        "S3 Intake",                5, True,  "Run the pipeline"),
    ("/guidance",                      "S4 Knowledge Base",        4, True,  "Evidence base"),
    ("/sar",                           "S5 SAR + Redaction",       5, True,  "Subject Access Request"),
    ("/cases/FOI-2026-0115",           "S7 Price (case 1)",        3, False, "AI cost of this response"),
    ("/cases/FOI-2026-D07060953030",   "S7 Price (case 2)",        4, False, "AI cost of this response"),
]


async def hold(page: Page, seconds: float) -> None:
    await page.wait_for_timeout(int(seconds * 1000))


async def smooth_scroll(page: Page) -> None:
    """Scroll from top to bottom and part-way back, in readable steps."""
    total = await page.evaluate("() => document.body.scrollHeight")
    step = 380
    y = 0
    while y < total - VIEWPORT["height"]:
        y += step
        await page.evaluate(f"window.scrollTo({{top: {y}, behavior: 'smooth'}})")
        await page.wait_for_timeout(650)
    await page.wait_for_timeout(1200)


async def scroll_to_text(page: Page, text: str) -> None:
    try:
        await page.get_by_text(text, exact=False).first.scroll_into_view_if_needed(timeout=8000)
    except Exception as e:  # noqa: BLE001
        print(f"  scroll_to_text miss '{text}': {e}", flush=True)


async def main() -> None:
    os.makedirs(RAW_DIR, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(
            viewport=VIEWPORT, record_video_dir=RAW_DIR, record_video_size=VIEWPORT
        )
        page = await context.new_page()

        print(f"OPENING {BASE} - please complete SSO login in the window", flush=True)
        await page.goto(BASE, wait_until="domcontentloaded")
        try:
            await page.wait_for_selector(f"text={READY_TEXT}", timeout=LOGIN_TIMEOUT_MS)
        except Exception:
            print("LOGIN_NOT_DETECTED - aborting so nothing half-recorded", flush=True)
            await context.close()
            await browser.close()
            return
        print("LOGIN_OK - starting automated tour", flush=True)
        await hold(page, 2)

        for path, label, top_hold, do_scroll, settle in SECTIONS:
            url = BASE + path
            print(f"SECTION {label} -> {path}", flush=True)
            try:
                await page.goto(url, wait_until="domcontentloaded")
                try:
                    await page.wait_for_selector(f"text={settle}", timeout=15000)
                except Exception:
                    await hold(page, 2)
                await hold(page, top_hold)
                if do_scroll:
                    await smooth_scroll(page)
                else:
                    await scroll_to_text(page, settle)
                    await hold(page, top_hold)
            except Exception as e:  # noqa: BLE001
                print(f"  SECTION ERROR {label}: {e}", flush=True)
                await hold(page, 2)

        print("TOUR_DONE - flushing video", flush=True)
        video = page.video
        await context.close()
        if video:
            try:
                print(f"VIDEO_SAVED path={await video.path()}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"VIDEO_PATH_NOTE {e}", flush=True)
        await browser.close()
        print("RECORDING_ENDED", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
