import asyncio, os
from pathlib import Path
import fitz
from google import genai
from google.genai import types
from google.cloud import storage
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_ID    = "your-project-id"
BUCKET_NAME   = "your-bucket-name"
INPUT_FOLDER  = "pdfs/"
OUTPUT_FOLDER = "ocr_results/"
MODEL_ID      = "gemini-2.0-flash"
DPI           = 200    # 200 = fast + readable; bump to 300 for dense handwriting
CONCURRENCY   = 20     # paid tier; lower to 10 if you see 429s

# ── Clients ───────────────────────────────────────────────────────────────────
genai_client   = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
storage_client = storage.Client(project=PROJECT_ID)
bucket         = storage_client.bucket(BUCKET_NAME)

# ── Prompt ────────────────────────────────────────────────────────────────────
# Short but precise — anchors fidelity without over-constraining speed.
# Explicit annotation prefixes prevent the model improvising output format.
# Prohibiting inference/guessing reduces hallucination on hard passages.
OCR_PROMPT = """Transcribe all visible text from this historical colonial document page.

Rules:
- Preserve original spelling, capitalisation, and punctuation exactly
- Maintain paragraph and line structure as it appears on the page
- Do NOT correct, modernise, or interpret any text
- Do NOT guess at illegible words — mark them [ILLEGIBLE] instead
- Margin notes → prefix with [MARGIN: ...]
- Headers, stamps, page numbers → prefix with [HEADER: ...]
- Blank page or image only → output [BLANK PAGE]
- Output the raw transcription ONLY — no preamble, no commentary"""


# ── Retry: only on transient API errors ───────────────────────────────────────
def _is_retryable(exc) -> bool:
    msg = str(exc)
    return "429" in msg or "503" in msg or "500" in msg


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    retry=_is_retryable,
    reraise=True,
)
async def _call_gemini(img_bytes: bytes) -> str:
    """Call Gemini with retry on quota/server errors only."""
    response = await asyncio.to_thread(
        genai_client.models.generate_content,
        model=MODEL_ID,
        contents=[
            types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
            types.Part.from_text(text=OCR_PROMPT),
        ],
    )
    return response.text.strip()


# ── Page processor ────────────────────────────────────────────────────────────
async def process_page(
    img_bytes: bytes,
    doc_name: str,
    page_num: int,
    semaphore: asyncio.Semaphore,
):
    target = f"{OUTPUT_FOLDER}{doc_name}/{doc_name}_{page_num:04d}.txt"
    blob   = bucket.blob(target)

    # Skip already-processed pages — safe to re-run mid-batch
    if await asyncio.to_thread(blob.exists):
        print(f"[skip] {doc_name} p.{page_num:04d}")
        return

    async with semaphore:
        try:
            text = await _call_gemini(img_bytes)
            await asyncio.to_thread(blob.upload_from_string, text)
            print(f"[ok]   {doc_name} p.{page_num:04d}")
        except Exception as e:
            # Write error marker so we can identify failed pages without crashing
            err = f"[OCR ERROR page {page_num}: {e}]"
            await asyncio.to_thread(blob.upload_from_string, err)
            print(f"[err]  {doc_name} p.{page_num:04d} → {e}")


# ── Main pipeline ─────────────────────────────────────────────────────────────
async def run_pipeline():
    """
    Iterates all PDFs in INPUT_FOLDER, processes every page concurrently.
    Pages are rendered to memory — no local disk writes.
    At CONCURRENCY=20 and ~3s/page: 100 pages ≈ 15-20s per document.
    """
    blobs     = list(storage_client.list_blobs(BUCKET_NAME, prefix=INPUT_FOLDER))
    pdf_blobs = [b for b in blobs if b.name.lower().endswith(".pdf")]

    if not pdf_blobs:
        print(f"No PDFs found in gs://{BUCKET_NAME}/{INPUT_FOLDER}")
        return

    print(f"Found {len(pdf_blobs)} PDF(s) to process\n")
    semaphore = asyncio.Semaphore(CONCURRENCY)

    for blob in pdf_blobs:
        doc_name = Path(blob.name).stem
        print(f"{'─'*50}\nProcessing: {doc_name}")

        # Stream PDF from GCS into memory — no temp files
        pdf_bytes = await asyncio.to_thread(blob.download_as_bytes)
        doc       = fitz.open(stream=pdf_bytes, filetype="pdf")
        n_pages   = len(doc)
        print(f"  {n_pages} pages — launching {min(n_pages, CONCURRENCY)} concurrent workers")

        # Render all pages to PNG bytes up front, then close the doc
        pages = [(i + 1, doc[i].get_pixmap(dpi=DPI).tobytes("png")) for i in range(n_pages)]
        doc.close()

        # Fire all page tasks concurrently, semaphore limits active calls
        tasks = [process_page(img, doc_name, pn, semaphore) for pn, img in pages]
        await asyncio.gather(*tasks)

        print(f"  ✓ {doc_name} complete\n")

    print("All documents processed.")


if __name__ == "__main__":
    asyncio.run(run_pipeline())