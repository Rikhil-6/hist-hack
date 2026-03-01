import io, json, os, shutil, tempfile, uuid, sys
import pandas as pd
import numpy as np
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google.cloud import storage
from contextlib import asynccontextmanager

# Local project imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from ocr import run_ocr_pipeline
from routers import index 

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

BUCKET_NAME = "hist-hack-bucket2"
INDEX_PATH = "indexes/vector_index.parquet"

@asynccontextmanager
async def lifespan(app: FastAPI):
    global catalog_df
    try:
        print("📜 Accessing Neural Digital Repository...")
        client = storage.Client()
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(INDEX_PATH)
        
        buffer = io.BytesIO()
        blob.download_to_file(buffer)
        buffer.seek(0)
        
        df = pd.read_parquet(buffer)
        app.state.catalog_df = df
        
        # JIT Embedding Generation if the column is missing
        if 'embeddings' not in df.columns:
            print("⚠️ 'embeddings' column missing. Generating Neural Vectors (this may take a moment)...")
            from sentence_transformers import SentenceTransformer
            # We use the model already being used in the project
            model = SentenceTransformer('all-MiniLM-L6-v2')
            # Vectorize the keywords
            vectors = model.encode(df['keywords'].fillna('').tolist(), show_progress_bar=True)
            app.state.embeddings = np.array(vectors).astype('float32')
            print("✅ Vectors generated and cached in memory.")
        else:
            app.state.embeddings = np.array(df['embeddings'].tolist()).astype('float32')
            print(f"✅ Neural Index Loaded: {len(df)} folios ready.")
            
    except Exception as e:
        print(f"❌ Startup Error: {e}")
        app.state.catalog_df = None
        app.state.embeddings = None
    yield

app = FastAPI(title="Kratoska OCR API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["http://localhost:5173", "http://localhost:3000"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# Shared Job Storage
JOBS: dict[str, dict] = {}
JOBS_DIR = Path(tempfile.gettempdir()) / "kratoska_jobs"
JOBS_DIR.mkdir(exist_ok=True)

# Mount the ML Index Router
app.include_router(index.router, prefix="/api/index")

@app.get("/")
def health():
    return {"status": "ok", "service": "Kratoska Neural OCR API"}

# (Existing OCR endpoints for upload, status, and delete remain unchanged)