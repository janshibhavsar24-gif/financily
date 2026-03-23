from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from backend.data.db import get_connection
from backend.engine.market import compute_market_regime, fetch_yield_curve

router = APIRouter()


class MarketRegimeResponse(BaseModel):
    regime: str
    regime_description: str
    spy_price: Optional[float]
    spy_sma_200: Optional[float]
    realized_vol_30d: Optional[float]
    rate_10y: Optional[float]
    rate_3m: Optional[float]
    yield_spread: Optional[float]
    yield_status: str


def _compute_regime() -> MarketRegimeResponse:
    conn = get_connection()
    try:
        regime_data = compute_market_regime(conn)
        yield_data = fetch_yield_curve(conn)
    finally:
        conn.close()

    return MarketRegimeResponse(
        regime=regime_data["regime"],
        regime_description=regime_data["regime_description"],
        spy_price=regime_data["spy_price"],
        spy_sma_200=regime_data["spy_sma_200"],
        realized_vol_30d=regime_data["realized_vol_30d"],
        rate_10y=yield_data["rate_10y"],
        rate_3m=yield_data["rate_3m"],
        yield_spread=yield_data["yield_spread"],
        yield_status=yield_data["yield_status"],
    )


@router.get("/api/market-regime", response_model=MarketRegimeResponse)
async def get_market_regime() -> MarketRegimeResponse:
    return await asyncio.to_thread(_compute_regime)
