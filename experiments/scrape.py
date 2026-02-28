"""
PDF Scraper & Downloader with Playwright
- Opens browser so you can log in manually
- Press Enter in the terminal when ready — you can then freely use the browser
- Scrapes the table and downloads all PDFs
"""

import os
import re
import time
import asyncio
from playwright.async_api import async_playwright

# ── Config ────────────────────────────────────────────────────────────────────
PAGE_URL   = "https://lib-nus-edu-sg.libproxy1.nus.edu.sg/nus/copapers/CO273/CO273.html"
OUTPUT_DIR = "./pdfs"
DELAY      = 1.0
LIMIT      = 50   # set to e.g. 5 to download only the first 5 PDFs, None for all
# ─────────────────────────────────────────────────────────────────────────────


def sanitize(name: str) -> str:
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    return re.sub(r'\s+', "_", name.strip())[:200]


async def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page    = await context.new_page()

        print(f"Opening {PAGE_URL} ...")
        await page.goto(PAGE_URL)

        input("\n>>> Log in via the browser, then press Enter here to start scraping.\n"
              "    (You can freely use the browser after this — scraping runs in the background)\n")

        # In case login redirected away, go back to the target page
        if PAGE_URL not in page.url:
            print("Navigating back to target page...")
            await page.goto(PAGE_URL)
            await page.wait_for_load_state("networkidle")

        # Parse table
        print("Scanning page for PDFs...")
        rows = await page.query_selector_all("tr")
        entries = []
        for row in rows:
            cells = await row.query_selector_all("td")
            if len(cells) < 3:
                continue
            link = await cells[0].query_selector("a")
            if not link:
                continue
            href = await link.get_attribute("href")
            if not href or ".pdf" not in href.lower():
                continue
            entries.append({
                "url":         href,
                "pdf_id":      (await link.inner_text()).strip(),
                "description": (await cells[1].inner_text()).strip(),
                "date":        (await cells[2].inner_text()).strip(),
            })

        if LIMIT:
            entries = entries[:LIMIT]
            print(f"Found {len(entries)} PDFs (limited to {LIMIT}) — starting downloads...\n")
        else:
            print(f"Found {len(entries)} PDFs — starting downloads...\n")

        for i, entry in enumerate(entries, 1):
            name = f"{sanitize(entry['pdf_id'])} - {sanitize(entry['description'])} ({sanitize(entry['date'])}).pdf"
            dest = os.path.join(OUTPUT_DIR, name)

            if os.path.exists(dest):
                print(f"[{i}/{len(entries)}] [skip] {name}")
                continue

            print(f"[{i}/{len(entries)}] Downloading: {name} ...")
            try:
                response = await context.request.get(entry["url"], timeout=200000)  # 5 min
                if response.ok:
                    with open(dest, "wb") as f:
                        f.write(await response.body())
                    print(f"[{i}/{len(entries)}] [ok]   {name}")
                else:
                    print(f"[{i}/{len(entries)}] [err]  {name} → HTTP {response.status}")
                time.sleep(DELAY)
            except Exception as e:
                print(f"[{i}/{len(entries)}] [err]  {name} → {e}")

        await browser.close()
        print(f"\nDone. Saved to: {os.path.abspath(OUTPUT_DIR)}")


asyncio.run(main())