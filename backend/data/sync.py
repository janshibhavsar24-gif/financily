from __future__ import annotations
import asyncio
from datetime import date, timedelta

import duckdb
import numpy as np
import pandas as pd

from backend.config import LOOKBACK_YEARS
from backend.data.db import get_connection
from backend.data.fetcher import fetch_prices


def get_last_sync_date(conn: duckdb.DuckDBPyConnection, ticker: str) -> date | None:
    """Return the most recent price date for a ticker, or None if no data exists."""
    row = conn.execute(
        "SELECT MAX(date) FROM prices WHERE ticker = ?", [ticker]
    ).fetchone()
    if row and row[0] is not None:
        return row[0]
    return None


def upsert_prices(conn: duckdb.DuckDBPyConnection, df: pd.DataFrame) -> int:
    """
    Insert-or-replace price rows and recompute log returns.
    Returns the number of price rows upserted.
    """
    if df.empty:
        return 0

    total = 0
    for ticker, group in df.groupby("ticker"):
        group = group.sort_values("date").reset_index(drop=True)

        for _, row in group.iterrows():
            conn.execute(
                "INSERT OR REPLACE INTO prices (ticker, date, close, adj_close, volume) "
                "VALUES (?, ?, ?, ?, ?)",
                [ticker, row["date"], float(row["close"]), float(row["adj_close"]),
                 int(row["volume"]) if pd.notna(row.get("volume")) else None],
            )
        total += len(group)

        # Compute log returns
        adj = group["adj_close"].values.astype(float)
        dates = group["date"].values
        for i in range(1, len(adj)):
            if adj[i - 1] > 0 and adj[i] > 0:
                ret = float(np.log(adj[i] / adj[i - 1]))
                conn.execute(
                    "INSERT OR REPLACE INTO daily_returns (ticker, date, ret) VALUES (?, ?, ?)",
                    [ticker, dates[i], ret],
                )

    return total


async def sync_tickers(
    tickers: list[str],
    lookback_years: int = LOOKBACK_YEARS,
) -> dict:
    """
    Incrementally sync price data for each ticker.
    Returns: { tickers_synced, rows_upserted, latest_date }
    """
    tickers = [t.upper() for t in tickers]
    conn = get_connection()

    end_date = date.today()
    total_rows = 0
    latest_date = ""

    try:
        for ticker in tickers:
            last = get_last_sync_date(conn, ticker)
            if last is not None:
                start_date = last + timedelta(days=1)
            else:
                start_date = date(
                    end_date.year - lookback_years,
                    end_date.month,
                    end_date.day,
                )

            if start_date >= end_date:
                continue

            df = await asyncio.to_thread(fetch_prices, [ticker], start_date, end_date)
            if df.empty:
                continue

            rows = upsert_prices(conn, df)
            total_rows += rows

            max_date = str(df["date"].max())
            if max_date > latest_date:
                latest_date = max_date
    finally:
        conn.close()

    return {
        "tickers_synced": len(tickers),
        "rows_upserted": total_rows,
        "latest_date": latest_date or str(end_date),
    }
