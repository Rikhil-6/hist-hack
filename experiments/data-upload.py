import asyncio
import concurrent.futures
import os
import argparse
import time
import re
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
PROJECT_ID      = "project-3f441d35-164a-4a8d-b3a"
BUCKET_NAME     = "hist-hack-bucket2"
OUTPUT_FOLDER   = "ocr_results"
LOCAL_INPUT_DIR = "./experiments/pdfs"
MODEL_ID        = "gemini-2.5-flash"

CHUNK_SIZE      = 50   # pages per Gemini call
DOC_CONCURRENCY = 5    # parallel documents
CHUNK_CONCURRENCY = 10 # parallel chunks across all docs

# ── Clients ──────────────────────────────────────────────────────────────
genai_client   = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
storage_client = storage.Client(project=PROJECT_ID)
bucket         = storage_client.bucket(BUCKET_NAME)

OCR_PROMPT = """Transcribe all visible text from this historical colonial document.

Rules:
- Preserve original spelling, capitalisation, and punctuation exactly
- Maintain paragraph and line structure as it appears on the page
- Do NOT guess at illegible words — mark them [ILLEGIBLE]
- Margin notes → prefix with [MARGIN: ...]
- Headers/stamps/page numbers → prefix with [HEADER: ...]
- Blank page → output [BLANK PAGE]
- Separate each page's transcription with: --- PAGE N ---
  where N is the absolute page number passed to you
- Output transcription ONLY
"""

# ── Retryable error detection ────────────────────────────────────────────
def _is_retryable(exc: Exception) -> bool:
    msg = str(exc)
    return any(code in msg for code in ("429", "503", "500", "RESOURCE_EXHAUSTED"))

# ── Render a chunk of pages to a temp PDF ───────────────────────────────
async def render_chunk_to_pdf(pdf_path: Path, page_nums: list[int]) -> bytes:
    """Extract given 1-indexed page_nums into an in-memory PDF."""
    def _render():
        src = fitz.open(str(pdf_path))
        out = fitz.open()
        for pn in page_nums:
            out.insert_pdf(src, from_page=pn - 1, to_page=pn - 1)
        data = out.tobytes()
        src.close()
        out.close()
        return data

    return await asyncio.to_thread(_render)

# ── Upload chunk PDF to Gemini Files API ────────────────────────────────
async def upload_chunk(chunk_bytes: bytes, label: str) -> types.File:
    import tempfile

    def _upload():
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(chunk_bytes)
            tmp_path = f.name
        file_obj = genai_client.files.upload(
            file=tmp_path,
            config={"mime_type": "application/pdf"},
        )
        os.unlink(tmp_path)
        return file_obj

    file_obj = await asyncio.to_thread(_upload)

    # Poll until ACTIVE
    while True:
        status = await asyncio.to_thread(genai_client.files.get, name=file_obj.name)
        if status.state == types.FileState.ACTIVE:
            break
        if status.state == types.FileState.FAILED:
            raise RuntimeError(f"Gemini file upload failed for chunk {label}")
        await asyncio.sleep(1)

    return file_obj

# ── Delete Gemini file ───────────────────────────────────────────────────
async def delete_gemini_file(file_obj: types.File):
    try:
        await asyncio.to_thread(genai_client.files.delete, name=file_obj.name)
    except Exception as e:
        print(f"  [WARN] Could not delete Gemini file {file_obj.name}: {e}")

# ── Gemini OCR call with retry ───────────────────────────────────────────
async def call_gemini_with_retry(file_obj: types.File, start_page: int, end_page: int) -> str:
    prompt = OCR_PROMPT + f"\nThis chunk contains pages {start_page} to {end_page}. Number pages accordingly."

    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(30),
        wait=wait_exponential(multiplier=2, min=5, max=120),
        retry=retry_if_exception(_is_retryable),
        reraise=True,
    ):
        with attempt:
            response = await asyncio.to_thread(
                genai_client.models.generate_content,
                model=MODEL_ID,
                contents=[file_obj, prompt],
            )
            if not response.text:
                raise RuntimeError("Empty Gemini response")
            return response.text.strip()

# ── Parse Gemini response and save pages to GCS ─────────────────────────
async def save_chunk_pages(doc_name: str, raw_text: str, page_nums: list[int]):
    parts = re.split(r"---\s*PAGE\s*\d+\s*---", raw_text)
    pages = [p.strip() for p in parts if p.strip()]

    if len(pages) != len(page_nums):
        print(f"  [WARN] {doc_name}: chunk expected {len(page_nums)} pages, got {len(pages)} — aligning best-effort")
        # Pad or trim to match
        while len(pages) < len(page_nums):
            pages.append("[MISSING]")
        pages = pages[:len(page_nums)]

    async def _upload_page(pn: int, text: str):
        blob_name = f"{OUTPUT_FOLDER}/{doc_name}/{doc_name}_{pn:04d}.txt"
        blob = bucket.blob(blob_name)
        await asyncio.to_thread(blob.upload_from_string, text, content_type="text/plain")
        preview = text[:80].replace("\n", " ")
        print(f"  [page {pn:04d}] {doc_name} → {preview}{'...' if len(text) > 80 else ''}")

    await asyncio.gather(*[_upload_page(pn, text) for pn, text in zip(page_nums, pages)])

