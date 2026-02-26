import asyncio
import json
import uuid
from datetime import datetime

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, field_validator

from backend.config import (
    DEFAULT_TAX_RATE_LT, DEFAULT_TAX_RATE_ST, MAX_WEIGHT, N_SIMULATIONS
)
from backend.data.db import get_connection
from backend.data.fetcher import fetch_risk_free_rate
from backend.data.universe import get_quality
from backend.engine.covariance import ledoit_wolf_covariance
from backend.engine.forecaster import forecast_returns, get_returns_matrix
from backend.engine.optimizer import (
    check_feasibility, compute_risk_cost_table, find_best_feasible_target, optimize_portfolio
)
from backend.engine.risk import compute_portfolio_metrics
from backend.engine.tax import after_tax_return, estimate_turnover

router = APIRouter()


class OptimizeRequest(BaseModel):
    tickers: list[str]
    target_return: float
    horizon_years: int
    max_weight: float = MAX_WEIGHT
    tax_rate_lt: float = DEFAULT_TAX_RATE_LT
    tax_rate_st: float = DEFAULT_TAX_RATE_ST
    n_simulations: int = N_SIMULATIONS

    @field_validator("tickers")
    @classmethod
    def at_least_two_tickers(cls, v: list[str]) -> list[str]:
        if len(v) < 2:
            raise ValueError("At least 2 tickers required")
        return [t.upper() for t in v]

    @field_validator("horizon_years")
    @classmethod
    def valid_horizon(cls, v: int) -> int:
        if v not in {2, 3, 5}:
            raise ValueError("horizon_years must be 2, 3, or 5")
        return v


class PortfolioMetrics(BaseModel):
    model_config = ConfigDict(frozen=True)
    weights: dict[str, float]
    expected_return_pretax: float
    expected_return_aftertax: float
    volatility: float
    sharpe_ratio: float
    max_drawdown_median: float
    max_drawdown_p95: float
    var_95: float
    cvar_95: float


class RiskCostRow(BaseModel):
    target_return: float
    min_drawdown_p95: float
    volatility: float
    cvar_95: float


class AssetForecast(BaseModel):
    mu: float
    sigma: float


class OptimizeResponse(BaseModel):
    run_id: str
    feasible: bool
    optimal_portfolio: PortfolioMetrics
    risk_cost_table: list[RiskCostRow]
    forecasts: dict[str, AssetForecast]
    warnings: list[str]


def _run_pipeline(body: OptimizeRequest) -> OptimizeResponse:
    conn = get_connection()
    try:
        # Step 1–2: forecasts
        mu, sigma, meta = forecast_returns(conn, body.tickers)

        # Step 3: covariance
        returns_wide = get_returns_matrix(conn, body.tickers)
        # Only use the requested tickers for covariance (not MARKET_TICKER extras)
        tickers_in_returns = [t for t in body.tickers if t in returns_wide.columns]
        cov = ledoit_wolf_covariance(returns_wide[tickers_in_returns])
        n_complete_rows = len(returns_wide)

        # Collect data-quality warnings (non-blocking)
        quality_warnings: list[str] = []
        for ticker in body.tickers:
            score = get_quality(conn, ticker)
            if score is not None and score < 0.5:
                quality_warnings.append(
                    f"{ticker} has limited data history (quality score: {score:.2f}) "
                    "— forecasts may be unreliable. Consider running /api/sync."
                )

        # Step 4: feasibility check (mu is excess return)
        feasible, max_achievable = check_feasibility(mu, body.target_return, body.max_weight)
        if not feasible:
            raise ValueError(json.dumps({
                "error": "infeasible",
                "max_achievable": round(max_achievable, 4),
            }))

        # Step 5: optimize
        try:
            weights_arr = optimize_portfolio(
                mu, cov,
                target_return=body.target_return,
                horizon_years=body.horizon_years,
                max_weight=body.max_weight,
                n_simulations=body.n_simulations,
            )
        except RuntimeError:
            recommended = find_best_feasible_target(
                mu, cov,
                horizon_years=body.horizon_years,
                max_weight=body.max_weight,
            )
            if recommended is not None:
                rf = fetch_risk_free_rate()
                raise ValueError(json.dumps({
                    "error": "convergence_failed",
                    "requested_target": round(body.target_return, 4),
                    "recommended_target": round(recommended, 4),
                    "recommended_target_gross": round(recommended + rf, 4),
                }))
            sparse_hint = (
                f" Only {n_complete_rows} complete trading days found across all tickers "
                f"(need 252+ for reliable estimates); one or more assets may have limited history."
            ) if n_complete_rows < 252 else ""
            raise ValueError(
                f"Optimization failed to converge even at low return targets.{sparse_hint} "
                "Try removing thinly-traded assets, running /api/sync, or raising max_weight."
            )

        # Step 6: portfolio metrics
        rf = fetch_risk_free_rate()
        metrics_dict = compute_portfolio_metrics(
            weights_arr, mu, cov,
            horizon_years=body.horizon_years,
            risk_free_rate=rf,
            n_simulations=body.n_simulations,
        )

        # Step 7: after-tax return
        n = len(body.tickers)
        w_prev = np.full(n, 1.0 / n)
        turnover = estimate_turnover(w_prev, weights_arr)
        aftertax = after_tax_return(
            metrics_dict["expected_return_pretax"],
            turnover,
            body.tax_rate_lt,
            body.tax_rate_st,
        )

        weights_dict = {t: float(w) for t, w in zip(tickers_in_returns, weights_arr)}
        portfolio = PortfolioMetrics(
            weights=weights_dict,
            expected_return_pretax=metrics_dict["expected_return_pretax"],
            expected_return_aftertax=aftertax,
            volatility=metrics_dict["volatility"],
            sharpe_ratio=metrics_dict["sharpe_ratio"],
            max_drawdown_median=metrics_dict["max_drawdown_median"],
            max_drawdown_p95=metrics_dict["max_drawdown_p95"],
            var_95=metrics_dict["var_95"],
            cvar_95=metrics_dict["cvar_95"],
        )

        # Step 8: risk cost table
        table_rows = compute_risk_cost_table(
            mu, cov, rf,
            horizon_years=body.horizon_years,
            max_weight=body.max_weight,
        )

        # Step 9: persist
        run_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO portfolio_runs "
            "(run_id, run_at, tickers, target_return, horizon_years, tax_rate_st, tax_rate_lt, result) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                run_id,
                datetime.utcnow(),
                json.dumps(body.tickers),
                body.target_return,
                body.horizon_years,
                body.tax_rate_st,
                body.tax_rate_lt,
                portfolio.model_dump_json(),
            ],
        )

        return OptimizeResponse(
            run_id=run_id,
            feasible=True,
            optimal_portfolio=portfolio,
            risk_cost_table=[RiskCostRow(**r) for r in table_rows],
            forecasts={t: AssetForecast(**v) for t, v in meta.items()},
            warnings=quality_warnings,
        )
    finally:
        conn.close()


@router.post("/api/optimize", response_model=OptimizeResponse)
async def optimize_endpoint(body: OptimizeRequest) -> OptimizeResponse:
    try:
        return await asyncio.to_thread(_run_pipeline, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
