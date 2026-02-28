from __future__ import annotations

import json
from datetime import datetime, timedelta

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
    Caches results in DuckDB for 24 hours.
    Returns a flat dict with fields from _FIELDS. Never raises — missing fields are None.
    """
    upper = ticker.upper()

    # Check cache
    if conn is not None:
        row = conn.execute(
            "SELECT fundamentals, fetched_at FROM due_diligence_cache WHERE ticker = ?",
            [upper],
        ).fetchone()
        if row and row[0] and row[1]:
            age = datetime.utcnow() - row[1]
            if age < timedelta(hours=_CACHE_TTL_HOURS):
                try:
                    return json.loads(row[0])
                except Exception:
                    pass

    # Fetch from yfinance
    result: dict = {}
    try:
        info = yf.Ticker(upper).info
        for field in _FIELDS:
            result[field] = info.get(field)
    except Exception:
        result = {field: None for field in _FIELDS}

    # Store in cache
    if conn is not None:
        try:
            conn.execute(
                """
                INSERT OR REPLACE INTO due_diligence_cache (ticker, fundamentals, fetched_at)
                VALUES (?, ?, ?)
                """,
                [upper, json.dumps(result), datetime.utcnow()],
            )
        except Exception:
            pass

    return result
