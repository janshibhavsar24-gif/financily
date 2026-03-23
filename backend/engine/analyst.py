from __future__ import annotations

from typing import Optional


_SYSTEM_PROMPT = """\
You are a senior equity research analyst with deep expertise in fundamental analysis.

Your job is to produce a thorough, honest, and well-structured due diligence report.

Rules:
- Use the exact 8-category framework provided. Do not skip any category.
- If a data point is missing or unavailable, state that explicitly rather than guessing.
- Be direct: give a clear opinion at the end, not just a list of pros and cons.
- Format using markdown: ## for section headers, **bold** for key metrics, bullet lists.
- At the end, produce a scoring table (1–5 per category) and a weighted composite score.
- The final section must answer: "If revenue drops 30%, does this company survive?"
"""

_FRAMEWORK = """\
8-Category Due Diligence Framework:
1. Business Quality (15%) — What does it do? Revenue model? Segment mix?
2. Financial Strength (20%) — Total debt, cash, D/E ratio, current ratio
3. Profitability (20%) — Gross / operating / net margin, ROE
4. Growth (20%) — Revenue CAGR (5Y), EPS growth, FCF growth
5. Valuation (15%) — P/E, forward P/E, PEG, P/FCF
6. Risk (10%) — Beta, max drawdown, revenue concentration
7. Competitive Position — Competitors, market share, moat type
8. Catalysts — Next earnings date, product launches, insider activity

Scoring model:
Category | Weight
Financial Strength | 20%
Profitability | 20%
Growth | 20%
Valuation | 15%
Risk | 10%
Business Quality | 15%
Catalysts | — (qualitative)
"""


def build_system_prompt() -> str:
    return _SYSTEM_PROMPT


def build_context_block(fundamentals: dict, price_stats: dict) -> str:
    """Format the data payload as readable markdown tables for the prompt."""

    def _fmt(v: object) -> str:
        if v is None:
            return "N/A"
        if isinstance(v, float):
            if abs(v) < 1e9:
                return f"{v:,.2f}"
            return f"{v:,.0f}"
        return str(v)

    def _pct(v: object) -> str:
        if v is None:
            return "N/A"
        try:
            return f"{float(v) * 100:.1f}%"
        except (TypeError, ValueError):
            return str(v)

    def _big(v: object) -> str:
        if v is None:
            return "N/A"
        try:
            n = float(v)
            if abs(n) >= 1e12:
                return f"${n / 1e12:.2f}T"
            if abs(n) >= 1e9:
                return f"${n / 1e9:.2f}B"
            if abs(n) >= 1e6:
                return f"${n / 1e6:.2f}M"
            return f"${n:,.0f}"
        except (TypeError, ValueError):
            return str(v)

    rows_fund = [
        ("Company", fundamentals.get("longName")),
        ("Sector", fundamentals.get("sector")),
        ("Industry", fundamentals.get("industry")),
        ("Country", fundamentals.get("country")),
        ("Market Cap", _big(fundamentals.get("marketCap"))),
        ("P/E (TTM)", _fmt(fundamentals.get("trailingPE"))),
        ("Forward P/E", _fmt(fundamentals.get("forwardPE"))),
        ("PEG Ratio", _fmt(fundamentals.get("pegRatio"))),
        ("P/Book", _fmt(fundamentals.get("priceToBook"))),
        ("EV/EBITDA", _fmt(fundamentals.get("enterpriseToEbitda"))),
        ("Gross Margin", _pct(fundamentals.get("grossMargins"))),
        ("Operating Margin", _pct(fundamentals.get("operatingMargins"))),
        ("Net Margin", _pct(fundamentals.get("profitMargins"))),
        ("ROE", _pct(fundamentals.get("returnOnEquity"))),
        ("ROA", _pct(fundamentals.get("returnOnAssets"))),
        ("Revenue Growth (YoY)", _pct(fundamentals.get("revenueGrowth"))),
        ("EPS Growth (YoY)", _pct(fundamentals.get("earningsGrowth"))),
        ("Total Debt", _big(fundamentals.get("totalDebt"))),
        ("Total Cash", _big(fundamentals.get("totalCash"))),
        ("Debt/Equity", _fmt(fundamentals.get("debtToEquity"))),
        ("Current Ratio", _fmt(fundamentals.get("currentRatio"))),
        ("Quick Ratio", _fmt(fundamentals.get("quickRatio"))),
        ("Free Cash Flow", _big(fundamentals.get("freeCashflow"))),
        ("Beta", _fmt(fundamentals.get("beta"))),
        ("Dividend Yield", _pct(fundamentals.get("dividendYield"))),
        ("Trailing EPS", _fmt(fundamentals.get("trailingEps"))),
        ("Forward EPS", _fmt(fundamentals.get("forwardEps"))),
        ("Analyst Rating", fundamentals.get("recommendationKey")),
        ("# Analysts", fundamentals.get("numberOfAnalystOpinions")),
        ("Next Earnings", fundamentals.get("nextEarningsDate")),
    ]

    fund_table = "| Metric | Value |\n|---|---|\n"
    fund_table += "\n".join(f"| {k} | {v if v is not None else 'N/A'} |" for k, v in rows_fund)

    rows_price = [
        ("History", f"{price_stats.get('history_years', 'N/A')} years"),
        ("Data Quality", _fmt(price_stats.get("quality_score"))),
        ("1Y Annualised Return", _pct(price_stats.get("annualised_return_1y"))),
        ("3Y Annualised Return", _pct(price_stats.get("annualised_return_3y"))),
        ("1Y Volatility", _pct(price_stats.get("annualised_volatility_1y"))),
        ("3Y Volatility", _pct(price_stats.get("annualised_volatility_3y"))),
        ("3Y Max Drawdown", _pct(price_stats.get("max_drawdown_3y"))),
    ]
    price_table = "| Metric | Value |\n|---|---|\n"
    price_table += "\n".join(f"| {k} | {v} |" for k, v in rows_price)

    return f"### Fundamentals (from Yahoo Finance)\n{fund_table}\n\n### Price Statistics (from local data)\n{price_table}"


def build_report_prompt(ticker: str, fundamentals: dict, price_stats: dict) -> str:
    context = build_context_block(fundamentals, price_stats)
    return (
        f"## Data Available for {ticker.upper()}\n\n"
        f"{context}\n\n"
        f"---\n\n"
        f"{_FRAMEWORK}\n\n"
        f"Please produce a full due diligence report on **{ticker.upper()}** using the 8-category framework above. "
        f"Include all available data in your analysis. End with a scoring table and the 30%-revenue-drop stress test."
    )
