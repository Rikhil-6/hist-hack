import asyncio, os, io
from pathlib import Path
import fitz  # PyMuPDF
from google import genai
from google.genai import types
from google.cloud import storage
from tenacity import retry, stop_after_attempt, wait_exponential

# --- CONFIGURATION ---
PROJECT_ID = "your-project-id"
BUCKET_NAME = "your-bucket-name"
INPUT_FOLDER = "pdfs/"      # Folder inside bucket
OUTPUT_FOLDER = "ocr_results/"  # Folder for .txt files
MODEL_ID = "gemini-2.0-flash"   # Fast, cheap, high-rate limits
CONCURRENCY = 10                # Number of pages to process at once

# Clients
genai_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
storage_client = storage.Client(project=PROJECT_ID)
bucket = storage_client.bucket(BUCKET_NAME)

OCR_PROMPT = """Transcribe this page as best as can be done while maintaining coherence. 
Output raw text ONLY."""

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=4, max=60))
async def process_page(img_bytes, doc_name, page_num, semaphore):
    """Processes a single page and saves it to GCS."""
    target_blob_name = f"{OUTPUT_FOLDER}{doc_name}/{doc_name}_{page_num:04d}.txt"
    blob = bucket.blob(target_blob_name)

    # 1. Skip if already exists (Robustness)
    if await asyncio.to_thread(blob.exists):
        return

    async with semaphore:
        # 2. Call Gemini
        response = await asyncio.to_thread(
            genai_client.models.generate_content,
            model=MODEL_ID,
            contents=[
                types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
                types.Part.from_text(text=OCR_PROMPT),
            ]
        )
        
        # 3. Save directly to Cloud Storage
        await asyncio.to_thread(blob.upload_from_string, response.text.strip())
        print(f"DONE: {doc_name} - Page {page_num}")

async def run_pipeline():
    """Main loop to iterate through all PDFs in the bucket."""
    blobs = storage_client.list_blobs(BUCKET_NAME, prefix=INPUT_FOLDER)
    semaphore = asyncio.Semaphore(CONCURRENCY)

    for blob in blobs:
        if not blob.name.lower().endswith(".pdf"):
            continue

        doc_name = Path(blob.name).stem
        print(f"Starting Document: {doc_name}")

        # Stream PDF from Cloud to Memory
        pdf_data = blob.download_as_bytes()
        doc = fitz.open(stream=pdf_data, filetype="pdf")
        
        tasks = []
        for i in range(len(doc)):
            # Convert page to image bytes in memory
            pix = doc[i].get_pixmap(dpi=200)
            img_bytes = pix.tobytes("png")
            tasks.append(process_page(img_bytes, doc_name, i + 1, semaphore))
        
        await asyncio.gather(*tasks)
        doc.close()

if __name__ == "__main__":
    asyncio.run(run_pipeline())