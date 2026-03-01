import json, os, shutil, tempfile, uuid
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ocr import run_ocr_pipeline
from routers import index 

app = FastAPI(title="Kratoska OCR API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://localhost:3000" # FOR DEV TEST
    ], allow_methods=["*"], allow_headers=["*"])

JOBS: dict[str, dict] = {}
JOBS_DIR = Path(tempfile.gettempdir()) / "kratoska_jobs"
JOBS_DIR.mkdir(exist_ok=True)

app.include_router(index.router, prefix="/api/index")

@app.get("/")
def health():
    return {"status": "ok", "service": "Kratoska OCR API"}


@app.post("/api/ocr/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files accepted.")

    job_id   = str(uuid.uuid4())[:8]
    job_dir  = JOBS_DIR / job_id
    job_dir.mkdir()
    pdf_path = job_dir / file.filename

    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    JOBS[job_id] = {"dir": str(job_dir), "pages": {}}

    async def stream():
        async for result in run_ocr_pipeline(str(pdf_path), job_id):
            JOBS[job_id]["pages"][result["page"]] = result["text"]
            yield f"data: {json.dumps(result)}\n\n"
        total = len(JOBS[job_id]["pages"])
        yield f"data: {json.dumps({'status': 'done', 'job_id': job_id, 'total': total})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"X-Job-ID": job_id, "Cache-Control": "no-cache"})


@app.get("/api/ocr/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Job not found.")
    return {"job_id": job_id, "total_pages": len(JOBS[job_id]["pages"]), "texts": JOBS[job_id]["pages"]}


@app.delete("/api/ocr/jobs/{job_id}")
def delete_job(job_id: str):
    if job_id in JOBS:
        shutil.rmtree(JOBS[job_id]["dir"], ignore_errors=True)
        del JOBS[job_id]
    return {"deleted": job_id}