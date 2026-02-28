# routers/index.py — Keyword index search (placeholder)
from fastapi import APIRouter

router = APIRouter()

@router.get("/search")
def search(q: str = ""):
    """
    TODO: implement keyword search against Kratoska index.
    GET /api/index/search?q=opium
    """
    return {"query": q, "results": [], "status": "not_implemented"}