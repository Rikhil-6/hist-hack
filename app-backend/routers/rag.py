from fastapi import APIRouter, HTTPException, Body
from google.cloud import storage
import google.generativeai as genai
import os
from typing import List, Dict

router = APIRouter(prefix="/api/rag", tags=["historian"])

# Initialize GCS and Gemini
client = storage.Client()
BUCKET_NAME = "hist-hack-bucket2"
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

@router.post("/chat")
async def chat_historian(payload: Dict = Body(...)):
    user_query = payload.get("query")
    if not user_query:
        raise HTTPException(status_code=400, detail="Query is required")

    # 1. RETRIEVAL: Find files in 'ocr_results'
    # Uses the structure: ocr_results/doc_name/doc_name_page_X.txt
    bucket = client.bucket(BUCKET_NAME)
    blobs = list(bucket.list_blobs(prefix="ocr_results/", max_results=50))
    
    context_chunks = []
    citations = []

    # Simple keyword-based filtering for the demo
    keywords = user_query.lower().split()
    for blob in blobs:
        if any(k in blob.name.lower() for k in keywords) and blob.name.endswith(".txt"):
            text = blob.download_as_text()
            
            # Parse structure: ocr_results/doc_name/page_file.txt
            parts = blob.name.split('/')
            doc_name = parts[1]
            page_num = parts[2].split('_')[-1].replace(".txt", "")
            
            context_chunks.append(f"SOURCE: {doc_name} | PAGE: {page_num}\n{text}")
            citations.append({
                "doc": doc_name, 
                "page": page_num, 
                "url": f"https://storage.cloud.google.com/{BUCKET_NAME}/{blob.name}"
            })
            if len(context_chunks) >= 5: break 

    if not context_chunks:
        return {"reply": "No matching archival evidence found.", "citations": []}

    # 2. PROMPT: Force the "Historian" persona and page-wise citations
    prompt = f"""
    You are the Semantic Historian. Use the provided archival snippets to answer the user.
    RULES:
    - Answer ONLY using the provided text.
    - If the answer isn't there, say "The current corpus does not specify this."
    - Cite every claim using [Source Name, Page X].
    
    CONTEXT:
    {chr(10).join(context_chunks)}

    QUESTION: {user_query}
    """
    
    response = model.generate_content(prompt)
    return {"reply": response.text, "citations": citations}