# ── Process a single chunk ───────────────────────────────────────────────
async def process_chunk(
    pdf_path: Path,
    doc_name: str,
    page_nums: list[int],
    chunk_sem: asyncio.Semaphore,
):
    label = f"{doc_name} p{page_nums[0]}-{page_nums[-1]}"

    async with chunk_sem:
        file_obj = None
        try:
            chunk_bytes = await render_chunk_to_pdf(pdf_path, page_nums)
            file_obj = await upload_chunk(chunk_bytes, label)

            raw_text = await call_gemini_with_retry(file_obj, page_nums[0], page_nums[-1])
            await save_chunk_pages(doc_name, raw_text, page_nums)

            print(f"  ✓ [{label}] done")

        except Exception as e:
            print(f"  [ERROR] [{label}] → {e}")
            # Save error markers so we know which pages failed
            tasks = [
                asyncio.to_thread(
                    bucket.blob(f"{OUTPUT_FOLDER}/{doc_name}/{doc_name}_{pn:04d}.txt").upload_from_string,
                    f"[OCR ERROR page {pn}: {e}]",
                    content_type="text/plain",
                )
                for pn in page_nums
            ]
            await asyncio.gather(*tasks)

        finally:
            if file_obj:
                await delete_gemini_file(file_obj)

# ── Completion Tracking ───────────────────────────────────────────────────
def _marker_path(doc_name: str) -> str:
    return f"{OUTPUT_FOLDER}/{doc_name}/_complete.txt"

async def is_complete(doc_name: str) -> bool:
    blob = bucket.blob(_marker_path(doc_name))
    return await asyncio.to_thread(blob.exists)

async def mark_complete(doc_name: str, n_pages: int):
    blob = bucket.blob(_marker_path(doc_name))
    await asyncio.to_thread(
        blob.upload_from_string,
        f"{doc_name} — {n_pages} pages complete",
        content_type="text/plain",
    )

async def get_existing_pages(doc_name: str) -> set[int]:
    prefix = f"{OUTPUT_FOLDER}/{doc_name}/{doc_name}_"
    blobs = await asyncio.to_thread(
        lambda: list(storage_client.list_blobs(BUCKET_NAME, prefix=prefix))
    )
    existing = set()
    for b in blobs:
        stem = Path(b.name).stem
        try:
            existing.add(int(stem.split("_")[-1]))
        except ValueError:
            continue
    return existing

# ── Single Document ──────────────────────────────────────────────────────
async def process_document(pdf_path: Path, chunk_sem: asyncio.Semaphore):
    doc_name = pdf_path.stem
    t0 = time.time()

    print(f"\n{'─'*50}")
    print(f"Processing: {doc_name}")

    if await is_complete(doc_name):
        print("  [skip] already complete")
        return

    doc = fitz.open(str(pdf_path))
    n_pages = len(doc)
    doc.close()

    existing = await get_existing_pages(doc_name)
    pending = [pn for pn in range(1, n_pages + 1) if pn not in existing]

    if not pending:
        await mark_complete(doc_name, n_pages)
        print("  [skip] all pages exist, marking complete")
        return

    print(f"  {n_pages} total | {len(existing)} done | {len(pending)} pending")

    # Split pending pages into chunks, preserving order
    chunks = [pending[i:i + CHUNK_SIZE] for i in range(0, len(pending), CHUNK_SIZE)]
    print(f"  {len(chunks)} chunk(s) of up to {CHUNK_SIZE} pages")

    # Fire all chunks concurrently — each waits on chunk_sem individually
    await asyncio.gather(*[
        process_chunk(pdf_path, doc_name, chunk, chunk_sem)
        for chunk in chunks
    ])

    await mark_complete(doc_name, n_pages)
    elapsed = time.time() - t0
    print(f"  ✓ {doc_name} finished in {elapsed:.1f}s ({len(pending)/elapsed:.1f} p/s)")

# ── Pipeline Runner ──────────────────────────────────────────────────────
async def run_pipeline(input_dir: str, doc_workers: int):
    pdf_paths = sorted(Path(input_dir).glob("**/*.pdf"))

    if not pdf_paths:
        print(f"No PDFs found in {input_dir}")
        return

    print(f"Found {len(pdf_paths)} PDF(s)")
    print(f"DOC_CONCURRENCY={doc_workers}, CHUNK_CONCURRENCY={CHUNK_CONCURRENCY}, CHUNK_SIZE={CHUNK_SIZE}")

    chunk_sem = asyncio.Semaphore(CHUNK_CONCURRENCY)
    doc_sem   = asyncio.Semaphore(doc_workers)

    async def bounded(path):
        async with doc_sem:
            await process_document(path, chunk_sem)

    t0 = time.time()
    await asyncio.gather(*[bounded(p) for p in pdf_paths])
    elapsed = time.time() - t0

    print(f"\n{'═'*50}")
    print(f"All done in {elapsed:.1f}s")
    print(f"Results at: gs://{BUCKET_NAME}/{OUTPUT_FOLDER}/")

# ── Entry ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=LOCAL_INPUT_DIR)
    parser.add_argument("--workers", type=int, default=DOC_CONCURRENCY)
    args = parser.parse_args()

    asyncio.run(run_pipeline(args.input, args.workers))