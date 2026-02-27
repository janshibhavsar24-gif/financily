import asyncio
from typing import Optional

import yfinance as yf
from fastapi import APIRouter
from pydantic import BaseModel

from backend.data.db import get_connection
from backend.data.universe import compute_and_store_quality

router = APIRouter()


class AssetInfo(BaseModel):
    ticker: str
    name: str
    latest_date: str
    rows: int
    quality_score: float
    asset_type: Optional[str]
    sector: Optional[str]


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
        # Single query: join prices with quality scores + universe metadata + name
        rows = conn.execute("""
            SELECT
                p.ticker,
                MAX(p.date)      AS latest_date,
                COUNT(*)         AS row_count,
                aq.quality_score,
                u.asset_type,
                u.sector,
                u.name           AS universe_name
            FROM prices p
            LEFT JOIN asset_quality aq ON p.ticker = aq.ticker
            LEFT JOIN asset_universe u  ON p.ticker = u.symbol
            GROUP BY p.ticker, aq.quality_score, u.asset_type, u.sector, u.name
            ORDER BY p.ticker ASC
        """).fetchall()

        # Compute quality score for any ticker that doesn't have one yet
        needs_quality = [(i, r[0]) for i, r in enumerate(rows) if r[3] is None]
        scores = {r[0]: r[3] for r in rows}
        for _, ticker in needs_quality:
            scores[ticker] = compute_and_store_quality(conn, ticker)
    finally:
        conn.close()

    # Resolve display names: use universe name when available, yfinance as fallback.
    # All yfinance calls run concurrently so the total wait is max(individual), not sum.
    needs_yf = [(i, r[0]) for i, r in enumerate(rows) if not r[6]]
    names: list[str] = [r[6] or r[0] for r in rows]

    if needs_yf:
        resolved = await asyncio.gather(
            *[
                asyncio.wait_for(asyncio.to_thread(_resolve_name, ticker), timeout=5.0)
                for _, ticker in needs_yf
            ],
            return_exceptions=True,
        )
        for (i, ticker), result in zip(needs_yf, resolved):
            names[i] = result if isinstance(result, str) else ticker

    return AssetsResponse(
        assets=[
            AssetInfo(
                ticker=r[0],
                name=names[i],
                latest_date=str(r[1]),
                rows=r[2],
                quality_score=scores.get(r[0]) or 0.0,
                asset_type=r[4],
                sector=r[5],
            )
            for i, r in enumerate(rows)
        ]
    )
