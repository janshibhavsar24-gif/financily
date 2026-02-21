# api/risk.py — GET /api/risk
#
# Computes risk metrics for a user-supplied arbitrary portfolio without
# running the optimiser. Useful for inspecting a custom weight vector.
#
# Query params: tickers (comma-separated), weights (comma-separated floats),
#               horizon_years (int, default 3)
# Response: PortfolioMetrics (same shape as optimal_portfolio in /api/optimize)
#
# Validation:
#   - len(tickers) == len(weights) — else 422
#   - sum(weights) ≈ 1.0 ± 1e-4   — else 422
#   - all tickers present in DB    — else 422

# TODO: import asyncio
# TODO: from fastapi import APIRouter, HTTPException, Query
# TODO: from backend.data.db import get_connection
# TODO: from backend.engine.forecaster import get_returns_matrix, forecast_returns
# TODO: from backend.engine.covariance import ledoit_wolf_covariance
# TODO: from backend.engine.risk import compute_portfolio_metrics
# TODO: from backend.api.optimize import PortfolioMetrics
# TODO: import numpy as np

# TODO: router = APIRouter()

# TODO: @router.get("/api/risk", response_model=PortfolioMetrics)
# TODO: async def risk_endpoint(
#   tickers: str = Query(..., description="Comma-separated tickers e.g. SPY,QQQ"),
#   weights: str = Query(..., description="Comma-separated weights e.g. 0.6,0.4"),
#   horizon_years: int = Query(3),
# ) -> PortfolioMetrics:
#   """
#   Parse tickers and weights from query strings.
#   Validate lengths match and weights sum to 1.
#   Run forecast_returns + ledoit_wolf_covariance + compute_portfolio_metrics.
#   All in asyncio.to_thread — same rules as /api/optimize.
#   """
