# Test Fixtures

CSV files of pre-computed daily log returns used in backend unit and integration tests.

## Rules

- Never call `yfinance.download` or any FRED API inside tests — use these fixtures instead.
- Each CSV must have columns: `date`, and one column per ticker (e.g. `SPY`, `QQQ`, `TLT`).
- Dates are ISO format (`YYYY-MM-DD`), values are log returns (not prices).
- Minimum 60 rows required (engine guard). Aim for ~750 rows (~3 years).

## Files

- `returns_spy_qqq_tlt.csv` — 3 years of daily log returns for SPY, QQQ, TLT.
  Used by: `test_engine.py::test_full_pipeline_spy_qqq_tlt`

## Generating fixtures

Fixtures are generated once from real data and committed.
To regenerate (requires internet):

```python
import yfinance as yf, numpy as np, pandas as pd

tickers = ["SPY", "QQQ", "TLT"]
prices = yf.download(tickers, start="2021-01-01", end="2024-01-01", auto_adjust=True)["Close"]
returns = np.log(prices / prices.shift(1)).dropna()
returns.to_csv("backend/tests/fixtures/returns_spy_qqq_tlt.csv")
```
