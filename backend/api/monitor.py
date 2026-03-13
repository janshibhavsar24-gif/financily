from __future__ import annotations

import asyncio
import math
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Query
from pydantic import BaseModel, field_validator

from backend.data.db import get_connection

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class WatchlistResponse(BaseModel):
    tickers: list[str]


class WatchlistRequest(BaseModel):
    tickers: list[str]

    @field_validator("tickers")
    @classmethod
    def validate_tickers(cls, v: list[str]) -> list[str]:
        if len(v) > 30:
            raise ValueError("Watchlist cannot exceed 30 tickers")
        return [t.upper().strip() for t in v]


class SparkBar(BaseModel):
    date: str
    ret: float


class StockMonitor(BaseModel):
    ticker: str
    latest_date: Optional[str]
    price: Optional[float]
    day_pct: Optional[float]
    week_pct: Optional[float]
    month_pct: Optional[float]
    three_month_pct: Optional[float]
    ann_volatility: Optional[float]
    drawdown_from_high: Optional[float]
    spark: list[SparkBar]


class CorrelationMatrix(BaseModel):
    tickers: list[str]
    values: list[list[float]]


class MonitorResponse(BaseModel):
    stocks: list[StockMonitor]
    correlation: Optional[CorrelationMatrix]


# ---------------------------------------------------------------------------
# DB helpers — all run inside asyncio.to_thread
# ---------------------------------------------------------------------------

def _get_watchlist() -> list[str]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT ticker FROM watchlist ORDER BY added_at ASC"
        ).fetchall()
        return [r[0] for r in rows]
    finally:
        conn.close()


def _save_watchlist(tickers: list[str]) -> list[str]:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM watchlist")
        if tickers:
            conn.executemany(
                "INSERT INTO watchlist (ticker) VALUES (?)",
                [(t,) for t in tickers],
            )
        rows = conn.execute(
            "SELECT ticker FROM watchlist ORDER BY added_at ASC"
        ).fetchall()
        return [r[0] for r in rows]
    finally:
        conn.close()


def _safe(v: float | None) -> Optional[float]:
    """Return None for NaN/Inf, otherwise round to 6 decimal places."""
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
    return round(v, 6)


