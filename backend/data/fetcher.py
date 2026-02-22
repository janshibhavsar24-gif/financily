from __future__ import annotations
from datetime import date
import pandas as pd
import yfinance as yf

from backend.config import FRED_API_KEY


def fetch_prices(
    tickers: list[str],
    start: date,
    end: date,
) -> pd.DataFrame:
    """
    Download OHLCV data from Yahoo Finance.
    Returns DataFrame with columns: ticker, date, close, adj_close, volume.
    Raises ConnectionError on network failure or empty result.
    """
    tickers = [t.upper() for t in tickers]
    try:
        raw = yf.download(
            tickers,
            start=str(start),
            end=str(end),
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    except Exception as exc:
        raise ConnectionError(f"Yahoo Finance unavailable: {exc}") from exc

    if raw is None or raw.empty:
        raise ConnectionError(f"No data returned for tickers: {tickers}")

    rows = []
    if isinstance(raw.columns, pd.MultiIndex):
        for ticker in tickers:
            try:
                close_col = raw["Close"][ticker]
                vol_col = raw["Volume"][ticker]
            except KeyError:
                continue
            df_t = pd.DataFrame({
                "ticker": ticker,
                "date": raw.index,
                "close": close_col.values,
                "adj_close": close_col.values,
                "volume": vol_col.values,
            })
            rows.append(df_t)
    else:
        # Single ticker returns flat columns
        ticker = tickers[0]
        df_t = pd.DataFrame({
            "ticker": ticker,
            "date": raw.index,
            "close": raw["Close"].values,
            "adj_close": raw["Close"].values,
            "volume": raw["Volume"].values,
        })
        rows.append(df_t)

    if not rows:
        raise ConnectionError(f"No data returned for any of: {tickers}")

    result = pd.concat(rows, ignore_index=True)
    result["date"] = pd.to_datetime(result["date"]).dt.date
    result = result.dropna(subset=["adj_close"])
    return result.reset_index(drop=True)


def fetch_risk_free_rate(series_id: str = "DGS3MO") -> float:
    """
    Return the latest risk-free rate as an annual decimal (e.g. 0.052).
    Primary: FRED API. Fallback: yfinance ^IRX. Hard fallback: 0.05.
    """
    if FRED_API_KEY:
        try:
            from fredapi import Fred  # type: ignore[import-untyped]
            fred = Fred(api_key=FRED_API_KEY)
            series = fred.get_series(series_id)
            latest = float(series.dropna().iloc[-1])
            return latest / 100.0
        except Exception:
            pass

    try:
        irx = yf.Ticker("^IRX")
        hist = irx.history(period="5d")
        if not hist.empty:
            return float(hist["Close"].iloc[-1]) / 100.0
    except Exception:
        pass

    return 0.05


def fetch_macro_series(
    series_ids: list[str],
    start: date,
    end: date,
) -> pd.DataFrame:
    """
    Fetch FRED macro time series.
    Returns DataFrame with columns: series_id, date, value.
    Raises ConnectionError if FRED is unreachable or key is missing.
    """
    if not FRED_API_KEY:
        raise ConnectionError("FRED_API_KEY not set — cannot fetch macro series")
    try:
        from fredapi import Fred  # type: ignore[import-untyped]
        fred = Fred(api_key=FRED_API_KEY)
        rows = []
        for sid in series_ids:
            s = fred.get_series(sid, observation_start=str(start), observation_end=str(end))
            df = pd.DataFrame({"series_id": sid, "date": s.index, "value": s.values})
            rows.append(df)
        if not rows:
            return pd.DataFrame(columns=["series_id", "date", "value"])
        result = pd.concat(rows, ignore_index=True)
        result["date"] = pd.to_datetime(result["date"]).dt.date
        return result
    except Exception as exc:
        raise ConnectionError(f"FRED unavailable: {exc}") from exc
