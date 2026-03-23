from __future__ import annotations

from collections import defaultdict
from typing import Optional

import duckdb
import numpy as np

from backend.config import N_SIMULATIONS, RANDOM_SEED


def compute_rolling_ratios(
    conn: duckdb.DuckDBPyConnection,
    tickers: list[str],
    weights: list[float],
    windows: list[int] | None = None,
) -> dict:
    """
    Compute rolling risk-adjusted ratios for the portfolio and per-ticker.
    Metrics: Sortino, Calmar, Info Ratio (portfolio only).
    Windows: [30, 90, 180, 365] trading days.
    """
    if windows is None:
        windows = [30, 90, 180, 365]

    all_fetch_tickers = list(dict.fromkeys(tickers + ["SPY"]))
    ph = ", ".join("?" * len(all_fetch_tickers))

    rows = conn.execute(
        f"""
        SELECT ticker, date, ret
        FROM (
            SELECT ticker, date, ret,
                   ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY date DESC) AS rn
            FROM daily_returns
            WHERE ticker IN ({ph})
        ) sub
        WHERE rn <= 365
        ORDER BY date ASC
        """,
        all_fetch_tickers,
    ).fetchall()

    if not rows:
        empty_window: dict = {str(w): {"sortino": None, "calmar": None, "info_ratio": None} for w in windows}
        return {"windows": windows, "portfolio": empty_window, "tickers": {}}

    ticker_dates: dict[str, dict] = defaultdict(dict)
    for ticker, dt, ret in rows:
        ticker_dates[ticker][dt] = float(ret)

    # Common dates across all requested tickers
    ticker_date_sets = [set(ticker_dates[t].keys()) for t in tickers if t in ticker_dates]
    if not ticker_date_sets:
        return {"windows": windows, "portfolio": {}, "tickers": {}}

    common_dates = sorted(ticker_date_sets[0].intersection(*ticker_date_sets[1:]))
    weights_arr = np.array(weights)

    portfolio_metrics: dict[str, dict] = {}
    ticker_metrics: dict[str, dict] = {t: {} for t in tickers}

    for window in windows:
        w_key = str(window)
        if window > len(common_dates):
            portfolio_metrics[w_key] = {"sortino": None, "calmar": None, "info_ratio": None}
            for t in tickers:
                ticker_metrics[t][w_key] = {"sortino": None, "calmar": None}
            continue

        window_dates = common_dates[-window:]

        # Portfolio daily returns (weighted sum); tickers without data contribute 0
        port_rets = np.array([
            sum(
                weights_arr[i] * ticker_dates.get(tickers[i], {}).get(dt, 0.0)
                for i in range(len(tickers))
            )
            for dt in window_dates
        ])

        ann_port_ret = float(np.mean(port_rets) * 252)

        neg_rets = port_rets[port_rets < 0]
        downside_dev: Optional[float] = (
            float(np.std(neg_rets) * np.sqrt(252)) if len(neg_rets) > 0 else None
        )

        cumret = np.cumprod(1.0 + port_rets)
        peak = np.maximum.accumulate(cumret)
        drawdowns = (peak - cumret) / peak
        max_dd: Optional[float] = float(np.max(drawdowns)) if len(drawdowns) > 0 else None

        spy_rets = np.array([ticker_dates.get("SPY", {}).get(dt, 0.0) for dt in window_dates])
        ann_spy_ret = float(np.mean(spy_rets) * 252)
        excess_rets = port_rets - spy_rets
        tracking_error: Optional[float] = (
            float(np.std(excess_rets) * np.sqrt(252)) if len(excess_rets) > 1 else None
        )

        sortino = (ann_port_ret / downside_dev) if downside_dev and downside_dev > 0 else None
        calmar = (ann_port_ret / max_dd) if max_dd and max_dd > 0 else None
        info_ratio = (
            (ann_port_ret - ann_spy_ret) / tracking_error
            if tracking_error and tracking_error > 0
            else None
        )

        portfolio_metrics[w_key] = {
            "sortino": round(sortino, 3) if sortino is not None else None,
            "calmar": round(calmar, 3) if calmar is not None else None,
            "info_ratio": round(info_ratio, 3) if info_ratio is not None else None,
        }

        for t in tickers:
            if t not in ticker_dates:
                ticker_metrics[t][w_key] = {"sortino": None, "calmar": None}
                continue
            t_rets = np.array([ticker_dates[t].get(dt, 0.0) for dt in window_dates])
            t_ann_ret = float(np.mean(t_rets) * 252)
            t_neg = t_rets[t_rets < 0]
            t_dd_std: Optional[float] = (
                float(np.std(t_neg) * np.sqrt(252)) if len(t_neg) > 0 else None
            )
            t_cumret = np.cumprod(1.0 + t_rets)
            t_peak = np.maximum.accumulate(t_cumret)
            t_drawdowns = (t_peak - t_cumret) / t_peak
            t_max_dd: Optional[float] = float(np.max(t_drawdowns)) if len(t_drawdowns) > 0 else None
            t_sortino = (t_ann_ret / t_dd_std) if t_dd_std and t_dd_std > 0 else None
            t_calmar = (t_ann_ret / t_max_dd) if t_max_dd and t_max_dd > 0 else None
            ticker_metrics[t][w_key] = {
                "sortino": round(t_sortino, 3) if t_sortino is not None else None,
                "calmar": round(t_calmar, 3) if t_calmar is not None else None,
            }

    return {
        "windows": windows,
        "portfolio": portfolio_metrics,
        "tickers": ticker_metrics,
    }


def compute_cvar_decomposition(
    conn: duckdb.DuckDBPyConnection,
    tickers: list[str],
    weights_list: list[float],
) -> dict:
    """
    Decompose portfolio CVaR into per-asset contributions via Monte Carlo.
    Uses existing GARCH + Ledoit-Wolf pipeline.
    Contribution_i = weight_i * mean(asset_return_i | portfolio in 5th percentile tail).
    """
    from backend.engine.forecaster import forecast_returns, get_returns_matrix
    from backend.engine.covariance import ledoit_wolf_covariance

    weights = np.array(weights_list)

    mu, _sigma, _meta = forecast_returns(conn, tickers)

    wide = get_returns_matrix(conn, tickers)
    tickers_in_wide = [t for t in tickers if t in wide.columns]
    wide_tickers = wide[tickers_in_wide]
    cov = ledoit_wolf_covariance(wide_tickers)

    rng = np.random.default_rng(RANDOM_SEED)
    n_sim = min(N_SIMULATIONS, 10_000)

    # shape: (n_sim, n_assets)
    asset_returns = rng.multivariate_normal(mu, cov, size=n_sim)
    port_returns = asset_returns @ weights

    var_5pct = float(np.percentile(port_returns, 5))
    tail_mask = port_returns <= var_5pct
    portfolio_cvar = float(np.mean(port_returns[tail_mask]))

    items = []
    for i, ticker in enumerate(tickers):
        tail_asset_ret = asset_returns[tail_mask, i]
        contribution = float(weights[i] * np.mean(tail_asset_ret))
        items.append({
            "ticker": ticker,
            "weight": round(float(weights[i]) * 100, 2),
            "cvar_contribution_pct": round(contribution * 100, 2),
            "cvar_contribution_sign": "negative" if contribution < 0 else "positive",
        })

    items.sort(key=lambda x: abs(x["cvar_contribution_pct"]), reverse=True)

    return {
        "portfolio_cvar_95": round(portfolio_cvar * 100, 2),
        "items": items,
    }
