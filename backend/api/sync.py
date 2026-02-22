import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from backend.config import LOOKBACK_YEARS
from backend.data.sync import sync_tickers

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


@router.post("/api/sync", response_model=SyncResponse)
async def sync_endpoint(body: SyncRequest) -> SyncResponse:
    try:
        result = await sync_tickers(body.tickers, body.lookback_years)
        return SyncResponse(status="ok", **result)
    except ConnectionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
