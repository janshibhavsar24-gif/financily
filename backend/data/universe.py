from __future__ import annotations

from datetime import date
from typing import Optional

import duckdb
import pandas as pd


def init_asset_universe(conn: duckdb.DuckDBPyConnection) -> None:
    """
    Populate asset_universe from FinanceDatabase (equities + ETFs).
    No-op if the table already has data. Runs once at startup.
    """
    count = conn.execute("SELECT COUNT(*) FROM asset_universe").fetchone()[0]
    if count > 0:
        return

    import financedatabase as fd

    frames: list[pd.DataFrame] = []
    for asset_type, loader in [("equity", fd.Equities), ("etf", fd.ETFs)]:
        try:
            df = loader().select()
        except Exception:
            continue
        if df is None or df.empty:
            continue
        df = df.reset_index()  # symbol is the index

        # Normalise to our schema columns
        symbol_col = "symbol" if "symbol" in df.columns else df.columns[0]
        name_col = next((c for c in ["name", "longName", "shortName"] if c in df.columns), None)
        sector_col = next((c for c in ["sector", "category"] if c in df.columns), None)
        industry_col = next(
            (c for c in ["industry", "industry_group"] if c in df.columns), None
        )
        country_col = "country" if "country" in df.columns else None
        exchange_col = "exchange" if "exchange" in df.columns else None
        currency_col = "currency" if "currency" in df.columns else None

        out = pd.DataFrame()
        out["symbol"] = df[symbol_col].astype(str).str.strip().str.upper()
        out["name"] = df[name_col].astype(str) if name_col else out["symbol"]
        out["asset_type"] = asset_type
        out["sector"] = df[sector_col].astype(str) if sector_col else None
        out["industry"] = df[industry_col].astype(str) if industry_col else None
        out["country"] = df[country_col].astype(str) if country_col else None
        out["exchange"] = df[exchange_col].astype(str) if exchange_col else None
        out["currency"] = df[currency_col].astype(str) if currency_col else None

        # Drop rows with empty/null symbol
        out = out[out["symbol"].str.len() > 0]
        out = out[out["symbol"] != "NAN"]
        frames.append(out)

    if not frames:
        return

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.drop_duplicates(subset=["symbol"], keep="first")

    # Bulk insert via DuckDB relation
    conn.register("_universe_staging", combined)
    conn.execute("""
        INSERT OR IGNORE INTO asset_universe
            (symbol, name, asset_type, sector, industry, country, exchange, currency)
        SELECT symbol, name, asset_type, sector, industry, country, exchange, currency
        FROM _universe_staging
    """)
    conn.unregister("_universe_staging")


