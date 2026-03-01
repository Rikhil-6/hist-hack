import asyncio
import concurrent.futures
import os
import re
import base64
import tempfile
from pathlib import Path

import fitz
from google import genai
from google.genai import types
from google.cloud import storage
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential, retry_if_exception
from dotenv import load_dotenv

load_dotenv()

# ── Thread pool ──────────────────────────────────────────────────────────
asyncio.get_event_loop().set_default_executor(
    concurrent.futures.ThreadPoolExecutor(max_workers=100)
)

# ── Config ───────────────────────────────────────────────────────────────
MODEL_ID          = "gemini-2.5-flash"
CHUNK_SIZE        = 50
CHUNK_CONCURRENCY = 10

PROJECT_ID    = "project-3f441d35-164a-4a8d-b3a"
BUCKET_NAME   = "hist-hack-bucket2"
OUTPUT_FOLDER = "ocr_results"

client         = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
storage_client = storage.Client(project=PROJECT_ID)
bucket         = storage_client.bucket(BUCKET_NAME)

OCR_PROMPT = """Transcribe ALL text from this historical colonial document as it appears.
Preserve original spelling, capitalisation, punctuation, and paragraph breaks.
Interpolate reasonably with context to ensure the result is readable; but also ensure high fidelity with the observation.
Prefix marginalia with [MARGIN: ...], headers/stamps with [HEADER: ...], illegible regions with [ILLEGIBLE].
Blank page → output [BLANK PAGE].
Separate each page's transcription with: --- PAGE N ---
  where N is the absolute page number passed to you.
Output the raw transcription ONLY. No commentary."""

# ── Upload page text to GCS ───────────────────────────────────────────────
async def _save_to_gcs(doc_name: str, pn: int, text: str):
    blob_name = f"{OUTPUT_FOLDER}/{doc_name}/{doc_name}_{pn:04d}.txt"
    await asyncio.to_thread(
        bucket.blob(blob_name).upload_from_string,
        text,
        content_type="text/plain",
    )

async def _mark_complete(doc_name: str, n_pages: int):
    blob_name = f"{OUTPUT_FOLDER}/{doc_name}/_complete.txt"
    await asyncio.to_thread(
        bucket.blob(blob_name).upload_from_string,
        f"{doc_name} — {n_pages} pages complete",
        content_type="text/plain",
    )

# ── Retryable errors ─────────────────────────────────────────────────────
def _is_retryable(exc: Exception) -> bool:
    msg = str(exc)
    return any(code in msg for code in ("429", "503", "500", "RESOURCE_EXHAUSTED"))

# ── Get page count from PDF ───────────────────────────────────────────────
async def _get_page_count(pdf_path: str) -> int:
    def _count():
        doc = fitz.open(pdf_path)
        n = len(doc)
        doc.close()
        return n
    return await asyncio.to_thread(_count)

# ── Render single page to PNG bytes (for image_b64 thumbnail only) ───────
async def _render_page_png(pdf_path: str, page_num: int) -> bytes:
    def _render():
        doc = fitz.open(pdf_path)
        pix = doc[page_num - 1].get_pixmap(dpi=150)
        data = pix.tobytes("png")
        doc.close()
        return data
    return await asyncio.to_thread(_render)

# ── Extract chunk as a sub-PDF bytes (for Gemini upload) ─────────────────
async def _extract_chunk_pdf(pdf_path: str, page_nums: list[int]) -> bytes:
    def _extract():
        src = fitz.open(pdf_path)
        out = fitz.open()
        for pn in page_nums:
            out.insert_pdf(src, from_page=pn - 1, to_page=pn - 1)
        data = out.tobytes()
        src.close()
        out.close()
        return data
    return await asyncio.to_thread(_extract)

# ── Upload chunk to Gemini Files API ─────────────────────────────────────
async def _upload_chunk(chunk_bytes: bytes) -> types.File:
    def _upload():
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(chunk_bytes)
            tmp_path = f.name
        file_obj = client.files.upload(
            file=tmp_path,
            config={"mime_type": "application/pdf"},
        )
        os.unlink(tmp_path)
        return file_obj

    file_obj = await asyncio.to_thread(_upload)

    while True:
        status = await asyncio.to_thread(client.files.get, name=file_obj.name)
        if status.state == types.FileState.ACTIVE:
            break
        if status.state == types.FileState.FAILED:
            raise RuntimeError(f"Gemini file upload failed")
        await asyncio.sleep(1)

    return file_obj

