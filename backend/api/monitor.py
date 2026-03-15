from __future__ import annotations

import asyncio
import math
import uuid
from datetime import date as date_type
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
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
# Named-watchlist + portfolio P&L models
# ---------------------------------------------------------------------------

class WatchlistInfo(BaseModel):
    id: str
    name: str
    holding_count: int
    created_at: str


class WatchlistListResponse(BaseModel):
    watchlists: list[WatchlistInfo]


class CreateWatchlistRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 60:
            raise ValueError("Name cannot exceed 60 characters")
        return v


class RenameWatchlistRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 60:
            raise ValueError("Name cannot exceed 60 characters")
        return v


class LotInfo(BaseModel):
    lot_id: str
    ticker: str
    amount: float
    purchase_date: str
    added_at: str


class HoldingsResponse(BaseModel):
    watchlist_id: str
    watchlist_name: str
    holdings: list[LotInfo]


class AddLotRequest(BaseModel):
    ticker: str
    amount: float
    purchase_date: str  # YYYY-MM-DD

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        return v.upper().strip()

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v

    @field_validator("purchase_date")
    @classmethod
    def validate_purchase_date(cls, v: str) -> str:
        try:
            date_type.fromisoformat(v)
        except ValueError:
            raise ValueError("purchase_date must be in YYYY-MM-DD format")
        return v


class LotPL(BaseModel):
    lot_id: str
    ticker: str
    amount: float
    purchase_date: str
    purchase_price: Optional[float]
    current_price: Optional[float]
    current_value: Optional[float]
    pl_dollars: Optional[float]
    pl_pct: Optional[float]
    days_held: Optional[int]


class TickerPL(BaseModel):
    ticker: str
    lots: list[LotPL]
    total_amount: float
    total_current_value: Optional[float]
    total_pl_dollars: Optional[float]
    avg_pl_pct: Optional[float]
    allocation_pct: Optional[float]


class PortfolioSummaryPL(BaseModel):
    total_invested: float
    total_current_value: Optional[float]
    total_pl_dollars: Optional[float]
    total_pl_pct: Optional[float]
    spy_equivalent_value: Optional[float]
    spy_return_pct: Optional[float]
    as_of_date: Optional[str]


class PortfolioResponse(BaseModel):
    watchlist_id: str
    watchlist_name: str
    summary: PortfolioSummaryPL
    holdings: list[TickerPL]


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


# ---------------------------------------------------------------------------
# Named-watchlist DB helpers
# ---------------------------------------------------------------------------

