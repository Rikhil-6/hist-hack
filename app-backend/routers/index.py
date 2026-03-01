import numpy as np
from fastapi import APIRouter, Query, HTTPException, Request
from sentence_transformers import SentenceTransformer
from google.cloud import storage

router = APIRouter()
BUCKET_NAME = "hist-hack-bucket2"

# Load the ML model once into memory for the query encoding
model = SentenceTransformer('all-MiniLM-L6-v2')

@router.get("/search")
def search(request: Request, q: str = Query(..., min_length=1), mode: str = "thematic"):
    catalog_df = getattr(request.app.state, "catalog_df", None)
    embeddings = getattr(request.app.state, "embeddings", None)

    if catalog_df is None:
        raise HTTPException(status_code=503, detail="The card catalog is still being indexed.")

    try:
        bucket = storage.Client().bucket(BUCKET_NAME)
        query = q.strip()

        # 1. Exact Word Search (Citable Terminology)
        if mode == "exact":
            # Strict regex boundary check to avoid partial matches
            mask = catalog_df['keywords'].fillna('').str.lower().str.contains(f"\\b{query.lower()}\\b", regex=True)
            results_df = catalog_df[mask].head(10).copy()
            results_df['score'] = 1.0
        
        # 2. Neural Thematic Search (ML-based)
        else:
            if embeddings is None:
                raise HTTPException(status_code=500, detail="Neural vectors unavailable. Check server logs.")
            
            # Encode user query into the same vector space
            query_vec = model.encode([query])
            
            # Fast Cosine Similarity via Matrix Multiplication (Dot Product)
            # This is the high-speed math you've been using with NumPy
            scores = np.dot(embeddings, query_vec.T).flatten()
            
            # Get top 15 matches by sorting the scores
            top_idx = np.argsort(scores)[::-1][:15]
            results_df = catalog_df.iloc[top_idx].copy()
            results_df['score'] = scores[top_idx]

        formatted = []
        for _, row in results_df.iterrows():
            doc_name, page_id = str(row.get('document_dir', '')), str(row.get('page_id', ''))
            ocr_path = f"ocr_results/{doc_name}/{page_id}.txt"
            
            content = "Folio text pending retrieval..."
            try:
                blob = bucket.blob(ocr_path)
                if blob.exists(): 
                    content = blob.download_as_text()
            except: 
                pass

            formatted.append({
                "folio_id": page_id,
                "collection_ref": doc_name,
                "extract": content,
                "match_strength": float(row['score']), # Neural similarity score
                "cross_references": str(row.get('keywords', '')).split(',')
            })

        return {"status": "success", "results": formatted}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Neural Search Error: {str(e)}")