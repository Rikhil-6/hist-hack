import asyncio, os, base64
from pathlib import Path
import fitz
from google import genai
from google.genai import types

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

DPI         = 200
CONCURRENCY = 5
MODEL       = "gemini-2.0-flash"

OCR_PROMPT = """Transcribe ALL text from this historical colonial document page as it appears.
Preserve original spelling, capitalisation, punctuation, and paragraph breaks.
Interpolate reasonably with context to ensure the result is readable; but also ensure high fidelity with the observation.
Prefix marginalia with [MARGIN: ...], headers/stamps with [HEADER: ...], illegible regions with [ILLEGIBLE].
Output the raw transcription ONLY. No commentary."""


def extract_pages(pdf_path: str) -> list[tuple[int, bytes]]:
    """Render each PDF page to PNG bytes in memory — no disk writes."""
    doc = fitz.open(pdf_path)
    pages = []
    for i in range(len(doc)):
        pix = doc[i].get_pixmap(dpi=DPI)
        pages.append((i + 1, pix.tobytes("png")))
    doc.close()
    return pages


async def ocr_page(page_num: int, img_bytes: bytes, total: int, job_id: str) -> dict:
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=MODEL,
            contents=[
                types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
                types.Part.from_text(text=OCR_PROMPT),
            ],
        )
        return {
            "job_id":    job_id,
            "page":      page_num,
            "total":     total,
            "image_b64": base64.b64encode(img_bytes).decode(),
            "text":      response.text.strip(),
            "status":    "ok",
        }
    except Exception as e:
        return {
            "job_id":    job_id,
            "page":      page_num,
            "total":     total,
            "image_b64": base64.b64encode(img_bytes).decode(),  # still show the image even if OCR fails
            "text":      f"[OCR ERROR: {e}]",
            "status":    "error",
        }


async def run_ocr_pipeline(pdf_path: str, job_id: str):
    """Async generator — yields one result dict per page as it completes, in page order."""
    pages         = extract_pages(pdf_path)
    total         = len(pages)
    sem           = asyncio.Semaphore(CONCURRENCY)

    async def bounded(pn, img_bytes):
        async with sem:
            return await ocr_page(pn, img_bytes, total, job_id)

    pending       = {asyncio.ensure_future(bounded(pn, ib)) for pn, ib in pages}
    completed     = {}
    next_to_yield = 1

    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for fut in done:
            r = fut.result()
            completed[r["page"]] = r
        while next_to_yield in completed:
            yield completed.pop(next_to_yield)
            next_to_yield += 1