from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.config import ANTHROPIC_API_KEY, DD_CHAT_MAX_TOKENS, DD_MAX_TOKENS, DD_MODEL
from backend.data.db import get_connection
from backend.data.fundamentals import fetch_fundamentals
from backend.engine.analyst import build_report_prompt, build_system_prompt

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class DDReportRequest(BaseModel):
    ticker: str


class ChatMessage(BaseModel):
    role: str
    content: str


class DDChatRequest(BaseModel):
    ticker: str
    messages: list[ChatMessage]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fetch_price_stats(conn, ticker: str) -> dict:
    """Pull price statistics for the ticker from DuckDB."""
    try:
        row = conn.execute(
            """
            SELECT
                aq.history_years,
                aq.quality_score,
                -- 1Y return: annualised log return over last 252 trading days
                EXP(SUM(CASE WHEN rn <= 252 THEN dr.ret ELSE 0 END)) - 1  AS ret_1y,
                -- 3Y return: annualised log return over last 756 trading days
                (EXP(SUM(CASE WHEN rn <= 756 THEN dr.ret ELSE 0 END)) - 1) AS ret_3y_total,
                STDDEV_POP(CASE WHEN rn <= 252 THEN dr.ret END) * SQRT(252) AS vol_1y,
                STDDEV_POP(CASE WHEN rn <= 756 THEN dr.ret END) * SQRT(252) AS vol_3y
            FROM asset_quality aq
            JOIN (
                SELECT ret, ROW_NUMBER() OVER (ORDER BY date DESC) AS rn
                FROM daily_returns
                WHERE ticker = ?
            ) dr ON TRUE
            WHERE aq.ticker = ?
            GROUP BY aq.history_years, aq.quality_score
            """,
            [ticker.upper(), ticker.upper()],
        ).fetchone()
    except Exception:
        return {}

    if not row:
        return {}

    history_years, quality_score, ret_1y, ret_3y_total, vol_1y, vol_3y = row

    # Annualise 3Y total return
    try:
        ann_3y = float(ret_3y_total + 1) ** (1 / 3) - 1 if ret_3y_total is not None else None
    except Exception:
        ann_3y = None

    # Max drawdown over last 756 days
    max_dd = None
    try:
        dd_row = conn.execute(
            """
            WITH ranked AS (
                SELECT ret, ROW_NUMBER() OVER (ORDER BY date DESC) AS rn
                FROM daily_returns WHERE ticker = ?
            ),
            windowed AS (SELECT ret FROM ranked WHERE rn <= 756),
            cumret AS (
                SELECT EXP(SUM(ret) OVER (ORDER BY rowid)) AS wealth
                FROM (SELECT ret, ROW_NUMBER() OVER () AS rowid FROM windowed)
            )
            SELECT MIN((wealth - MAX(wealth) OVER (ORDER BY rowid)) / MAX(wealth) OVER (ORDER BY rowid))
            FROM (SELECT wealth, ROW_NUMBER() OVER () AS rowid FROM cumret)
            """,
            [ticker.upper()],
        ).fetchone()
        if dd_row and dd_row[0] is not None:
            max_dd = float(dd_row[0])
    except Exception:
        pass

    return {
        "history_years": round(float(history_years), 1) if history_years else None,
        "quality_score": round(float(quality_score), 2) if quality_score else None,
        "annualised_return_1y": round(float(ret_1y), 4) if ret_1y is not None else None,
        "annualised_return_3y": round(float(ann_3y), 4) if ann_3y is not None else None,
        "annualised_volatility_1y": round(float(vol_1y), 4) if vol_1y is not None else None,
        "annualised_volatility_3y": round(float(vol_3y), 4) if vol_3y is not None else None,
        "max_drawdown_3y": round(float(max_dd), 4) if max_dd is not None else None,
    }


async def _stream_anthropic(messages: list[dict], max_tokens: int) -> AsyncIterator[str]:
    """
    Stream tokens from Anthropic API, yielding SSE-formatted `data:` lines.
    Yields an error event on failure.
    """
    if not ANTHROPIC_API_KEY:
        yield f'data: {json.dumps({"type": "error", "message": "ANTHROPIC_API_KEY not configured"})}\n\n'
        return

    try:
        import anthropic  # lazy import — only needed when DD is used

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        system = build_system_prompt()

        input_tokens = 0
        output_tokens = 0

        with client.messages.stream(
            model=DD_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield f'data: {json.dumps({"type": "token", "content": text})}\n\n'

            usage = stream.get_final_message().usage
            input_tokens = usage.input_tokens
            output_tokens = usage.output_tokens

        yield f'data: {json.dumps({"type": "done", "input_tokens": input_tokens, "output_tokens": output_tokens})}\n\n'

    except Exception as exc:
        yield f'data: {json.dumps({"type": "error", "message": str(exc)})}\n\n'


def _build_report_messages(ticker: str) -> list[dict]:
    conn = get_connection()
    try:
        fundamentals = fetch_fundamentals(ticker, conn)
        price_stats = _fetch_price_stats(conn, ticker)
    finally:
        conn.close()

    prompt = build_report_prompt(ticker, fundamentals, price_stats)
    return [{"role": "user", "content": prompt}]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/api/dd/report")
async def dd_report(req: DDReportRequest) -> StreamingResponse:
    if not ANTHROPIC_API_KEY:
        async def _no_key():
            yield f'data: {json.dumps({"type": "error", "message": "ANTHROPIC_API_KEY not configured"})}\n\n'
        return StreamingResponse(_no_key(), media_type="text/event-stream")

    messages = await asyncio.to_thread(_build_report_messages, req.ticker.upper())

    return StreamingResponse(
        _stream_anthropic(messages, DD_MAX_TOKENS),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/api/dd/chat")
async def dd_chat(req: DDChatRequest) -> StreamingResponse:
    if not ANTHROPIC_API_KEY:
        async def _no_key():
            yield f'data: {json.dumps({"type": "error", "message": "ANTHROPIC_API_KEY not configured"})}\n\n'
        return StreamingResponse(_no_key(), media_type="text/event-stream")

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    return StreamingResponse(
        _stream_anthropic(messages, DD_CHAT_MAX_TOKENS),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
