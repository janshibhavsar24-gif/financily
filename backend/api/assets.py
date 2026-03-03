import asyncio
from typing import Optional

import yfinance as yf
from fastapi import APIRouter
from pydantic import BaseModel

from backend.data.db import get_connection

router = APIRouter()


class AssetInfo(BaseModel):
    ticker: str
    name: str
    latest_date: str
    rows: int
    quality_score: float
    asset_type: Optional[str]
    sector: Optional[str]


class AssetsResponse(BaseModel):
    assets: list[AssetInfo]


def _resolve_name(ticker: str) -> str:
    try:
        info = yf.Ticker(ticker).info
        return info.get("longName") or info.get("shortName") or ticker
    except Exception:
        return ticker


def _batch_compute_quality(conn, tickers: list[str]) -> dict[str, float]:
    """Compute and store quality scores for multiple tickers in two bulk queries."""
    ph = ",".join("?" * len(tickers))
    computed = conn.execute(
        f"""
        WITH stats AS (
            SELECT
                ticker,
                COUNT(*)                              AS row_count,
                MIN(date)                             AS earliest,
                MAX(date)                             AS latest,
                DATEDIFF('day', MIN(date), MAX(date)) AS span_days
            FROM daily_returns
            WHERE ticker IN ({ph})
            GROUP BY ticker
        ),
        gaps AS (
            SELECT ticker, MAX(gap) AS max_gap_days
            FROM (
                SELECT ticker,
                    DATEDIFF('day', LAG(date) OVER (PARTITION BY ticker ORDER BY date), date) AS gap
                FROM daily_returns
                WHERE ticker IN ({ph})
            ) sub
            WHERE gap IS NOT NULL
            GROUP BY ticker
        )
        SELECT
            s.ticker,
            ROUND(GREATEST(0.0, LEAST(1.0,
                (  0.4 * LEAST(s.span_days / 365.25 / 3.0, 1.0)
                 + 0.4 * LEAST(s.row_count / GREATEST(s.span_days * 252.0 / 365, 1.0), 1.0)
                 + 0.2 * CASE
                     WHEN DATEDIFF('day', s.latest, CURRENT_DATE) <= 7  THEN 1.0
                     WHEN DATEDIFF('day', s.latest, CURRENT_DATE) <= 30 THEN 0.5
                     ELSE 0.0
                   END
                ) * CASE WHEN COALESCE(g.max_gap_days, 0) > 30
                    THEN GREATEST(0.5, 1.0 - (COALESCE(g.max_gap_days, 0) - 30.0) / 365)
                    ELSE 1.0
                  END
            )), 3) AS quality_score,
            s.row_count,
            ROUND(s.span_days / 365.25, 2) AS history_years,
            COALESCE(g.max_gap_days, 0)    AS max_gap_days,
            s.latest                        AS latest_date
        FROM stats s
        LEFT JOIN gaps g ON s.ticker = g.ticker
        """,
        tickers * 2,
    ).fetchall()

    found = {r[0] for r in computed}
    no_data = [(t,) for t in tickers if t not in found]

    if computed:
        conn.executemany(
            """
            INSERT OR REPLACE INTO asset_quality
                (ticker, quality_score, row_count, history_years, max_gap_days, latest_date)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            computed,
        )
    if no_data:
        conn.executemany(
            """
            INSERT OR REPLACE INTO asset_quality
                (ticker, quality_score, row_count, history_years, max_gap_days, latest_date)
            VALUES (?, 0.0, 0, 0.0, NULL, NULL)
            """,
            no_data,
        )

    return {r[0]: r[1] for r in computed} | {t[0]: 0.0 for t in no_data}


def _fetch_assets_from_db() -> tuple[list, dict[str, float]]:
    """Fetch asset rows and compute any missing quality scores. Runs in a thread."""
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT
                p.ticker,
                MAX(p.date)      AS latest_date,
                COUNT(*)         AS row_count,
                aq.quality_score,
                u.asset_type,
                u.sector,
                u.name           AS universe_name
            FROM prices p
            LEFT JOIN asset_quality aq ON p.ticker = aq.ticker
            LEFT JOIN asset_universe u  ON p.ticker = u.symbol
            GROUP BY p.ticker, aq.quality_score, u.asset_type, u.sector, u.name
            ORDER BY p.ticker ASC
        """).fetchall()

        scores = {r[0]: r[3] for r in rows}
        needs_quality = [r[0] for r in rows if r[3] is None]
        if needs_quality:
            scores.update(_batch_compute_quality(conn, needs_quality))

        return rows, scores
    finally:
        conn.close()


def _cache_names(names_map: dict[str, str]) -> None:
    conn = get_connection()
    try:
        conn.executemany(
            "INSERT OR IGNORE INTO asset_universe (symbol, name) VALUES (?, ?)",
            list(names_map.items()),
        )
    finally:
        conn.close()


@router.get("/api/assets", response_model=AssetsResponse)
async def list_assets() -> AssetsResponse:
    rows, scores = await asyncio.to_thread(_fetch_assets_from_db)

    needs_yf = [(i, r[0]) for i, r in enumerate(rows) if not r[6]]
    names: list[str] = [r[6] or r[0] for r in rows]

    if needs_yf:
        resolved = await asyncio.gather(
            *[
                asyncio.wait_for(asyncio.to_thread(_resolve_name, ticker), timeout=5.0)
                for _, ticker in needs_yf
            ],
            return_exceptions=True,
        )
        new_names: dict[str, str] = {}
        for (i, ticker), result in zip(needs_yf, resolved):
            name = result if isinstance(result, str) else ticker
            names[i] = name
            new_names[ticker] = name

        # Cache resolved names so future calls skip yfinance
        if new_names:
            await asyncio.to_thread(_cache_names, new_names)

    return AssetsResponse(
        assets=[
            AssetInfo(
                ticker=r[0],
                name=names[i],
                latest_date=str(r[1]),
                rows=r[2],
                quality_score=scores.get(r[0]) or 0.0,
                asset_type=r[4],
                sector=r[5],
            )
            for i, r in enumerate(rows)
        ]
    )
