from __future__ import annotations


def build_system_prompt() -> str:
    return """\
You are a senior equity research analyst with deep expertise in fundamental analysis.

Your job is to produce a thorough, honest, and well-structured due diligence report.

Rules:
- Use the exact 8-category framework provided. Do not skip any category.
- If a data point is missing or unavailable, state that explicitly rather than guessing.
- Be direct: give a clear opinion at the end, not just a list of pros and cons.
- Format using markdown: ## for section headers, **bold** for key metrics, bullet lists.
- At the end, produce a scoring table (1–5 per category) and a weighted composite score.
- The final section must answer: "If revenue drops 30%, does this company survive?"

8-Category Framework (always follow this exact structure):
1. Business Quality (15%) — What does it do? Revenue model? Segment mix?
2. Financial Strength (20%) — Total debt, cash, D/E ratio, current ratio
3. Profitability (20%) — Gross/operating/net margin, ROE
4. Growth (20%) — Revenue CAGR, EPS growth, FCF growth
5. Valuation (15%) — P/E, forward P/E, PEG, P/FCF
6. Risk (10%) — Beta, max drawdown, revenue concentration
7. Competitive Position — Competitors, market share, moat type
8. Catalysts — Earnings date, product launches, insider activity

Scoring table format (at the end):
| Category | Weight | Score (1–5) | Weighted |
|---|---|---|---|
| Financial Strength | 20% | ? | ? |
...
| **Composite** | | | **?.?** |"""


def build_context_block(fundamentals: dict, price_stats: dict) -> str:
    """Format the data payload as a readable markdown table for the prompt."""

    def fmt(val: object, pct: bool = False, billions: bool = False) -> str:
        if val is None:
            return "N/A"
        if billions and isinstance(val, (int, float)):
            return f"${val / 1e9:.2f}B"
        if pct and isinstance(val, (int, float)):
            return f"{val * 100:.1f}%"
        if isinstance(val, float):
            return f"{val:.2f}"
        return str(val)

    rows_fund = [
        ("Company", fmt(fundamentals.get("longName"))),
        ("Sector / Industry", f"{fmt(fundamentals.get('sector'))} / {fmt(fundamentals.get('industry'))}"),
        ("Country", fmt(fundamentals.get("country"))),
        ("Employees", fmt(fundamentals.get("fullTimeEmployees"))),
        ("Market Cap", fmt(fundamentals.get("marketCap"), billions=True)),
        ("P/E (TTM)", fmt(fundamentals.get("trailingPE"))),
        ("Forward P/E", fmt(fundamentals.get("forwardPE"))),
        ("PEG Ratio", fmt(fundamentals.get("pegRatio"))),
        ("Price / Book", fmt(fundamentals.get("priceToBook"))),
        ("EV / EBITDA", fmt(fundamentals.get("enterpriseToEbitda"))),
        ("Gross Margin", fmt(fundamentals.get("grossMargins"), pct=True)),
        ("Operating Margin", fmt(fundamentals.get("operatingMargins"), pct=True)),
        ("Net Margin", fmt(fundamentals.get("profitMargins"), pct=True)),
        ("ROE", fmt(fundamentals.get("returnOnEquity"), pct=True)),
        ("ROA", fmt(fundamentals.get("returnOnAssets"), pct=True)),
        ("Revenue Growth (YoY)", fmt(fundamentals.get("revenueGrowth"), pct=True)),
        ("Earnings Growth (YoY)", fmt(fundamentals.get("earningsGrowth"), pct=True)),
        ("Total Debt", fmt(fundamentals.get("totalDebt"), billions=True)),
        ("Total Cash", fmt(fundamentals.get("totalCash"), billions=True)),
        ("Debt / Equity", fmt(fundamentals.get("debtToEquity"))),
        ("Current Ratio", fmt(fundamentals.get("currentRatio"))),
        ("Quick Ratio", fmt(fundamentals.get("quickRatio"))),
        ("Free Cash Flow", fmt(fundamentals.get("freeCashflow"), billions=True)),
        ("Operating Cash Flow", fmt(fundamentals.get("operatingCashflow"), billions=True)),
        ("Beta", fmt(fundamentals.get("beta"))),
        ("Dividend Yield", fmt(fundamentals.get("dividendYield"), pct=True)),
        ("EPS (TTM)", fmt(fundamentals.get("trailingEps"))),
        ("EPS (Forward)", fmt(fundamentals.get("forwardEps"))),
        ("Next Earnings Date", fmt(fundamentals.get("nextEarningsDate"))),
        ("Analyst Consensus", f"{fmt(fundamentals.get('recommendationKey'))} ({fmt(fundamentals.get('recommendationMean'))}/5)"),
        ("# Analyst Opinions", fmt(fundamentals.get("numberOfAnalystOpinions"))),
    ]

    fund_table = "| Metric | Value |\n|---|---|\n"
    fund_table += "\n".join(f"| {k} | {v} |" for k, v in rows_fund)

    rows_price = [
        ("Data History", f"{price_stats.get('history_years', 'N/A'):.1f} years" if isinstance(price_stats.get('history_years'), float) else "N/A"),
        ("Data Quality Score", fmt(price_stats.get("quality_score"))),
        ("1Y Annualised Return", fmt(price_stats.get("annualised_return_1y"), pct=True)),
        ("3Y Annualised Return", fmt(price_stats.get("annualised_return_3y"), pct=True)),
        ("1Y Volatility (annualised)", fmt(price_stats.get("annualised_volatility_1y"), pct=True)),
        ("3Y Volatility (annualised)", fmt(price_stats.get("annualised_volatility_3y"), pct=True)),
        ("3Y Max Drawdown", fmt(price_stats.get("max_drawdown_3y"), pct=True)),
    ]

    price_table = "| Metric | Value |\n|---|---|\n"
    price_table += "\n".join(f"| {k} | {v} |" for k, v in rows_price)

    return f"### Fundamentals (from Yahoo Finance)\n\n{fund_table}\n\n### Price Statistics (from local data)\n\n{price_table}"


def build_report_prompt(ticker: str, fundamentals: dict, price_stats: dict) -> str:
    context = build_context_block(fundamentals, price_stats)
    return f"""\
## Data Available for {ticker.upper()}

{context}

---

Please produce a full due diligence report on **{ticker.upper()}** using the 8-category framework.
Cover every category even if data is missing. End with the scoring table and the 30%-revenue-drop stress test."""
