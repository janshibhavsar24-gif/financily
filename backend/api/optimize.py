# api/optimize.py — POST /api/optimize
#
# Full engine pipeline: forecast → covariance → feasibility → optimize → tax → persist.
# This is the primary endpoint — the core product feature.
#
# Request:  { tickers, target_return, horizon_years, max_weight, tax_rate_lt,
#             tax_rate_st, n_simulations }
# Response: { run_id, feasible, optimal_portfolio, risk_cost_table, forecasts }
#
# Error cases:
#   422 — len(tickers) < 2
#   422 — horizon_years not in {2, 3, 5}
#   422 — ticker not in DB → "No data for ticker X. Run sync first."
#   422 — < 60 days of history → "Need >= 60 trading days. Sync more data."
#   422 — infeasible → { "error": "infeasible", "max_achievable": float }
#   500 — optimizer fails to converge after all starts
#
# Pipeline (all CPU-bound work in asyncio.to_thread):
#   1. get_returns_matrix     → raises ValueError if data missing/insufficient
#   2. forecast_returns       → (mu, sigma, meta)
#   3. ledoit_wolf_covariance → Sigma
#   4. check_feasibility      → raise 422 if infeasible
#   5. optimize_portfolio     → optimal weights w*
#   6. compute_portfolio_metrics → full metric bundle
#   7. after_tax_return       → aftertax figure
#   8. compute_risk_cost_table → efficient frontier rows
#   9. INSERT into portfolio_runs
#  10. Return OptimizeResponse

# TODO: import asyncio, uuid
# TODO: from fastapi import APIRouter, HTTPException
# TODO: from pydantic import BaseModel, field_validator, model_config, ConfigDict
# TODO: from backend.data.db import get_connection
# TODO: from backend.engine.forecaster import forecast_returns
# TODO: from backend.engine.covariance import ledoit_wolf_covariance
# TODO: from backend.engine.risk import compute_portfolio_metrics
# TODO: from backend.engine.optimizer import (
#     check_feasibility, optimize_portfolio, compute_risk_cost_table
# )
# TODO: from backend.engine.tax import estimate_turnover, after_tax_return
# TODO: from backend.config import (
#     MAX_WEIGHT, DEFAULT_TAX_RATE_LT, DEFAULT_TAX_RATE_ST, N_SIMULATIONS
# )

# TODO: router = APIRouter()

# ---------------------------------------------------------------------------
# Request / Response models
# (field names must match frontend/src/types/api.ts exactly — snake_case)
# ---------------------------------------------------------------------------

# TODO: class OptimizeRequest(BaseModel):
#   tickers: list[str]           # min 2, normalised to uppercase
#   target_return: float         # e.g. 0.20
#   horizon_years: int           # must be in {2, 3, 5}
#   max_weight: float = MAX_WEIGHT
#   tax_rate_lt: float = DEFAULT_TAX_RATE_LT
#   tax_rate_st: float = DEFAULT_TAX_RATE_ST
#   n_simulations: int = N_SIMULATIONS
#   validators: len(tickers) >= 2, horizon_years in {2,3,5}

# TODO: class PortfolioMetrics(BaseModel):
#   model_config = ConfigDict(frozen=True)
#   weights: dict[str, float]
#   expected_return_pretax: float
#   expected_return_aftertax: float
#   volatility: float
#   sharpe_ratio: float
#   max_drawdown_median: float   # negative
#   max_drawdown_p95: float      # negative
#   var_95: float                # negative
#   cvar_95: float               # negative

# TODO: class RiskCostRow(BaseModel):
#   target_return: float
#   min_drawdown_p95: float
#   volatility: float
#   cvar_95: float

# TODO: class AssetForecast(BaseModel):
#   mu: float
#   sigma: float

# TODO: class OptimizeResponse(BaseModel):
#   run_id: str
#   feasible: bool
#   optimal_portfolio: PortfolioMetrics
#   risk_cost_table: list[RiskCostRow]
#   forecasts: dict[str, AssetForecast]

# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

# TODO: @router.post("/api/optimize", response_model=OptimizeResponse)
# TODO: async def optimize_endpoint(body: OptimizeRequest) -> OptimizeResponse:
#   """
#   Wrap the entire pipeline in asyncio.to_thread(_run_pipeline, body).
#   _run_pipeline is a synchronous function that runs all engine steps.
#   Catch ValueError → 422, RuntimeError → 500.
#   """

# TODO: def _run_pipeline(body: OptimizeRequest) -> OptimizeResponse:
#   """Synchronous pipeline — called inside asyncio.to_thread."""
#   # Steps 1–10 as listed in the module docstring above.