def _list_watchlists() -> WatchlistListResponse:
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT w.id, w.name, CAST(w.created_at AS VARCHAR),
                   COUNT(wh.id) AS holding_count
            FROM watchlists w
            LEFT JOIN watchlist_holdings wh ON w.id = wh.watchlist_id
            GROUP BY w.id, w.name, w.created_at
            ORDER BY w.created_at ASC
        """).fetchall()
        return WatchlistListResponse(
            watchlists=[
                WatchlistInfo(id=r[0], name=r[1], created_at=r[2], holding_count=r[3])
                for r in rows
            ]
        )
    finally:
        conn.close()


def _create_watchlist(name: str) -> WatchlistInfo:
    wl_id = str(uuid.uuid4())
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO watchlists (id, name) VALUES (?, ?)",
            [wl_id, name],
        )
        row = conn.execute(
            "SELECT id, name, CAST(created_at AS VARCHAR) FROM watchlists WHERE id = ?",
            [wl_id],
        ).fetchone()
        return WatchlistInfo(id=row[0], name=row[1], created_at=row[2], holding_count=0)
    finally:
        conn.close()


def _rename_watchlist(watchlist_id: str, name: str) -> WatchlistInfo:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE watchlists SET name = ? WHERE id = ?",
            [name, watchlist_id],
        )
        row = conn.execute(
            """
            SELECT w.id, w.name, CAST(w.created_at AS VARCHAR), COUNT(wh.id)
            FROM watchlists w
            LEFT JOIN watchlist_holdings wh ON w.id = wh.watchlist_id
            WHERE w.id = ?
            GROUP BY w.id, w.name, w.created_at
            """,
            [watchlist_id],
        ).fetchone()
        if not row:
            raise ValueError("Not found")
        return WatchlistInfo(id=row[0], name=row[1], created_at=row[2], holding_count=row[3])
    finally:
        conn.close()


def _delete_watchlist(watchlist_id: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "DELETE FROM watchlist_holdings WHERE watchlist_id = ?",
            [watchlist_id],
        )
        conn.execute("DELETE FROM watchlists WHERE id = ?", [watchlist_id])
    finally:
        conn.close()


def _get_holdings(watchlist_id: str) -> HoldingsResponse:
    conn = get_connection()
    try:
        wl_row = conn.execute(
            "SELECT name FROM watchlists WHERE id = ?", [watchlist_id]
        ).fetchone()
        if not wl_row:
            raise ValueError("Not found")
        rows = conn.execute(
            """
            SELECT id, ticker, amount,
                   CAST(purchase_date AS VARCHAR),
                   CAST(added_at AS VARCHAR)
            FROM watchlist_holdings
            WHERE watchlist_id = ?
            ORDER BY ticker ASC, added_at ASC
            """,
            [watchlist_id],
        ).fetchall()
        return HoldingsResponse(
            watchlist_id=watchlist_id,
            watchlist_name=wl_row[0],
            holdings=[
                LotInfo(
                    lot_id=r[0], ticker=r[1], amount=r[2],
                    purchase_date=r[3], added_at=r[4],
                )
                for r in rows
            ],
        )
    finally:
        conn.close()


def _add_lot(watchlist_id: str, ticker: str, amount: float, purchase_date: str) -> LotInfo:
    lot_id = str(uuid.uuid4())
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO watchlist_holdings (id, watchlist_id, ticker, amount, purchase_date)
            VALUES (?, ?, ?, ?, ?)
            """,
            [lot_id, watchlist_id, ticker, amount, purchase_date],
        )
        row = conn.execute(
            """
            SELECT id, ticker, amount,
                   CAST(purchase_date AS VARCHAR),
                   CAST(added_at AS VARCHAR)
            FROM watchlist_holdings WHERE id = ?
            """,
            [lot_id],
        ).fetchone()
        return LotInfo(
            lot_id=row[0], ticker=row[1], amount=row[2],
            purchase_date=row[3], added_at=row[4],
        )
    finally:
        conn.close()


def _watchlist_exists(watchlist_id: str) -> bool:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id FROM watchlists WHERE id = ?", [watchlist_id]
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def _delete_lot(watchlist_id: str, lot_id: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "DELETE FROM watchlist_holdings WHERE id = ? AND watchlist_id = ?",
            [lot_id, watchlist_id],
        )
    finally:
        conn.close()