def _fetch_monitor_data(tickers: list[str]) -> MonitorResponse:
    conn = get_connection()
    try:
        ph = ", ".join("?" * len(tickers))

        # ----------------------------------------------------------------
        # Bulk metrics query
        # ----------------------------------------------------------------
        metrics_rows = conn.execute(
            f"""
            WITH ranked AS (
                SELECT ticker, date, adj_close,
                       ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY date DESC) AS rn
                FROM prices
                WHERE ticker IN ({ph})
            ),
            today AS (
                SELECT ticker, adj_close AS price, date
                FROM ranked WHERE rn = 1
            ),
            yest AS (
                SELECT ticker, adj_close AS prev
                FROM ranked WHERE rn = 2
            ),
            high52w AS (
                SELECT p.ticker, MAX(p.adj_close) AS high
                FROM prices p
                JOIN today t ON p.ticker = t.ticker
                WHERE p.ticker IN ({ph})
                  AND p.date >= t.date - INTERVAL '365 days'
                GROUP BY p.ticker
            ),
            ret_stats AS (
                SELECT dr.ticker,
                    EXP(SUM(dr.ret) FILTER (WHERE dr.date >= mx.latest - INTERVAL '7 days'))  - 1
                        AS week_pct,
                    EXP(SUM(dr.ret) FILTER (WHERE dr.date >= mx.latest - INTERVAL '30 days')) - 1
                        AS month_pct,
                    EXP(SUM(dr.ret) FILTER (WHERE dr.date >= mx.latest - INTERVAL '91 days')) - 1
                        AS three_month_pct,
                    STDDEV(dr.ret) FILTER (WHERE dr.date >= mx.latest - INTERVAL '365 days')
                        * SQRT(252) AS ann_vol
                FROM daily_returns dr
                JOIN (
                    SELECT ticker, MAX(date) AS latest
                    FROM daily_returns
                    WHERE ticker IN ({ph})
                    GROUP BY ticker
                ) mx ON dr.ticker = mx.ticker
                WHERE dr.ticker IN ({ph})
                GROUP BY dr.ticker
            )
            SELECT
                t.ticker,
                CAST(t.date AS VARCHAR) AS latest_date,
                t.price,
                y.prev,
                rs.week_pct,
                rs.month_pct,
                rs.three_month_pct,
                rs.ann_vol,
                h.high
            FROM today t
            LEFT JOIN yest y       ON t.ticker = y.ticker
            LEFT JOIN ret_stats rs ON t.ticker = rs.ticker
            LEFT JOIN high52w h    ON t.ticker = h.ticker
            """,
            tickers + tickers + tickers + tickers,
        ).fetchall()

        # Build a dict for fast lookup; missing tickers will get no-data StockMonitor
        metrics_by_ticker: dict[str, tuple] = {r[0]: r for r in metrics_rows}

        # ----------------------------------------------------------------
        # Sparkline query — last 30 rows per ticker
        # ----------------------------------------------------------------
        spark_rows = conn.execute(
            f"""
            SELECT ticker, CAST(date AS VARCHAR) AS date, ret
            FROM (
                SELECT ticker, date, ret,
                       ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY date DESC) AS rn
                FROM daily_returns
                WHERE ticker IN ({ph})
            ) sub
            WHERE rn <= 30
            ORDER BY ticker, date ASC
            """,
            tickers,
        ).fetchall()

        sparks: dict[str, list[SparkBar]] = {t: [] for t in tickers}
        for t, d, r in spark_rows:
            sparks[t].append(SparkBar(date=d, ret=r))

        # ----------------------------------------------------------------
        # Correlation matrix — last 252 trading days, pandas .corr()
        # ----------------------------------------------------------------
        corr_rows = conn.execute(
            f"""
            SELECT ticker, date, ret
            FROM (
                SELECT ticker, date, ret,
                       ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY date DESC) AS rn
                FROM daily_returns
                WHERE ticker IN ({ph})
            ) sub
            WHERE rn <= 252
            ORDER BY date ASC
            """,
            tickers,
        ).fetchdf()

        correlation: Optional[CorrelationMatrix] = None
        tickers_with_data = [t for t in tickers if t in metrics_by_ticker]
        if len(tickers_with_data) >= 2 and not corr_rows.empty:
            pivot = corr_rows.pivot(index="date", columns="ticker", values="ret")
            # Keep only columns that have data
            pivot = pivot.dropna(axis=1, how="all")
            pivot = pivot.dropna(axis=0, how="any")
            valid_tickers = list(pivot.columns)
            if len(valid_tickers) >= 2:
                corr_matrix = pivot.corr()
                values: list[list[float]] = []
                for t_a in valid_tickers:
                    row_vals: list[float] = []
                    for t_b in valid_tickers:
                        v = corr_matrix.loc[t_a, t_b]
                        row_vals.append(round(float(v), 4) if not math.isnan(v) else 0.0)
                    values.append(row_vals)
                correlation = CorrelationMatrix(tickers=valid_tickers, values=values)

        # ----------------------------------------------------------------
        # Assemble response
        # ----------------------------------------------------------------
        stocks: list[StockMonitor] = []
        for ticker in tickers:
            if ticker not in metrics_by_ticker:
                stocks.append(StockMonitor(
                    ticker=ticker,
                    latest_date=None,
                    price=None,
                    day_pct=None,
                    week_pct=None,
                    month_pct=None,
                    three_month_pct=None,
                    ann_volatility=None,
                    drawdown_from_high=None,
                    spark=sparks.get(ticker, []),
                ))
                continue

            r = metrics_by_ticker[ticker]
            (_, latest_date, price, prev,
             week_pct, month_pct, three_month_pct, ann_vol, high52) = r

            day_pct: Optional[float] = None
            if price is not None and prev is not None and prev != 0:
                day_pct = _safe((price - prev) / prev)

            drawdown: Optional[float] = None
            if price is not None and high52 is not None and high52 != 0:
                drawdown = _safe((price / high52) - 1.0)

            stocks.append(StockMonitor(
                ticker=ticker,
                latest_date=latest_date,
                price=_safe(price),
                day_pct=day_pct,
                week_pct=_safe(week_pct),
                month_pct=_safe(month_pct),
                three_month_pct=_safe(three_month_pct),
                ann_volatility=_safe(ann_vol),
                drawdown_from_high=drawdown,
                spark=sparks.get(ticker, []),
            ))

        return MonitorResponse(stocks=stocks, correlation=correlation)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/api/watchlist", response_model=WatchlistResponse)
async def get_watchlist() -> WatchlistResponse:
    tickers = await asyncio.to_thread(_get_watchlist)
    return WatchlistResponse(tickers=tickers)


@router.post("/api/watchlist", response_model=WatchlistResponse)
async def save_watchlist(req: WatchlistRequest) -> WatchlistResponse:
    tickers = await asyncio.to_thread(_save_watchlist, req.tickers)
    return WatchlistResponse(tickers=tickers)


@router.get("/api/monitor", response_model=MonitorResponse)
async def get_monitor_data(
    tickers: str = Query(..., description="Comma-separated list of tickers"),
) -> MonitorResponse:
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        return MonitorResponse(stocks=[], correlation=None)
    return await asyncio.to_thread(_fetch_monitor_data, ticker_list)