def search_universe(
    conn: duckdb.DuckDBPyConnection,
    q: str,
    asset_type: str | None = None,
    sector: str | None = None,
    country: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """
    Search asset_universe by symbol prefix or name substring.
    Returns rows enriched with is_synced and quality_score.
    """
    params: list = [f"{q}%", f"%{q}%"]
    filters = "(u.symbol ILIKE ? OR u.name ILIKE ?)"

    if asset_type:
        filters += " AND u.asset_type = ?"
        params.append(asset_type.lower())
    if sector:
        filters += " AND u.sector ILIKE ?"
        params.append(f"%{sector}%")
    if country:
        filters += " AND u.country ILIKE ?"
        params.append(f"%{country}%")

    params.append(limit)

    rows = conn.execute(
        f"""
        SELECT
            u.symbol,
            u.name,
            u.asset_type,
            u.sector,
            u.country,
            u.exchange,
            (p.ticker IS NOT NULL) AS is_synced,
            aq.quality_score
        FROM asset_universe u
        LEFT JOIN (
            SELECT DISTINCT ticker FROM prices
        ) p ON u.symbol = p.ticker
        LEFT JOIN asset_quality aq ON u.symbol = aq.ticker
        WHERE {filters}
        ORDER BY
            CASE WHEN u.symbol ILIKE ? THEN 0 ELSE 1 END,
            u.symbol
        LIMIT ?
        """,
        params[:-1] + [f"{q}%", limit],
    ).fetchall()

    return [
        {
            "symbol": r[0],
            "name": r[1],
            "asset_type": r[2],
            "sector": r[3],
            "country": r[4],
            "exchange": r[5],
            "is_synced": bool(r[6]),
            "quality_score": r[7],
        }
        for r in rows
    ]


def get_asset_metadata(
    conn: duckdb.DuckDBPyConnection,
    ticker: str,
) -> Optional[dict]:
    """Return asset_universe metadata for a single ticker, or None if not found."""
    row = conn.execute(
        "SELECT asset_type, sector, industry, country, exchange, currency "
        "FROM asset_universe WHERE symbol = ?",
        [ticker.upper()],
    ).fetchone()
    if not row:
        return None
    return {
        "asset_type": row[0],
        "sector": row[1],
        "industry": row[2],
        "country": row[3],
        "exchange": row[4],
        "currency": row[5],
    }


def compute_and_store_quality(
    conn: duckdb.DuckDBPyConnection,
    ticker: str,
) -> float:
    """
    Compute a 0–1 quality score for a ticker based on its daily_returns data.
    Stores the result in asset_quality and returns the score.

    Score components:
      - history_score   (40%): years of data / 3  (capped at 1)
      - completeness    (40%): actual rows / expected trading days
      - freshness_score (20%): 1.0 if ≤7 days stale, 0.5 if ≤30 days, 0.0 otherwise
    """
    row = conn.execute(
        """
        SELECT
            COUNT(*)                    AS row_count,
            MIN(date)                   AS earliest,
            MAX(date)                   AS latest
        FROM daily_returns
        WHERE ticker = ?
        """,
        [ticker],
    ).fetchone()

    if not row or row[0] == 0:
        score = 0.0
        conn.execute(
            """
            INSERT OR REPLACE INTO asset_quality
                (ticker, quality_score, row_count, history_years, max_gap_days, latest_date)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [ticker, score, 0, 0.0, None, None],
        )
        return score

    row_count, earliest, latest = row
    span_days = (latest - earliest).days if latest and earliest else 0
    history_years = span_days / 365.25

    expected_rows = max(span_days * 252 / 365, 1)
    history_score = min(history_years / 3.0, 1.0)
    completeness = min(row_count / expected_rows, 1.0)

    stale_days = (date.today() - latest).days if latest else 999
    if stale_days <= 7:
        freshness_score = 1.0
    elif stale_days <= 30:
        freshness_score = 0.5
    else:
        freshness_score = 0.0

    # Max gap between consecutive return dates
    gap_row = conn.execute(
        """
        SELECT MAX(gap) FROM (
            SELECT DATEDIFF('day', LAG(date) OVER (ORDER BY date), date) AS gap
            FROM daily_returns
            WHERE ticker = ?
        ) t
        WHERE gap IS NOT NULL
        """,
        [ticker],
    ).fetchone()
    max_gap_days = int(gap_row[0]) if gap_row and gap_row[0] is not None else 0

    score = round(
        0.4 * history_score + 0.4 * completeness + 0.2 * freshness_score,
        3,
    )
    # Penalise extreme gaps (> 30 calendar days)
    if max_gap_days > 30:
        score = round(score * max(0.5, 1.0 - (max_gap_days - 30) / 365), 3)

    score = max(0.0, min(1.0, score))

    conn.execute(
        """
        INSERT OR REPLACE INTO asset_quality
            (ticker, quality_score, row_count, history_years, max_gap_days, latest_date)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [ticker, score, row_count, round(history_years, 2), max_gap_days, latest],
    )
    return score


def get_quality(conn: duckdb.DuckDBPyConnection, ticker: str) -> Optional[float]:
    """Return cached quality score for a ticker, or None if not computed yet."""
    row = conn.execute(
        "SELECT quality_score FROM asset_quality WHERE ticker = ?",
        [ticker.upper()],
    ).fetchone()
    return row[0] if row else None


# Suppress noisy NaN comparisons from financedatabase internals
import warnings as _warnings
_warnings.filterwarnings("ignore", message=".*invalid value encountered.*")
_warnings.filterwarnings("ignore", category=FutureWarning)

# math.isnan is used internally; re-export for convenience
__all__ = [
    "init_asset_universe",
    "search_universe",
    "get_asset_metadata",
    "compute_and_store_quality",
    "get_quality",
]
