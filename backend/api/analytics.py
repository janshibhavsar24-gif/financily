from __future__ import annotations

import asyncio
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from backend.data.db import get_connection

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ThemeTagsResponse(BaseModel):
    tags: dict[str, str]


class ThemeTagRequest(BaseModel):
    theme: str

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Theme cannot be empty")
        if len(v) > 60:
            raise ValueError("Theme cannot exceed 60 characters")
        return v


class EarningsDate(BaseModel):
    ticker: str
    earnings_date: str
    note: str


class EarningsDateRequest(BaseModel):
    ticker: str
    earnings_date: str  # YYYY-MM-DD
    note: str = ""

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        return v.upper().strip()

    @field_validator("earnings_date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        try:
            date_type.fromisoformat(v)
        except ValueError:
            raise ValueError("earnings_date must be in YYYY-MM-DD format")
        return v


class EarningsResponse(BaseModel):
    entries: list[EarningsDate]


# ---------------------------------------------------------------------------
# DB helpers — all run inside asyncio.to_thread
# ---------------------------------------------------------------------------

def _get_theme_tags() -> ThemeTagsResponse:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT ticker, theme FROM ticker_tags ORDER BY ticker ASC"
        ).fetchall()
        return ThemeTagsResponse(tags={r[0]: r[1] for r in rows})
    finally:
        conn.close()


def _set_theme_tag(ticker: str, theme: str) -> ThemeTagsResponse:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO ticker_tags (ticker, theme) VALUES (?, ?)",
            [ticker, theme],
        )
        rows = conn.execute(
            "SELECT ticker, theme FROM ticker_tags ORDER BY ticker ASC"
        ).fetchall()
        return ThemeTagsResponse(tags={r[0]: r[1] for r in rows})
    finally:
        conn.close()


def _delete_theme_tag(ticker: str) -> None:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM ticker_tags WHERE ticker = ?", [ticker])
    finally:
        conn.close()


def _get_earnings() -> EarningsResponse:
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT ticker, CAST(earnings_date AS VARCHAR), note
            FROM earnings_dates
            ORDER BY earnings_date ASC
            """
        ).fetchall()
        return EarningsResponse(
            entries=[EarningsDate(ticker=r[0], earnings_date=r[1], note=r[2]) for r in rows]
        )
    finally:
        conn.close()


def _add_earnings_date(ticker: str, earnings_date: str, note: str) -> EarningsDate:
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO earnings_dates (ticker, earnings_date, note)
            VALUES (?, ?, ?)
            """,
            [ticker, earnings_date, note],
        )
        row = conn.execute(
            """
            SELECT ticker, CAST(earnings_date AS VARCHAR), note
            FROM earnings_dates WHERE ticker = ? AND earnings_date = ?
            """,
            [ticker, earnings_date],
        ).fetchone()
        return EarningsDate(ticker=row[0], earnings_date=row[1], note=row[2])
    finally:
        conn.close()


def _delete_earnings_date(ticker: str, earnings_date: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "DELETE FROM earnings_dates WHERE ticker = ? AND earnings_date = ?",
            [ticker, earnings_date],
        )
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Endpoints — Tags (F2)
# ---------------------------------------------------------------------------

@router.get("/api/tags", response_model=ThemeTagsResponse)
async def get_tags() -> ThemeTagsResponse:
    return await asyncio.to_thread(_get_theme_tags)


@router.put("/api/tags/{ticker}", response_model=ThemeTagsResponse)
async def set_tag(ticker: str, req: ThemeTagRequest) -> ThemeTagsResponse:
    ticker_upper = ticker.upper().strip()
    return await asyncio.to_thread(_set_theme_tag, ticker_upper, req.theme)


@router.delete("/api/tags/{ticker}", status_code=204)
async def delete_tag(ticker: str) -> None:
    ticker_upper = ticker.upper().strip()
    await asyncio.to_thread(_delete_theme_tag, ticker_upper)


# ---------------------------------------------------------------------------
# Endpoints — Earnings (F6)
# ---------------------------------------------------------------------------

@router.get("/api/earnings", response_model=EarningsResponse)
async def get_earnings() -> EarningsResponse:
    return await asyncio.to_thread(_get_earnings)


@router.post("/api/earnings", response_model=EarningsDate, status_code=201)
async def add_earnings(req: EarningsDateRequest) -> EarningsDate:
    return await asyncio.to_thread(_add_earnings_date, req.ticker, req.earnings_date, req.note)


@router.delete("/api/earnings/{ticker}/{earnings_date}", status_code=204)
async def delete_earnings(ticker: str, earnings_date: str) -> None:
    ticker_upper = ticker.upper().strip()
    # Validate date format
    try:
        date_type.fromisoformat(earnings_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="earnings_date must be YYYY-MM-DD")
    await asyncio.to_thread(_delete_earnings_date, ticker_upper, earnings_date)
