import asyncio

import yfinance as yf
from fastapi import APIRouter
from pydantic import BaseModel

from backend.data.db import get_connection
from backend.data.universe import compute_and_store_quality, get_asset_metadata, get_quality

router = APIRouter()


class AssetInfo(BaseModel):
    ticker: str
    name: str
    latest_date: str
    rows: int
    quality_score: float
    asset_type: str | None
    sector: str | None


class AssetsResponse(BaseModel):
    assets: list[AssetInfo]


def _resolve_name(ticker: str) -> str:
    try:
        info = yf.Ticker(ticker).info
        return info.get("longName") or info.get("shortName") or ticker
    except Exception:
        return ticker


@router.get("/api/assets", response_model=AssetsResponse)
async def list_assets() -> AssetsResponse:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT ticker, MAX(date) AS latest_date, COUNT(*) AS rows "
            "FROM prices GROUP BY ticker ORDER BY ticker ASC"
        ).fetchall()
        # Compute/refresh quality scores and fetch metadata for each ticker
        enriched: list[tuple] = []
        for ticker, latest_date, row_count in rows:
            score = get_quality(conn, ticker)
            if score is None:
                score = compute_and_store_quality(conn, ticker)
            meta = get_asset_metadata(conn, ticker)
            enriched.append((ticker, latest_date, row_count, score, meta))
    finally:
        conn.close()

    assets = []
    for ticker, latest_date, row_count, score, meta in enriched:
        try:
            name = await asyncio.wait_for(
                asyncio.to_thread(_resolve_name, ticker), timeout=5.0
            )
        except Exception:
            name = ticker
        assets.append(AssetInfo(
            ticker=ticker,
            name=name,
            latest_date=str(latest_date),
            rows=row_count,
            quality_score=score,
            asset_type=meta["asset_type"] if meta else None,
            sector=meta["sector"] if meta else None,
        ))

    return AssetsResponse(assets=assets)
