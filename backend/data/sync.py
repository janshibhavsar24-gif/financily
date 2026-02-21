# sync.py — incremental data sync: fetch → upsert into DuckDB.
#
# Rules:
#   - Sync is always user-triggered (POST /api/sync). Never automatic.
#   - Incremental: for each ticker, only fetch from last stored date forward.
#   - Upsert semantics: INSERT OR REPLACE — no duplicate (ticker, date) rows.
#   - Log returns are computed here during upsert, not on demand in the engine.
#   - sync_tickers() is the only public function — everything else is internal.
#   - CPU-bound (yfinance download) must be called inside asyncio.to_thread
#     by the api/sync.py caller, not here.

# TODO: import duckdb
# TODO: import pandas as pd
# TODO: import numpy as np
# TODO: from datetime import date, timedelta
# TODO: from backend.data.db import get_connection
# TODO: from backend.data.fetcher import fetch_prices, fetch_risk_free_rate
# TODO: from backend.config import LOOKBACK_YEARS, RISK_FREE_SERIES

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

# TODO: async def sync_tickers(
#     tickers: list[str],
#     lookback_years: int = LOOKBACK_YEARS,
# ) -> dict:
#   """
#   For each ticker:
#     1. get_last_sync_date(conn, ticker)
#     2. start = today - lookback_years  if None  else  last_date + 1 day
#     3. fetch_prices(ticker, start, today)
#     4. upsert_prices(conn, df)
#   Also sync RISK_FREE_SERIES from FRED via fetch_risk_free_rate().
#
#   Returns:
#     { "tickers_synced": int, "rows_upserted": int, "latest_date": str }
#   """

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

# TODO: def get_last_sync_date(
#     conn: duckdb.DuckDBPyConnection,
#     ticker: str,
# ) -> date | None:
#   """
#   SELECT MAX(date) FROM prices WHERE ticker = ?
#   Returns None if no rows exist for this ticker.
#   """

# TODO: def upsert_prices(
#     conn: duckdb.DuckDBPyConnection,
#     df: pd.DataFrame,       # columns: ticker, date, close, adj_close, volume
# ) -> int:
#   """
#   INSERT OR REPLACE into prices for each row in df.
#   After inserting, compute log returns and upsert into daily_returns:
#     ret = ln(adj_close_t / adj_close_{t-1})
#   First row per ticker has no prior price — skip it (no return for day 0).
#   Returns total rows inserted into prices.
#   """