def _fetch_portfolio(watchlist_id: str) -> PortfolioResponse:
    conn = get_connection()
    try:
        wl_row = conn.execute(
            "SELECT id, name FROM watchlists WHERE id = ?", [watchlist_id]
        ).fetchone()
        if not wl_row:
            raise ValueError("Not found")
        watchlist_name = wl_row[1]

        lots_rows = conn.execute(
            """
            SELECT id, ticker, amount,
                   CAST(purchase_date AS VARCHAR),
                   CAST(added_at AS VARCHAR)
            FROM watchlist_holdings
            WHERE watchlist_id = ?
            ORDER BY ticker ASC, added_at ASC
            """,
            [watchlist_id],
        ).fetchall()

        if not lots_rows:
            return PortfolioResponse(
                watchlist_id=watchlist_id,
                watchlist_name=watchlist_name,
                summary=PortfolioSummaryPL(
                    total_invested=0.0,
                    total_current_value=None,
                    total_pl_dollars=None,
                    total_pl_pct=None,
                    spy_equivalent_value=None,
                    spy_return_pct=None,
                    as_of_date=None,
                ),
                holdings=[],
            )

        # Unique tickers (always include SPY for benchmark)
        ticker_set = {r[1] for r in lots_rows}
        tickers_with_spy = list(ticker_set | {"SPY"})
        ph = ", ".join("?" * len(tickers_with_spy))

        current_rows = conn.execute(
            f"""
            SELECT ticker, adj_close, CAST(date AS VARCHAR)
            FROM (
                SELECT ticker, adj_close, date,
                       ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY date DESC) AS rn
                FROM prices
                WHERE ticker IN ({ph})
            ) sub
            WHERE rn = 1
            """,
            tickers_with_spy,
        ).fetchall()
        current_prices: dict[str, tuple[Optional[float], Optional[str]]] = {
            r[0]: (r[1], r[2]) for r in current_rows
        }

        spy_current_price = current_prices.get("SPY", (None, None))[0]
        as_of_date: Optional[str] = None
        for _, (_, dt) in current_prices.items():
            if dt and (as_of_date is None or dt > as_of_date):
                as_of_date = dt

        # Per-lot P&L (individual queries for nearest-date purchase price)
        lot_details: list[tuple] = []
        for (lot_id, ticker, amount, purchase_date_str, added_at) in lots_rows:
            purchase_row = conn.execute(
                """
                SELECT adj_close FROM prices
                WHERE ticker = ? AND date >= ?
                ORDER BY date ASC LIMIT 1
                """,
                [ticker, purchase_date_str],
            ).fetchone()
            purchase_price: Optional[float] = purchase_row[0] if purchase_row else None

            spy_purchase_row = conn.execute(
                """
                SELECT adj_close FROM prices
                WHERE ticker = 'SPY' AND date >= ?
                ORDER BY date ASC LIMIT 1
                """,
                [purchase_date_str],
            ).fetchone()
            spy_purchase_price: Optional[float] = (
                spy_purchase_row[0] if spy_purchase_row else None
            )

            lot_details.append(
                (lot_id, ticker, amount, purchase_date_str, added_at,
                 purchase_price, spy_purchase_price)
            )

        # Build per-lot P&L objects, aggregated by ticker
        ticker_lots: dict[str, list[LotPL]] = {}
        total_invested = 0.0
        total_invested_with_data = 0.0
        total_current_value = 0.0
        total_spy_equivalent = 0.0
        has_any_current = False

        for (lot_id, ticker, amount, purchase_date_str, _,
             purchase_price, spy_purchase_price) in lot_details:
            current_price, _ = current_prices.get(ticker, (None, None))

            current_value: Optional[float] = None
            pl_dollars: Optional[float] = None
            pl_pct: Optional[float] = None
            days_held: Optional[int] = None

            if (purchase_price is not None and current_price is not None
                    and purchase_price > 0):
                current_value = amount * (current_price / purchase_price)
                pl_dollars = current_value - amount
                pl_pct = current_price / purchase_price - 1.0
                total_invested_with_data += amount
                total_current_value += current_value
                has_any_current = True

            try:
                pd_obj = date_type.fromisoformat(purchase_date_str)
                days_held = (date_type.today() - pd_obj).days
            except ValueError:
                pass

            lot_pl = LotPL(
                lot_id=lot_id,
                ticker=ticker,
                amount=amount,
                purchase_date=purchase_date_str,
                purchase_price=_safe(purchase_price),
                current_price=_safe(current_price),
                current_value=_safe(current_value),
                pl_dollars=_safe(pl_dollars),
                pl_pct=_safe(pl_pct),
                days_held=days_held,
            )
            ticker_lots.setdefault(ticker, []).append(lot_pl)
            total_invested += amount

            if (spy_purchase_price is not None and spy_current_price is not None
                    and spy_purchase_price > 0):
                total_spy_equivalent += amount * (spy_current_price / spy_purchase_price)

        portfolio_total_current = total_current_value if has_any_current else None

        # Aggregate per ticker
        holdings: list[TickerPL] = []
        for ticker in sorted(ticker_set):
            lots = ticker_lots.get(ticker, [])
            ticker_invested = sum(l.amount for l in lots)
            valued_lots = [l for l in lots if l.current_value is not None]
            has_ticker_data = len(valued_lots) > 0
            ticker_current = sum(l.current_value for l in valued_lots) if has_ticker_data else 0.0  # type: ignore[misc]
            ticker_invested_with_data = sum(l.amount for l in valued_lots)
            ticker_pl_dollars = (
                ticker_current - ticker_invested_with_data if has_ticker_data else None
            )
            avg_pl_pct = (
                ticker_pl_dollars / ticker_invested_with_data
                if ticker_pl_dollars is not None and ticker_invested_with_data > 0
                else None
            )
            allocation_pct = (
                ticker_current / portfolio_total_current
                if portfolio_total_current and portfolio_total_current > 0 and has_ticker_data
                else None
            )
            holdings.append(TickerPL(
                ticker=ticker,
                lots=lots,
                total_amount=ticker_invested,
                total_current_value=_safe(ticker_current) if has_ticker_data else None,
                total_pl_dollars=_safe(ticker_pl_dollars),
                avg_pl_pct=_safe(avg_pl_pct),
                allocation_pct=_safe(allocation_pct),
            ))

        holdings.sort(key=lambda h: h.total_current_value or 0.0, reverse=True)

        portfolio_pl_dollars = (
            total_current_value - total_invested_with_data if has_any_current else None
        )
        portfolio_pl_pct = (
            portfolio_pl_dollars / total_invested_with_data
            if portfolio_pl_dollars is not None and total_invested_with_data > 0
            else None
        )
        spy_return_pct = (
            (total_spy_equivalent - total_invested) / total_invested
            if total_spy_equivalent > 0 and total_invested > 0
            else None
        )

        return PortfolioResponse(
            watchlist_id=watchlist_id,
            watchlist_name=watchlist_name,
            summary=PortfolioSummaryPL(
                total_invested=total_invested,
                total_current_value=_safe(total_current_value) if has_any_current else None,
                total_pl_dollars=_safe(portfolio_pl_dollars),
                total_pl_pct=_safe(portfolio_pl_pct),
                spy_equivalent_value=_safe(total_spy_equivalent) if total_spy_equivalent > 0 else None,
                spy_return_pct=_safe(spy_return_pct),
                as_of_date=as_of_date,
            ),
            holdings=holdings,
        )
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Named-watchlist endpoints
# ---------------------------------------------------------------------------

