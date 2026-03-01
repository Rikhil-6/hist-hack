import io
import pandas as pd
from fastapi import APIRouter, Query, HTTPException
from google.cloud import storage

router = APIRouter()

BUCKET_NAME = "hist-hack-bucket2"
BLOB_PATH = "indexes/vector_index.parquet"

@router.get("/search")
def search(q: str = Query(..., min_length=1), mode: str = "fuzzy"):
    try:
        client = storage.Client()
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(BLOB_PATH)

        # 1. Download Parquet to memory
        buffer = io.BytesIO()
        blob.download_to_file(buffer)
        buffer.seek(0)
        df = pd.read_parquet(buffer)
        
        query = q.lower().strip()

        # 2. Search Logic (Handling the comma-separated string format)
        if mode == "exact":
            # Split string by comma and check for exact match
            mask = df['keywords'].fillna('').apply(
                lambda x: query in [k.strip().lower() for k in str(x).split(',')]
            )
        else:
            # Simple substring match in the keyword string
            mask = df['keywords'].fillna('').str.lower().str.contains(query, na=False)

        results_df = df[mask].head(50)

        # 3. Mapping to your Frontend format based on your specific columns
        formatted = []
        for _, row in results_df.iterrows():
            # Use 'blob_name' or 'document_dir' for the file reference
            # Using document_dir as it seems to hold the descriptive title
            display_name = str(row.get('document_dir', 'Unknown Document'))
            
            # Extract a "page" number from page_id if possible, or use as is
            page_val = row.get('page_id', '0')

            formatted.append({
                "keyword": q,
                "page": page_val,
                "co273File": display_name,
                "description": f"GCS Path: {row.get('blob_name', 'N/A')}",
                "confidence": 0.95, # Placeholder since vector dist isn't calculated here
                "relatedKeywords": str(row.get('keywords', '')).split(',')
            })

        return {
            "status": "success", 
            "count": len(formatted),
            "results": formatted
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search Error: {str(e)}")