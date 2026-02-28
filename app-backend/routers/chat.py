# routers/chat.py — RAG chat (placeholder)
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class ChatRequest(BaseModel):
    messages: list[dict]

@router.post("/")
def chat(req: ChatRequest):
    """
    TODO: implement RAG over CO273 corpus.
    POST /api/chat  body: { messages: [...] }
    """
    return {"reply": "RAG backend not yet implemented.", "status": "not_implemented"}