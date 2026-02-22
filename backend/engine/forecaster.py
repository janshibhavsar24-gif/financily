from __future__ import annotations
import numpy as np
import pandas as pd
import duckdb
from arch import arch_model

from backend.config import GARCH_WINDOW_YEARS, SHRINKAGE_LAMBDA, MARKET_TICKER
from backend.data.fetcher import fetch_risk_free_rate


def get_returns_matrix(
    conn: duckdb.DuckDBPyConnection,
    tickers: list[str],
    window_years: int = GARCH_WINDOW_YEARS,
) -> pd.DataFrame:
    """
    Query daily_returns for each ticker over the trailing window_years.
    Always includes MARKET_TICKER. Pivot to wide format: index=date, columns=ticker.
    Raises ValueError if fewer than 60 complete rows remain.
    """
    all_tickers = list(dict.fromkeys(tickers + [MARKET_TICKER]))
    placeholders = ", ".join(["?" for _ in all_tickers])
    rows = conn.execute(
        f"""
        SELECT ticker, date, ret
        FROM daily_returns
        WHERE ticker IN ({placeholders})
          AND date >= (CURRENT_DATE - INTERVAL '{window_years} years')
        ORDER BY date
        """,
        all_tickers,
    ).fetchdf()

    if rows.empty:
        raise ValueError(
            f"No data for tickers {tickers}. Run /api/sync first."
        )

    wide = rows.pivot(index="date", columns="ticker", values="ret")
    wide.index = pd.to_datetime(wide.index)
    wide = wide.dropna()

    if len(wide) < 60:
        raise ValueError(
            f"Need >= 60 trading days of complete data, got {len(wide)}. Sync more data."
        )
    return wide


def compute_historical_mean(returns: pd.Series) -> float:
    """Annualised mean log return: returns.mean() * 252."""
    return float(returns.mean() * 252)


def fit_garch_volatility(returns: pd.Series) -> float:
    """
    Fit GARCH(1,1) on returns * 100. Extract 1-step-ahead conditional vol.
    Annualise: forecast_vol / 100 * sqrt(252).
    Falls back to sample std on any failure.
    """
    try:
        pct = returns * 100
        if pct.std() == 0:
            raise ValueError("Degenerate series — zero variance")
        model = arch_model(pct, vol="Garch", p=1, q=1, rescale=False)
        res = model.fit(disp="off", show_warning=False)
        forecast = res.forecast(horizon=1)
        var_1step = float(forecast.variance.values[-1, 0])
        vol_pct = np.sqrt(max(var_1step, 0))
        return float(vol_pct / 100.0 * np.sqrt(252))
    except Exception:
        return float(returns.std() * np.sqrt(252))


def james_stein_shrinkage(
    mu_hist: np.ndarray,
    mu_market: float,
    lam: float = SHRINKAGE_LAMBDA,
) -> np.ndarray:
    """mu_shrunk = (1 - lam) * mu_hist + lam * mu_market"""
    return (1.0 - lam) * mu_hist + lam * mu_market


def forecast_returns(
    conn: duckdb.DuckDBPyConnection,
    tickers: list[str],
) -> tuple[np.ndarray, np.ndarray, dict]:
    """
    Full forecasting pipeline for the given tickers.
    Returns:
      mu    : annualised excess returns, shape (n,)
      sigma : annualised GARCH vol, shape (n,)
      meta  : dict[ticker, {"mu": float, "sigma": float}]
    """
    wide = get_returns_matrix(conn, tickers)
    all_tickers = list(wide.columns)

    mu_hist = np.array([compute_historical_mean(wide[t]) for t in all_tickers])
    sigma = np.array([fit_garch_volatility(wide[t]) for t in all_tickers])

    market_idx = all_tickers.index(MARKET_TICKER)
    mu_market = float(mu_hist[market_idx])

    mu_shrunk = james_stein_shrinkage(mu_hist, mu_market)
    rf = fetch_risk_free_rate()
    mu_excess = mu_shrunk - rf

    # Build output for requested tickers only
    ticker_indices = [all_tickers.index(t) for t in tickers]
    mu_out = mu_excess[ticker_indices]
    sigma_out = sigma[ticker_indices]
    meta = {
        t: {"mu": float(mu_excess[i]), "sigma": float(sigma[i])}
        for t, i in zip(tickers, ticker_indices)
    }
    return mu_out, sigma_out, meta
