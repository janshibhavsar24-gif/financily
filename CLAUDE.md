# Financily

Self-hosted quantitative investment risk engine. Given a return target + time horizon, computes the minimum-drawdown portfolio and makes the risk cost explicit. No cloud, no paid data, local Mac only.

Full specs: `specs/specs.md` | Requirements: `specs/requirements.md` | Tasks: `specs/implementation-plan.md`

---

## Commands

```bash
# Setup (one-time)
pip install -e ".[dev]"          # installs Python deps + financily CLI
cd frontend && npm install       # installs Node deps + Playwright

# Daily dev
financily dev                    # backend :8000 (hot-reload) + frontend :5173 (HMR) concurrently
financily start                  # build frontend → serve everything from FastAPI :8000
financily start --skip-build     # skip npm build if dist/ is fresh

# Testing
financily test                   # pytest + Playwright
financily test --no-e2e          # pytest only
financily test --no-backend      # Playwright only
cd frontend && npm run test:e2e:ui  # Playwright with interactive UI

# Build
financily build                  # compile React → frontend/dist/
```

---

## Architecture

Monorepo: `backend/` (Python/FastAPI) + `frontend/` (React/TS), coordinated by `cli.py`.

```
cli.py                  → typer CLI: dev / build / start / test
pyproject.toml          → installs `financily` shell command (pip install -e ".[dev]")
.env / .env.example     → all config (DB_PATH, N_SIMULATIONS, tax rates, ports, ...)
data/financily.duckdb   → local DuckDB file (gitignored)

backend/
  main.py               → FastAPI app + lifespan (init_schema) + router registration
  config.py             → all env-var defaults — import from here, never hardcode
  data/
    db.py               → get_connection() + init_schema()
    fetcher.py          → yfinance OHLCV + FRED rate pulls (sync only, no streaming)
    sync.py             → incremental upsert: prices + daily_returns tables
  engine/               → pure quant functions, no FastAPI imports
    forecaster.py       → GARCH(1,1) + James-Stein shrinkage → μ vector + σ per asset
    covariance.py       → Ledoit-Wolf shrinkage → annualised Σ matrix
    risk.py             → Monte Carlo → max drawdown distribution, VaR, CVaR, Sharpe
    optimizer.py        → SLSQP min-drawdown under return constraint, frontier sweep
    tax.py              → annual rebalancing STCG/LTCG after-tax return
  api/                  → thin FastAPI routers, delegate everything to engine/
    sync.py             → POST /api/sync
    optimize.py         → POST /api/optimize  (full pipeline)
    assets.py           → GET  /api/assets
    risk.py             → GET  /api/risk
  tests/
    fixtures/           → CSV return data for unit tests (no live API calls)
    test_engine.py      → unit tests for engine/ modules
    test_api.py         → integration tests via FastAPI TestClient

frontend/
  src/types/api.ts      → TypeScript interfaces — single source of truth for API shapes
  src/api/client.ts     → typed fetch wrappers + ApiError class
  src/hooks/
    useOptimize.ts      → optimize lifecycle: loading / result / error states
  src/App.tsx           → two-panel layout, owns selectedTickers + optimizeRequest state
  src/components/       → 7 presentational components (no state, no API calls)
    AssetSelector.tsx   → typeahead multi-select, chips with data-testid="chip-{TICKER}"
    SyncButton.tsx      → idle → syncing → success/error
    ParamForm.tsx       → sliders, button group, selects for all optimizer params
    WeightsBar.tsx      → CSS horizontal bars, data-testid="weight-bar-{TICKER}"
    MetricsCard.tsx     → 2-col grid, data-testid="metric-{field}", en-dash for negatives
    RiskCostTable.tsx   → frontier sweep table, data-testid="risk-row-{target_return}"
    ForecastTable.tsx   → per-asset μ and σ table
  e2e/
    mocks/api.ts        → setupApiMocks() helper + mock response factories
    app.spec.ts         → 6 user journey tests
    components.spec.ts  → 6 error/edge case tests
```

---

## Locked Architectural Decisions

These are final. Do not propose alternatives.

| Decision | Choice |
|---|---|
| Risk objective | Max drawdown minimization (p95, Monte Carlo) |
| Forecasting v1 | GARCH(1,1) + James-Stein shrinkage toward SPY mean |
| Forecasting v2 | HMM regime layer on top of v1 (not yet built) |
| Covariance | Ledoit-Wolf shrinkage (always, never raw sample covariance) |
| Solver | SLSQP, 5 random starts, long-only, weights sum to 1 |
| Storage | DuckDB at `data/financily.duckdb` |
| Frontend stack | Vite + React 18 + TypeScript strict + Tailwind CSS |
| No charting libs | Tables and CSS bars only (no Recharts, D3, Chart.js) |
| No global state | useState/useReducer only (no Redux, Zustand, Jotai) |
| Tax | Annual rebalancing, STCG/LTCG split, optimizer runs pre-tax |
| Regime awareness | Deferred to v2 |

---

## Back-Pressure Rules

Things that must never happen without an explicit user instruction:

- **No cloud.** No external services except yfinance/FRED during sync.
- **No real-time.** No WebSockets, no scheduled background tasks, no SSE.
- **No paid APIs.** Yahoo Finance and FRED only.
- **No charting libraries** in frontend — CSS bars + HTML tables only.
- **No global state libraries** — React built-ins only.
- **No `any` in TypeScript** — strict mode is on.
- **No live network calls in tests** — fixtures + monkeypatch in backend; `page.route()` in Playwright.
- **No blocking in the FastAPI event loop** — all engine work goes in `asyncio.to_thread`.
- **No extra error handling** for scenarios that cannot occur.
- **No scope creep** — do not add features, refactors, or "improvements" beyond the task.

---

## DuckDB Schema (quick reference)

```
prices          (ticker, date PK) — adj_close, close, volume
daily_returns   (ticker, date PK) — ret (log return)
macro_series    (series_id, date PK) — value
portfolio_runs  (run_id PK) — tickers JSON, target_return, result JSON
```

---

## Key Config Variables (from `backend/config.py`)

```python
DB_PATH              # path to financily.duckdb
LOOKBACK_YEARS       # 10  — history fetched per ticker
GARCH_WINDOW_YEARS   # 3   — window for GARCH fit + covariance
SHRINKAGE_LAMBDA     # 0.3 — James-Stein intensity
MARKET_TICKER        # "SPY"
RISK_FREE_SERIES     # "DGS3MO"
N_SIMULATIONS        # 10_000
RANDOM_SEED          # 42
MAX_WEIGHT           # 0.40
FRONTIER_STEPS       # 20
DEFAULT_TAX_RATE_LT  # 0.15
DEFAULT_TAX_RATE_ST  # 0.37
```
