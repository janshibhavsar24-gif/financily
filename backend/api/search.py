from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.data.db import get_connection
from backend.data.universe import search_universe

router = APIRouter()


class SearchResult(BaseModel):
    symbol: str
    name: str
    asset_type: Optional[str]
    sector: Optional[str]
    country: Optional[str]
    exchange: Optional[str]
    is_synced: bool
    quality_score: Optional[float]


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int


@router.get("/api/search", response_model=SearchResponse)
def search_assets(
    q: str = Query(..., min_length=1, description="Ticker prefix or name substring"),
    type: Optional[str] = Query(default=None, description="equity | etf | fund | index"),
    sector: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> SearchResponse:
    conn = get_connection()
    try:
        rows = search_universe(conn, q, asset_type=type, sector=sector, country=country, limit=limit)
    finally:
        conn.close()

    results = [SearchResult(**r) for r in rows]
    return SearchResponse(results=results, total=len(results))
