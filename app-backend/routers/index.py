import io
import pandas as pd
from fastapi import APIRouter, Query, HTTPException
from google.cloud import storage

router = APIRouter()

BUCKET_NAME = "hist-hack-bucket2"
INDEX_PATH = "indexes/vector_index.parquet"

@router.get("/search")
def search(q: str = Query(..., min_length=1), mode: str = "fuzzy"):
    try:
        client = storage.Client()
        bucket = client.bucket(BUCKET_NAME)
        
        # 1. Load the Index from GCS
        index_blob = bucket.blob(INDEX_PATH)
        buffer = io.BytesIO()
        index_blob.download_to_file(buffer)
        buffer.seek(0)
        df = pd.read_parquet(buffer)
        
        query = q.lower().strip()

        # 2. Search Logic (Comma-separated keywords)
        if mode == "exact":
            mask = df['keywords'].fillna('').apply(
                lambda x: query in [k.strip().lower() for k in str(x).split(',')]
            )
        else:
            mask = df['keywords'].fillna('').str.lower().str.contains(query, na=False)

        results_df = df[mask].head(10) # Limit for mobile testing performance

        formatted = []
        for _, row in results_df.iterrows():
            # Extract variables from row
            doc_name = str(row.get('document_dir', ''))
            page_id = str(row.get('page_id', ''))
            
            # 3. Construct the nested path: ocr_results/doc_name/page_id.txt
            # Based on your update: the text file is inside a folder of the same name
            ocr_text_path = f"ocr_results/{doc_name}/{page_id}.txt"
            
            # 4. Fetch the actual text content
            ocr_content = "Text content not found."
            try:
                text_blob = bucket.blob(ocr_text_path)
                if text_blob.exists():
                    ocr_content = text_blob.download_as_text()
                else:
                    # Fallback check: sometimes page_id doesn't include the doc prefix
                    # e.g. ocr_results/DocA/DocA_001.txt vs ocr_results/DocA/001.txt
                    ocr_content = f"File not found at: {ocr_text_path}"
            except Exception as e:
                ocr_content = f"Error retrieving content: {str(e)}"

            formatted.append({
                "keyword": q,
                "page": page_id,
                "co273File": doc_name,
                "description": ocr_content, # The actual text content from the nested file
                "confidence": 0.95,
                "relatedKeywords": str(row.get('keywords', '')).split(','),
                "gcsPath": ocr_text_path
            })

        return {
            "status": "success", 
            "count": len(formatted),
            "results": formatted
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search Error: {str(e)}")