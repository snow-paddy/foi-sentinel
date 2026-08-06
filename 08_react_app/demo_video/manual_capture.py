"""
Manual-drive screen capture for the FOI Sentinel demo.

Opens a HEADED Chromium window at the SPCS app so the operator can complete
Snowflake SSO and then click through the demo live. Playwright records the
page video the whole time. Recording ends when EITHER the operator closes the
window OR a stop-sentinel file appears (touched by the assistant when the
operator says "done"). On stop, the context is closed cleanly so the .webm is
flushed to demo_video/raw/.
"""
import asyncio
import os
from playwright.async_api import async_playwright

APP_URL = "https://a7zt2t-sfseeurope-us-west-demo-pg.snowflakecomputing.app"
STOP_SENTINEL = "/tmp/foi_stop_recording"
RAW_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
VIEWPORT = {"width": 1440, "height": 900}


async def main() -> None:
    os.makedirs(RAW_DIR, exist_ok=True)
    # Clear any stale sentinel from a previous run.
    if os.path.exists(STOP_SENTINEL):
        os.remove(STOP_SENTINEL)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(
            viewport=VIEWPORT,
            record_video_dir=RAW_DIR,
            record_video_size=VIEWPORT,
        )
        page = await context.new_page()
        await page.goto(APP_URL, wait_until="domcontentloaded")
        print(f"RECORDING_STARTED url={APP_URL}", flush=True)
        print("Log in via SSO, then drive the demo. Stop by closing the window "
              f"or creating {STOP_SENTINEL}.", flush=True)

        # Run until the operator signals done (sentinel) or closes the window.
        while True:
            if os.path.exists(STOP_SENTINEL):
                print("STOP_SENTINEL_SEEN", flush=True)
                break
            if page.is_closed():
                print("WINDOW_CLOSED", flush=True)
                break
            await asyncio.sleep(1)

        # Flush video: closing the context finalises the .webm.
        try:
            video = page.video
            await context.close()
            if video:
                path = await video.path()
                print(f"VIDEO_SAVED path={path}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"VIDEO_FLUSH_NOTE {e}", flush=True)
        finally:
            try:
                await browser.close()
            except Exception:
                pass
        if os.path.exists(STOP_SENTINEL):
            os.remove(STOP_SENTINEL)
        print("RECORDING_ENDED", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
