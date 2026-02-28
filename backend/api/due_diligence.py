from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

import anthropic
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.config import ANTHROPIC_API_KEY, DD_CHAT_MAX_TOKENS, DD_MAX_TOKENS, DD_MODEL
from backend.data.db import get_connection
from backend.data.fundamentals import fetch_fundamentals
from backend.engine.analyst import build_report_prompt, build_system_prompt

router = APIRouter()


class DDReportRequest(BaseModel):
    ticker: str


class ChatMessage(BaseModel):
    role: str   # 'user' | 'assistant'
    content: str


class DDChatRequest(BaseModel):
    ticker: str
    messages: list[ChatMessage]


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _get_price_stats(ticker: str) -> dict:
    """Query DuckDB for price statistics used to enrich the DD prompt."""
    conn = get_connection()
    try:
        upper = ticker.upper()

        # Quality score + history
        aq_row = conn.execute(
            "SELECT quality_score, history_years FROM asset_quality WHERE ticker = ?",
            [upper],
        ).fetchone()

        stats: dict = {
            "quality_score": aq_row[0] if aq_row else None,
            "history_years": aq_row[1] if aq_row else None,
        }

        # Need at least 252 rows for any meaningful stats
        count_row = conn.execute(
            "SELECT COUNT(*) FROM daily_returns WHERE ticker = ?", [upper]
        ).fetchone()
        n_rows = count_row[0] if count_row else 0

        if n_rows >= 30:
            # 1Y stats (~252 trading days)
            ret_1y = conn.execute(
                """
                SELECT AVG(ret), STDDEV(ret)
                FROM daily_returns
                WHERE ticker = ?
                  AND date >= (SELECT MAX(date) - INTERVAL 1 YEAR FROM daily_returns WHERE ticker = ?)
                """,
                [upper, upper],
            ).fetchone()
            if ret_1y and ret_1y[0] is not None:
                stats["annualised_return_1y"] = float(ret_1y[0]) * 252
                stats["annualised_volatility_1y"] = float(ret_1y[1]) * (252 ** 0.5) if ret_1y[1] else None

            # 3Y stats
            ret_3y = conn.execute(
                """
                SELECT AVG(ret), STDDEV(ret)
                FROM daily_returns
                WHERE ticker = ?
                  AND date >= (SELECT MAX(date) - INTERVAL 3 YEAR FROM daily_returns WHERE ticker = ?)
                """,
                [upper, upper],
            ).fetchone()
            if ret_3y and ret_3y[0] is not None:
                stats["annualised_return_3y"] = float(ret_3y[0]) * 252
                stats["annualised_volatility_3y"] = float(ret_3y[1]) * (252 ** 0.5) if ret_3y[1] else None

            # Max drawdown (3Y) — approximate via cumulative returns
            prices_row = conn.execute(
                """
                SELECT date, ret FROM daily_returns
                WHERE ticker = ?
                  AND date >= (SELECT MAX(date) - INTERVAL 3 YEAR FROM daily_returns WHERE ticker = ?)
                ORDER BY date ASC
                """,
                [upper, upper],
            ).fetchall()
            if prices_row:
                import math
                cum = 1.0
                peak = 1.0
                worst_dd = 0.0
                for _, r in prices_row:
                    cum *= math.exp(r)
                    if cum > peak:
                        peak = cum
                    dd = (cum - peak) / peak
                    if dd < worst_dd:
                        worst_dd = dd
                stats["max_drawdown_3y"] = worst_dd
    finally:
        conn.close()

    return stats


async def _stream_report(ticker: str) -> AsyncGenerator[str, None]:
    if not ANTHROPIC_API_KEY:
        yield _sse({"type": "error", "message": "ANTHROPIC_API_KEY not configured"})
        return

    # Fetch fundamentals + price stats concurrently
    conn = get_connection()
    try:
        fundamentals, price_stats = await asyncio.gather(
            asyncio.to_thread(fetch_fundamentals, ticker, conn),
            asyncio.to_thread(_get_price_stats, ticker),
        )
    finally:
        conn.close()

    system = build_system_prompt()
    user_msg = build_report_prompt(ticker, fundamentals, price_stats)

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    try:
        async with client.messages.stream(
            model=DD_MODEL,
            max_tokens=DD_MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        ) as stream:
            async for text in stream.text_stream:
                yield _sse({"type": "token", "content": text})
            usage = (await stream.get_final_message()).usage
            yield _sse({
                "type": "done",
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
            })
    except anthropic.APIError as exc:
        yield _sse({"type": "error", "message": f"Anthropic API error: {exc}"})
    except Exception as exc:
        yield _sse({"type": "error", "message": str(exc)})


async def _stream_chat(messages: list[dict]) -> AsyncGenerator[str, None]:
    if not ANTHROPIC_API_KEY:
        yield _sse({"type": "error", "message": "ANTHROPIC_API_KEY not configured"})
        return

    system = build_system_prompt()
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    try:
        async with client.messages.stream(
            model=DD_MODEL,
            max_tokens=DD_CHAT_MAX_TOKENS,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield _sse({"type": "token", "content": text})
            yield _sse({"type": "done"})
    except anthropic.APIError as exc:
        yield _sse({"type": "error", "message": f"Anthropic API error: {exc}"})
    except Exception as exc:
        yield _sse({"type": "error", "message": str(exc)})


@router.post("/api/dd/report")
async def dd_report(req: DDReportRequest):
    if not ANTHROPIC_API_KEY:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    return StreamingResponse(
        _stream_report(req.ticker),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/dd/chat")
async def dd_chat(req: DDChatRequest):
    if not ANTHROPIC_API_KEY:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    return StreamingResponse(
        _stream_chat(messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
