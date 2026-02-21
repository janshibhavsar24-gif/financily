# fetcher.py — all external data fetching (Yahoo Finance + FRED).
#
# Rules:
#   - This is the ONLY file in the project that calls yfinance or fredapi.
#   - All functions are synchronous (yfinance is not async).
#     Callers in api/ must wrap with asyncio.to_thread.
#   - On network failure: raise ConnectionError with a descriptive message.
#     The api/ layer converts this to HTTP 502.
#   - Ticker symbols are normalised to uppercase before any yfinance call.
#   - Never called from engine/ — only from data/sync.py.

# TODO: import yfinance as yf
# TODO: import pandas as pd
# TODO: from datetime import date
# TODO: from backend.config import FRED_API_KEY, RISK_FREE_SERIES

# ---------------------------------------------------------------------------
# Price data
# ---------------------------------------------------------------------------

# TODO: def fetch_prices(
#     tickers: list[str],
#     start: date,
#     end: date,
# ) -> pd.DataFrame:
#   """
#   Fetch daily OHLCV from Yahoo Finance for one or more tickers.
#
#   Uses yfinance.download(tickers, start=start, end=end, auto_adjust=True).
#   Returns a DataFrame with columns: ticker, date, close, adj_close, volume.
#   Rows where adj_close is NaN are dropped.
#   Tickers are normalised to uppercase.
#
#   Raises ConnectionError if yfinance returns an empty result or times out.
#   """

# ---------------------------------------------------------------------------
# Risk-free rate
# ---------------------------------------------------------------------------

# TODO: def fetch_risk_free_rate(series_id: str = RISK_FREE_SERIES) -> float:
#   """
#   Return the latest available risk-free rate as a decimal (e.g. 0.052).
#
#   Primary: FRED API via fredapi.Fred(FRED_API_KEY) — fetches series_id.
#   Fallback (when FRED_API_KEY is absent): yfinance.download("^IRX").
#   ^IRX is quoted as annualised %, so divide by 100.
#
#   Raises ConnectionError if both sources fail.
#   """

# ---------------------------------------------------------------------------
# Macro series (FRED)
# ---------------------------------------------------------------------------

# TODO: def fetch_macro_series(
#     series_ids: list[str],
#     start: date,
#     end: date,
# ) -> pd.DataFrame:
#   """
#   Fetch one or more FRED time series.
#   Returns DataFrame with columns: series_id, date, value.
#   Used for macro indicators in v2 regime detection.
#   Requires FRED_API_KEY — raises ValueError if key is absent.
#   """
