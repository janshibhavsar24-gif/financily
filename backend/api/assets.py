# api/assets.py — GET /api/assets
#
# Lists all tickers currently stored in the local DuckDB, sorted alphabetically.
# Used by the frontend AssetSelector to populate the typeahead dropdown.
#
# Response: { assets: [{ ticker, name, latest_date, rows }] }
#
# Name resolution: attempt yfinance.Ticker(ticker).info["longName"] with a
# 5-second timeout. On failure (timeout, KeyError, any exception): use the
# ticker symbol as the name. Never let name resolution fail the whole request.

# TODO: import asyncio
# TODO: from fastapi import APIRouter
# TODO: from pydantic import BaseModel
# TODO: import yfinance as yf
# TODO: from backend.data.db import get_connection

# TODO: router = APIRouter()

# TODO: class AssetInfo(BaseModel):
#   ticker: str
#   name: str
#   latest_date: str
#   rows: int

# TODO: class AssetsResponse(BaseModel):
#   assets: list[AssetInfo]

# TODO: @router.get("/api/assets", response_model=AssetsResponse)
# TODO: async def list_assets() -> AssetsResponse:
#   """
#   SELECT ticker, MAX(date) as latest_date, COUNT(*) as rows
#   FROM prices
#   GROUP BY ticker
#   ORDER BY ticker ASC
#
#   For each ticker, attempt name resolution in a separate thread
#   (yfinance is synchronous). Use asyncio.wait_for with timeout=5.0.
#   """
