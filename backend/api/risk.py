import asyncio

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from backend.api.optimize import PortfolioMetrics
from backend.data.db import get_connection
from backend.data.fetcher import fetch_risk_free_rate
from backend.engine.covariance import ledoit_wolf_covariance
from backend.engine.forecaster import forecast_returns, get_returns_matrix
from backend.engine.risk import compute_portfolio_metrics

router = APIRouter()


def _run_risk(
    tickers: list[str],
    weights: list[float],
    horizon_years: int,
) -> PortfolioMetrics:
    conn = get_connection()
    try:
        mu, _sigma, _meta = forecast_returns(conn, tickers)
        returns_wide = get_returns_matrix(conn, tickers)
        tickers_in_returns = [t for t in tickers if t in returns_wide.columns]
        cov = ledoit_wolf_covariance(returns_wide[tickers_in_returns])
        rf = fetch_risk_free_rate()
        w = np.array(weights)
        metrics = compute_portfolio_metrics(w, mu, cov, horizon_years, rf)
        from backend.data.fetcher import fetch_risk_free_rate as _rf
        from backend.engine.tax import after_tax_return, estimate_turnover
        n = len(tickers)
        turnover = estimate_turnover(np.full(n, 1.0 / n), w)
        aftertax = after_tax_return(metrics["expected_return_pretax"], turnover)
        return PortfolioMetrics(
            weights={t: float(ww) for t, ww in zip(tickers_in_returns, w)},
            expected_return_pretax=metrics["expected_return_pretax"],
            expected_return_aftertax=aftertax,
            volatility=metrics["volatility"],
            sharpe_ratio=metrics["sharpe_ratio"],
            max_drawdown_median=metrics["max_drawdown_median"],
            max_drawdown_p95=metrics["max_drawdown_p95"],
            var_95=metrics["var_95"],
            cvar_95=metrics["cvar_95"],
        )
    finally:
        conn.close()


@router.get("/api/risk", response_model=PortfolioMetrics)
async def risk_endpoint(
    tickers: str = Query(..., description="Comma-separated tickers e.g. SPY,QQQ"),
    weights: str = Query(..., description="Comma-separated weights e.g. 0.6,0.4"),
    horizon_years: int = Query(3),
) -> PortfolioMetrics:
    ticker_list = [t.strip().upper() for t in tickers.split(",")]
    try:
        weight_list = [float(w.strip()) for w in weights.split(",")]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="weights must be numeric") from exc

    if len(ticker_list) != len(weight_list):
        raise HTTPException(
            status_code=422,
            detail=f"tickers ({len(ticker_list)}) and weights ({len(weight_list)}) must have the same length",
        )
    if abs(sum(weight_list) - 1.0) > 1e-4:
        raise HTTPException(
            status_code=422,
            detail=f"weights must sum to 1.0, got {sum(weight_list):.4f}",
        )

    try:
        return await asyncio.to_thread(_run_risk, ticker_list, weight_list, horizon_years)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
