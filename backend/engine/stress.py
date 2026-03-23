from __future__ import annotations

from typing import Optional

import duckdb


SCENARIOS = [
    {"name": "2020 COVID Crash", "start": "2020-02-19", "end": "2020-03-23"},
    {"name": "2022 Rate Shock", "start": "2022-01-01", "end": "2022-12-31"},
    {"name": "2018 Q4 Selloff", "start": "2018-10-01", "end": "2018-12-31"},
    {"name": "2015 China Selloff", "start": "2015-08-18", "end": "2015-09-30"},
    {"name": "2022 Crypto Contagion", "start": "2022-05-01", "end": "2022-07-31"},
    {"name": "2023 Regional Banks", "start": "2023-03-08", "end": "2023-05-31"},
    {"name": "2025 AI Correction", "start": "2025-01-01", "end": "2025-04-30"},
    {"name": "2008 GFC", "start": "2008-09-01", "end": "2009-03-31"},
]


def run_stress_tests(
    conn: duckdb.DuckDBPyConnection,
    tickers: list[str],
    weights: list[float],
) -> list[dict]:
    """
    Run 8 historical stress test scenarios using daily_returns in DuckDB.
    Per scenario: compound return per ticker → weighted portfolio loss.
    Skip scenario if coverage < 25% of tickers.
    """
    ph = ", ".join("?" * len(tickers))
    results = []

    for scenario in SCENARIOS:
        rows = conn.execute(
            f"""
            SELECT ticker, EXP(SUM(ret)) - 1 AS compound_return
            FROM daily_returns
            WHERE ticker IN ({ph})
              AND date >= CAST(? AS DATE)
              AND date <= CAST(? AS DATE)
            GROUP BY ticker
            """,
            tickers + [scenario["start"], scenario["end"]],
        ).fetchall()

        if not rows:
            continue

        ticker_returns: dict[str, float] = {r[0]: float(r[1]) for r in rows}
        covered: list[tuple[str, float]] = [
            (t, w) for t, w in zip(tickers, weights) if t in ticker_returns
        ]
        coverage_pct = len(covered) / len(tickers) * 100 if tickers else 0.0

        if coverage_pct < 25:
            continue

        covered_weight = sum(w for _, w in covered)
        portfolio_loss = 0.0
        for t, w in covered:
            normalized_w = w / covered_weight if covered_weight > 0 else 0.0
            portfolio_loss += normalized_w * ticker_returns[t]

        worst_ticker: Optional[str] = None
        worst_loss: Optional[float] = None
        for t, _ in covered:
            ret = ticker_returns[t]
            if worst_loss is None or ret < worst_loss:
                worst_loss = ret
                worst_ticker = t

        results.append({
            "name": scenario["name"],
            "start": scenario["start"],
            "end": scenario["end"],
            "portfolio_loss_pct": round(portfolio_loss * 100, 2),
            "worst_ticker": worst_ticker,
            "worst_loss_pct": round(worst_loss * 100, 2) if worst_loss is not None else None,
            "coverage_pct": round(coverage_pct, 1),
            "tickers_count": len(covered),
        })

    return results
