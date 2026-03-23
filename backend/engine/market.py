from __future__ import annotations

import math
from typing import Optional

import duckdb
import numpy as np
import yfinance as yf


def compute_market_regime(conn: duckdb.DuckDBPyConnection) -> dict:
    """
    Compute SPY-based market regime using 200-day SMA and 30-day realized vol.
    Regime: Bull (SPY > SMA-200 AND 30d vol < 20%),
            High-Vol (vol >= 25%),
            Bear (SPY <= SMA-200),
            Neutral otherwise.
    """
    rows = conn.execute("""
        SELECT p.adj_close, dr.ret
        FROM prices p
        LEFT JOIN daily_returns dr ON dr.ticker = p.ticker AND dr.date = p.date
        WHERE p.ticker = 'SPY'
        ORDER BY p.date DESC
        LIMIT 252
    """).fetchall()

    if not rows:
        return {
            "regime": "Unknown",
            "regime_description": "No SPY data available",
            "spy_price": None,
            "spy_sma_200": None,
            "realized_vol_30d": None,
        }

    spy_price = rows[0][0]

    prices_200 = [r[0] for r in rows if r[0] is not None]
    sma_200: Optional[float] = None
    if prices_200:
        sma_200 = sum(prices_200) / len(prices_200)

    rets_30 = [r[1] for r in rows[:30] if r[1] is not None]
    realized_vol_30d: Optional[float] = None
    if rets_30:
        realized_vol_30d = float(np.std(rets_30) * math.sqrt(252))

    if sma_200 is None or spy_price is None or realized_vol_30d is None:
        regime = "Unknown"
        regime_description = "Insufficient data"
    elif realized_vol_30d >= 0.25:
        regime = "High-Vol"
        regime_description = "Elevated volatility — expect large daily swings"
    elif spy_price > sma_200 and realized_vol_30d < 0.20:
        regime = "Bull"
        regime_description = "Price above 200-day SMA with low volatility"
    elif spy_price <= sma_200:
        regime = "Bear"
        regime_description = "Price below 200-day SMA — trend is down"
    else:
        regime = "Neutral"
        regime_description = "Mixed signals — monitor closely"

    return {
        "regime": regime,
        "regime_description": regime_description,
        "spy_price": round(float(spy_price), 2) if spy_price is not None else None,
        "spy_sma_200": round(float(sma_200), 2) if sma_200 is not None else None,
        "realized_vol_30d": round(float(realized_vol_30d), 4) if realized_vol_30d is not None else None,
    }


def fetch_yield_curve(conn: duckdb.DuckDBPyConnection) -> dict:
    """
    Get 10Y and 3M treasury rates.
    First tries macro_series (DGS10, DGS3MO), falls back to yfinance ^TNX / ^IRX.
    Spread = DGS10 - DGS3MO.
    Status: Normal (>0.5%), Flat (±0.5%), Inverted (<-0.5%).
    """
    rate_10y: Optional[float] = None
    rate_3m: Optional[float] = None

    rows = conn.execute("""
        SELECT series_id, value
        FROM (
            SELECT series_id, value,
                   ROW_NUMBER() OVER (PARTITION BY series_id ORDER BY date DESC) AS rn
            FROM macro_series
            WHERE series_id IN ('DGS10', 'DGS3MO')
        ) sub
        WHERE rn = 1
    """).fetchall()

    for series_id, value in rows:
        if series_id == 'DGS10' and value is not None:
            rate_10y = float(value) / 100.0
        elif series_id == 'DGS3MO' and value is not None:
            rate_3m = float(value) / 100.0

    if rate_10y is None:
        try:
            tnx = yf.Ticker("^TNX")
            hist = tnx.history(period="5d")
            if not hist.empty:
                rate_10y = float(hist["Close"].iloc[-1]) / 100.0
        except Exception:
            pass

    if rate_3m is None:
        try:
            irx = yf.Ticker("^IRX")
            hist = irx.history(period="5d")
            if not hist.empty:
                rate_3m = float(hist["Close"].iloc[-1]) / 100.0
        except Exception:
            pass

    yield_spread: Optional[float] = None
    yield_status = "Unknown"
    if rate_10y is not None and rate_3m is not None:
        yield_spread = rate_10y - rate_3m
        if yield_spread > 0.005:
            yield_status = "Normal"
        elif yield_spread < -0.005:
            yield_status = "Inverted"
        else:
            yield_status = "Flat"

    return {
        "rate_10y": round(rate_10y, 4) if rate_10y is not None else None,
        "rate_3m": round(rate_3m, 4) if rate_3m is not None else None,
        "yield_spread": round(yield_spread, 4) if yield_spread is not None else None,
        "yield_status": yield_status,
    }
