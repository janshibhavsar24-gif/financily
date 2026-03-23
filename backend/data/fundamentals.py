from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import duckdb
import yfinance as yf


_FIELDS = [
    # Identity
    "longName", "sector", "industry", "country", "fullTimeEmployees",
    # Valuation
    "trailingPE", "forwardPE", "pegRatio", "priceToBook", "enterpriseToEbitda",
    # Profitability
    "grossMargins", "operatingMargins", "profitMargins", "returnOnEquity", "returnOnAssets",
    # Growth
    "revenueGrowth", "earningsGrowth", "revenueQuarterlyGrowth",
    # Financial strength
    "totalDebt", "totalCash", "debtToEquity", "currentRatio", "quickRatio",
    # Cash flow
    "freeCashflow", "operatingCashflow",
    # Market
    "marketCap", "beta", "dividendYield", "trailingEps", "forwardEps",
    # Dates
    "nextFiscalYearEnd", "mostRecentQuarter", "nextEarningsDate",
    # Recommendations
    "recommendationMean", "recommendationKey", "numberOfAnalystOpinions",
]

_CACHE_TTL_HOURS = 24


def fetch_fundamentals(ticker: str, conn: duckdb.DuckDBPyConnection | None = None) -> dict:
    """
    Pull key fundamentals from yfinance Ticker.info.
    Caches results in DuckDB for 24h to avoid repeated yfinance calls.
    Never raises — missing fields are None.
    """
    if conn is not None:
        row = conn.execute(
            "SELECT fundamentals, fetched_at FROM due_diligence_cache WHERE ticker = ?",
            [ticker.upper()],
        ).fetchone()
        if row is not None:
            fundamentals_json, fetched_at = row
            cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=_CACHE_TTL_HOURS)
            if fetched_at is not None:
                fetched_dt = fetched_at if fetched_at.tzinfo else fetched_at.replace(tzinfo=timezone.utc)
                if fetched_dt > cutoff:
                    try:
                        return json.loads(fundamentals_json)
                    except Exception:
                        pass

    result: dict = {"ticker": ticker.upper()}
    try:
        info = yf.Ticker(ticker).info
        for field in _FIELDS:
            result[field] = info.get(field)
    except Exception:
        pass

    if conn is not None:
        try:
            conn.execute(
                """
                INSERT INTO due_diligence_cache (ticker, fundamentals, fetched_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (ticker) DO UPDATE SET
                    fundamentals = excluded.fundamentals,
                    fetched_at   = excluded.fetched_at
                """,
                [ticker.upper(), json.dumps(result)],
            )
        except Exception:
            pass

    return result
