from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, field_validator

from backend.data.db import get_connection
from backend.engine.analytics_monitor import compute_rolling_ratios, compute_cvar_decomposition

router = APIRouter()


# ---------------------------------------------------------------------------
# Rolling ratios endpoint
# ---------------------------------------------------------------------------

class RollingWindowMetrics(BaseModel):
    sortino: Optional[float]
    calmar: Optional[float]
    info_ratio: Optional[float]


class TickerWindowMetrics(BaseModel):
    sortino: Optional[float]
    calmar: Optional[float]


class RollingRatiosResponse(BaseModel):
    windows: list[int]
    portfolio: dict[str, RollingWindowMetrics]
    tickers: dict[str, dict[str, TickerWindowMetrics]]


def _get_rolling_ratios(tickers: list[str], weights: list[float]) -> RollingRatiosResponse:
    windows = [30, 90, 180, 365]
    conn = get_connection()
    try:
        data = compute_rolling_ratios(conn, tickers, weights, windows)
    finally:
        conn.close()

    portfolio_metrics = {
        k: RollingWindowMetrics(**v) for k, v in data["portfolio"].items()
    }
    ticker_metrics = {
        t: {k: TickerWindowMetrics(**v) for k, v in window_map.items()}
        for t, window_map in data["tickers"].items()
    }
    return RollingRatiosResponse(
        windows=windows,
        portfolio=portfolio_metrics,
        tickers=ticker_metrics,
    )


@router.get("/api/analytics/ratios", response_model=RollingRatiosResponse)
async def get_rolling_ratios(
    tickers: str,
    weights: str,
) -> RollingRatiosResponse:
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    try:
        weights_list = [float(w) for w in weights.split(",") if w.strip()]
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="weights must be comma-separated floats")
    return await asyncio.to_thread(_get_rolling_ratios, ticker_list, weights_list)


# ---------------------------------------------------------------------------
# CVaR decomposition endpoint
# ---------------------------------------------------------------------------

class CVaRRequest(BaseModel):
    tickers: list[str]
    weights: list[float]

    @field_validator("tickers")
    @classmethod
    def validate_tickers(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("tickers cannot be empty")
        return [t.upper().strip() for t in v]


class CVaRItem(BaseModel):
    ticker: str
    weight: float
    cvar_contribution_pct: float
    cvar_contribution_sign: str


class CVaRDecompositionResponse(BaseModel):
    portfolio_cvar_95: float
    items: list[CVaRItem]


def _get_cvar_decomposition(tickers: list[str], weights: list[float]) -> CVaRDecompositionResponse:
    conn = get_connection()
    try:
        data = compute_cvar_decomposition(conn, tickers, weights)
    finally:
        conn.close()
    return CVaRDecompositionResponse(
        portfolio_cvar_95=data["portfolio_cvar_95"],
        items=[CVaRItem(**item) for item in data["items"]],
    )


@router.post("/api/analytics/cvar-decomposition", response_model=CVaRDecompositionResponse)
async def get_cvar_decomposition(req: CVaRRequest) -> CVaRDecompositionResponse:
    return await asyncio.to_thread(_get_cvar_decomposition, req.tickers, req.weights)