# ── Delete Gemini file ────────────────────────────────────────────────────
async def _delete_gemini_file(file_obj: types.File):
    try:
        await asyncio.to_thread(client.files.delete, name=file_obj.name)
    except Exception:
        pass

# ── Call Gemini with retry ────────────────────────────────────────────────
async def _call_gemini(file_obj: types.File, start_page: int, end_page: int) -> str:
    prompt = OCR_PROMPT + f"\nThis chunk contains pages {start_page} to {end_page}. Number pages accordingly."

    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(30),
        wait=wait_exponential(multiplier=2, min=5, max=120),
        retry=retry_if_exception(_is_retryable),
        reraise=True,
    ):
        with attempt:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=MODEL_ID,
                contents=[file_obj, prompt],
            )
            if not response.text:
                raise RuntimeError("Empty Gemini response")
            return response.text.strip()

# ── Parse Gemini response into per-page texts ─────────────────────────────
def _parse_pages(raw_text: str, page_nums: list[int]) -> dict[int, str]:
    parts = re.split(r"---\s*PAGE\s*\d+\s*---", raw_text)
    pages = [p.strip() for p in parts if p.strip()]

    # Align to expected page count
    while len(pages) < len(page_nums):
        pages.append("[MISSING]")
    pages = pages[:len(page_nums)]

    return dict(zip(page_nums, pages))

# ── Process one chunk, return dict of {page_num: text} ───────────────────
async def _process_chunk(
    pdf_path: str,
    page_nums: list[int],
    sem: asyncio.Semaphore,
) -> dict[int, str]:
    async with sem:
        file_obj = None
        try:
            chunk_bytes = await _extract_chunk_pdf(pdf_path, page_nums)
            file_obj    = await _upload_chunk(chunk_bytes)
            raw_text    = await _call_gemini(file_obj, page_nums[0], page_nums[-1])
            return _parse_pages(raw_text, page_nums)
        except Exception as e:
            return {pn: f"[OCR ERROR page {pn}: {e}]" for pn in page_nums}
        finally:
            if file_obj:
                await _delete_gemini_file(file_obj)

# ── Public interface — async generator ───────────────────────────────────
async def run_ocr_pipeline(pdf_path: str, job_id: str):
    """
    Async generator yielding one dict per page in page order:
      { job_id, page, total, image_b64, text, status }
    Compatible with routers/ocr.py StreamingResponse.
    """
    n_pages  = await _get_page_count(pdf_path)
    doc_name = Path(pdf_path).stem

    all_page_nums = list(range(1, n_pages + 1))
    chunks        = [all_page_nums[i:i + CHUNK_SIZE] for i in range(0, n_pages, CHUNK_SIZE)]
    sem           = asyncio.Semaphore(CHUNK_CONCURRENCY)

    # Fire all chunks concurrently
    chunk_tasks = {
        pn: None
        for pn in all_page_nums
    }

    # result_map will be populated as chunks complete
    result_map: dict[int, str] = {}
    next_to_yield = 1

    # Queue to receive results as chunks finish
    queue: asyncio.Queue = asyncio.Queue()

    async def run_chunk(page_nums):
        results = await _process_chunk(pdf_path, page_nums, sem)
        await queue.put(results)

    # Launch all chunks
    tasks = [asyncio.ensure_future(run_chunk(chunk)) for chunk in chunks]
    chunks_done = 0

    while chunks_done < len(chunks) or next_to_yield <= n_pages:
        # Wait for next chunk to finish
        if chunks_done < len(chunks):
            chunk_results = await queue.get()
            result_map.update(chunk_results)
            chunks_done += 1

        # Yield all pages we can in order
        while next_to_yield in result_map:
            pn   = next_to_yield
            text = result_map.pop(pn)

            # Render PNG for image_b64 (lower DPI for fast streaming)
            try:
                img_bytes = await _render_page_png(pdf_path, pn)
                image_b64 = base64.b64encode(img_bytes).decode()
            except Exception:
                image_b64 = ""

            status = "error" if text.startswith("[OCR ERROR") else "ok"

            # Save to GCS (fire-and-forget alongside the yield)
            asyncio.ensure_future(_save_to_gcs(doc_name, pn, text))

            yield {
                "job_id":    job_id,
                "page":      pn,
                "total":     n_pages,
                "image_b64": image_b64,
                "text":      text,
                "status":    status,
            }

            next_to_yield += 1

    await _mark_complete(doc_name, n_pages)