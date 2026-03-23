from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, field_validator

from backend.data.db import get_connection
from backend.engine.stress import run_stress_tests

router = APIRouter()


class StressRequest(BaseModel):
    tickers: list[str]
    weights: list[float]

    @field_validator("tickers")
    @classmethod
    def validate_tickers(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("tickers cannot be empty")
        return [t.upper().strip() for t in v]

    @field_validator("weights")
    @classmethod
    def validate_weights(cls, v: list[float]) -> list[float]:
        if not v:
            raise ValueError("weights cannot be empty")
        return v


class StressScenario(BaseModel):
    name: str
    start: str
    end: str
    portfolio_loss_pct: float
    worst_ticker: Optional[str]
    worst_loss_pct: Optional[float]
    coverage_pct: float
    tickers_count: int


class StressTestResponse(BaseModel):
    scenarios: list[StressScenario]


def _run_stress(tickers: list[str], weights: list[float]) -> StressTestResponse:
    conn = get_connection()
    try:
        scenarios = run_stress_tests(conn, tickers, weights)
    finally:
        conn.close()
    return StressTestResponse(scenarios=[StressScenario(**s) for s in scenarios])


@router.post("/api/stress", response_model=StressTestResponse)
async def run_stress_test(req: StressRequest) -> StressTestResponse:
    return await asyncio.to_thread(_run_stress, req.tickers, req.weights)
