import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from backend.config import LOOKBACK_YEARS
from backend.data.db import get_connection
from backend.data.sync import sync_tickers
from backend.data.universe import compute_and_store_quality, get_asset_metadata

router = APIRouter()


class SyncRequest(BaseModel):
    tickers: list[str]
    lookback_years: int = LOOKBACK_YEARS

    @field_validator("tickers")
    @classmethod
    def tickers_not_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("tickers must not be empty")
        return [t.upper() for t in v]


class SyncResponse(BaseModel):
    status: str
    tickers_synced: int
    rows_upserted: int
    latest_date: str
    unknown_tickers: list[str]


@router.post("/api/sync", response_model=SyncResponse)
async def sync_endpoint(body: SyncRequest) -> SyncResponse:
    # Check which tickers are unknown in asset_universe (informational only)
    unknown: list[str] = []
    conn = get_connection()
    try:
        for ticker in body.tickers:
            if get_asset_metadata(conn, ticker) is None:
                unknown.append(ticker)
    finally:
        conn.close()

    try:
        result = await sync_tickers(body.tickers, body.lookback_years)
    except ConnectionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Compute quality scores for freshly synced tickers
    conn = get_connection()
    try:
        for ticker in body.tickers:
            compute_and_store_quality(conn, ticker)
    finally:
        conn.close()

    return SyncResponse(status="ok", **result, unknown_tickers=unknown)
