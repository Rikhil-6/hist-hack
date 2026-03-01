import numpy as np
import re
import pandas as pd
from fastapi import APIRouter, Query, HTTPException, Request
from sentence_transformers import SentenceTransformer
from google.cloud import storage

router = APIRouter()
BUCKET_NAME = "hist-hack-bucket2"
model = SentenceTransformer('all-MiniLM-L6-v2')

@router.get("/search")
def search(request: Request, q: str = Query(..., min_length=1), mode: str = "thematic"):
    catalog_df = getattr(request.app.state, "catalog_df", None)
    embeddings = getattr(request.app.state, "embeddings", None)

    if catalog_df is None:
        raise HTTPException(status_code=503, detail="Archive index initializing...")

    try:
        bucket = storage.Client().bucket(BUCKET_NAME)
        raw_query = q.strip()

        # 1. Logic & Quote Parser
        # This Regex finds words OR "quoted phrases" while ignoring Boolean keywords for now
        tokens = re.findall(r'("(?:\\.|[^"])*"|\S+)', raw_query)
        
        # Check if we have explicit Boolean logic
        has_logic = any(t.upper() in ["AND", "OR", "NOT"] for t in tokens)

        if has_logic:
            # Convert user AND/OR to pandas logic operators (& / |)
            # We map the keywords specifically to avoid replacing parts of names
            logic_q = raw_query.replace(" AND ", " & ").replace(" OR ", " | ").replace(" NOT ", " ~ ")
            
            # Clean tokens to build the pandas query
            processed_query = logic_q
            for token in set(tokens):
                if token.upper() in ["AND", "OR", "NOT"]:
                    continue
                
                # Strip quotes for the internal search
                clean_t = token.replace('"', '').lower()
                condition = f"catalog_df['keywords'].str.contains('{clean_t}', case=False, na=False)"
                processed_query = processed_query.replace(token, condition)
            
            # Safely evaluate the boolean mask across the dataframe
            mask = eval(processed_query)
            results_df = catalog_df[mask].copy()
            results_df['score'] = 1.0 # Boolean matches are categorical
        
        elif mode == "exact":
            # Strict word-boundary search
            clean_q = raw_query.replace('"', '').lower()
            mask = catalog_df['keywords'].fillna('').str.lower().str.contains(f"\\b{clean_q}\\b", regex=True)
            results_df = catalog_df[mask].head(10).copy()
            results_df['score'] = 1.0
            
        else:
            # Pure ML Semantic Search
            if embeddings is None:
                raise HTTPException(status_code=500, detail="Neural vectors unavailable.")
            
            query_vec = model.encode([raw_query.replace('"', '')])
            scores = np.dot(embeddings, query_vec.T).flatten()
            top_idx = np.argsort(scores)[::-1][:15]
            results_df = catalog_df.iloc[top_idx].copy()
            results_df['score'] = scores[top_idx]

        # 2. Format Results
        formatted = []
        for _, row in results_df.iterrows():
            doc_name, page_id = str(row.get('document_dir', '')), str(row.get('page_id', ''))
            ocr_path = f"ocr_results/{doc_name}/{page_id}.txt"
            
            content = "Folio text pending retrieval..."
            try:
                blob = bucket.blob(ocr_path)
                if blob.exists(): content = blob.download_as_text()
            except: pass

            formatted.append({
                "folio_id": page_id,
                "collection_ref": doc_name,
                "extract": content,
                "match_strength": float(row.get('score', 0)),
                "cross_references": str(row.get('keywords', '')).split(',')
            })

        return {"status": "success", "results": formatted}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Logic Error: {str(e)}")