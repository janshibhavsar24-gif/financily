# api/sync.py — POST /api/sync
#
# Triggers incremental data sync for a list of tickers.
# Delegates to data/sync.py:sync_tickers().
#
# Request:  { tickers: list[str], lookback_years?: int }
# Response: { status, tickers_synced, rows_upserted, latest_date }
#
# Error cases:
#   422 — tickers list is empty
#   502 — yfinance or FRED is unreachable (ConnectionError from fetcher.py)

# TODO: import asyncio
# TODO: from fastapi import APIRouter, HTTPException
# TODO: from pydantic import BaseModel, field_validator
# TODO: from backend.data.sync import sync_tickers
# TODO: from backend.config import LOOKBACK_YEARS

# TODO: router = APIRouter()

# TODO: class SyncRequest(BaseModel):
#   tickers: list[str]
#   lookback_years: int = LOOKBACK_YEARS
#
#   @field_validator("tickers")
#   def tickers_not_empty(cls, v):
#     # Raise ValueError("tickers must not be empty") if len(v) == 0
#     # Normalise all tickers to uppercase
#     ...

# TODO: class SyncResponse(BaseModel):
#   status: str
#   tickers_synced: int
#   rows_upserted: int
#   latest_date: str

# TODO: @router.post("/api/sync", response_model=SyncResponse)
# TODO: async def sync_endpoint(body: SyncRequest) -> SyncResponse:
#   try:
#     result = await asyncio.to_thread(sync_tickers, body.tickers, body.lookback_years)
#     return SyncResponse(status="ok", **result)
#   except ConnectionError as e:
#     raise HTTPException(status_code=502, detail=str(e))