@router.get("/api/watchlists", response_model=WatchlistListResponse)
async def list_watchlists() -> WatchlistListResponse:
    return await asyncio.to_thread(_list_watchlists)


@router.post("/api/watchlists", response_model=WatchlistInfo, status_code=201)
async def create_watchlist(req: CreateWatchlistRequest) -> WatchlistInfo:
    return await asyncio.to_thread(_create_watchlist, req.name)


@router.patch("/api/watchlists/{watchlist_id}", response_model=WatchlistInfo)
async def rename_watchlist(watchlist_id: str, req: RenameWatchlistRequest) -> WatchlistInfo:
    try:
        return await asyncio.to_thread(_rename_watchlist, watchlist_id, req.name)
    except ValueError:
        raise HTTPException(status_code=404, detail="Watchlist not found")


@router.delete("/api/watchlists/{watchlist_id}", status_code=204)
async def delete_watchlist(watchlist_id: str) -> None:
    await asyncio.to_thread(_delete_watchlist, watchlist_id)


@router.get("/api/watchlists/{watchlist_id}/holdings", response_model=HoldingsResponse)
async def get_holdings(watchlist_id: str) -> HoldingsResponse:
    try:
        return await asyncio.to_thread(_get_holdings, watchlist_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Watchlist not found")


@router.post(
    "/api/watchlists/{watchlist_id}/holdings",
    response_model=LotInfo,
    status_code=201,
)
async def add_lot(watchlist_id: str, req: AddLotRequest) -> LotInfo:
    # Verify watchlist exists
    exists = await asyncio.to_thread(_watchlist_exists, watchlist_id)
    if not exists:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return await asyncio.to_thread(
        _add_lot, watchlist_id, req.ticker, req.amount, req.purchase_date
    )


@router.delete(
    "/api/watchlists/{watchlist_id}/holdings/{lot_id}",
    status_code=204,
)
async def delete_lot(watchlist_id: str, lot_id: str) -> None:
    await asyncio.to_thread(_delete_lot, watchlist_id, lot_id)


@router.get("/api/watchlists/{watchlist_id}/portfolio", response_model=PortfolioResponse)
async def get_portfolio(watchlist_id: str) -> PortfolioResponse:
    try:
        return await asyncio.to_thread(_fetch_portfolio, watchlist_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Watchlist not found")
