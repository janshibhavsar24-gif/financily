# Financily — Technical Specifications

**Version:** 1.0
**Date:** 2026-02-19
**Source:** Derived from `vision.md` + architectural decisions

---

## 1. Product Summary

A self-hosted quantitative investment engine for DIY investors with $500K–$1M capital.
Core output: given a return target + time horizon, compute the minimum risk portfolio that can plausibly hit that target — and make the risk cost explicit.

**Primary question the system answers:**

> "If I target 30% annualized return over 3 years, what is the minimum drawdown risk I must accept, and what portfolio achieves it?"

---

## 2. Architectural Decisions

| Dimension | Decision | Rationale |
|---|---|---|
| Forecasting (v1) | Classical: Rolling mean + GARCH volatility + factor model | Interpretable, testable, sufficient for v1 |
| Forecasting (v2) | Add HMM regime layer on top of v1 | Regime-conditioned forecasts without v1 rewrite |
| Risk objective | Max drawdown minimization | Most intuitive risk metric for retail investors |
| Risk metrics (secondary) | Volatility, CVaR, VaR (all computed, not optimized) | Full transparency on the risk landscape |
| Regime awareness | Deferred to v2 | Faster path to working engine |
| Tax model | Annual rebalancing with STCG/LTCG split | Realistic for active DIY investors |
| Data sources | Yahoo Finance (prices), FRED (macro) | Free, reliable, sufficient |
| Storage | DuckDB | Fast analytical queries, zero-config, local |
| Backend | Python + FastAPI | Quant ecosystem, async-ready |
| Frontend | Vite + React + TypeScript + Tailwind CSS | Functional over aesthetic |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        Frontend (React)                  │
│  - Asset universe selector                               │
│  - Return target + time horizon inputs                   │
│  - Portfolio output: weights, metrics, risk cost table   │
│  - "Sync Data" button                                    │
└─────────────────────┬────────────────────────────────────┘
                      │ HTTP (REST)
┌─────────────────────▼────────────────────────────────────┐
│                   FastAPI Backend                        │
│                                                          │
│  /api/sync          — fetch + store price/macro data     │
│  /api/optimize      — run full engine pipeline           │
│  /api/assets        — list available assets              │
│  /api/forecast      — return forecasts only              │
│  /api/risk          — risk metrics for given portfolio   │
└────────┬─────────────────────────────────────────────────┘
         │
┌────────▼─────────────────────────────────────────────────┐
│                    Quant Engine (Python)                  │
│                                                          │
│  DataLayer        → fetch, store, retrieve OHLCV + macro │
│  ReturnForecaster → per-asset forward return estimates   │
│  RiskEngine       → covariance, drawdown, CVaR, VaR      │
│  Optimizer        → max-drawdown-minimization under      │
│                     return constraint                    │
│  TaxAdjuster      → post-tax return estimate             │
│  ReportBuilder    → assemble final output payload        │
└────────┬─────────────────────────────────────────────────┘
         │
┌────────▼─────────────────────────────────────────────────┐
│                     DuckDB (local)                       │
│  prices, returns, macro_indicators, portfolio_runs       │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Data Layer

### 4.1 Sources

| Data | Source | Method |
|---|---|---|
| Equity / ETF / Bond OHLCV | Yahoo Finance | `yfinance` library |
| Risk-free rate | FRED (`DGS3MO`, `DGS1`) | `fredapi` or direct FRED API |
| Macro indicators (optional v2) | FRED | Same |

### 4.2 DuckDB Schema

```sql
-- Adjusted daily closes per asset
CREATE TABLE prices (
    ticker      VARCHAR,
    date        DATE,
    close       DOUBLE,
    adj_close   DOUBLE,
    volume      BIGINT,
    PRIMARY KEY (ticker, date)
);

-- Pre-computed log returns
CREATE TABLE daily_returns (
    ticker  VARCHAR,
    date    DATE,
    ret     DOUBLE,   -- log return
    PRIMARY KEY (ticker, date)
);

-- FRED series
CREATE TABLE macro_series (
    series_id   VARCHAR,
    date        DATE,
    value       DOUBLE,
    PRIMARY KEY (series_id, date)
);

-- Audit log for each optimize run
CREATE TABLE portfolio_runs (
    run_id          VARCHAR PRIMARY KEY,
    run_at          TIMESTAMP,
    tickers         JSON,
    target_return   DOUBLE,
    horizon_years   INTEGER,
    tax_rate_st     DOUBLE,
    tax_rate_lt     DOUBLE,
    result          JSON    -- full output payload stored as JSON
);
```

### 4.3 Sync Behavior

- Triggered manually via "Sync Data" button or `POST /api/sync`
- Fetches trailing 10 years of daily OHLCV for all tickers in the asset universe
- Upserts into DuckDB (no duplicates)
- Sync is incremental: only fetches from last stored date forward

---

## 5. Forecasting Engine (v1 — Classical)

### 5.1 Per-Asset Return Forecast

For each asset `i`, estimate forward annualized expected return `μ_i` using:

**Step 1 — Historical base return**
```
μ_hist = mean(log daily returns) × 252
```

**Step 2 — GARCH(1,1) volatility forecast**
- Fit GARCH(1,1) on trailing 3-year daily return series using `arch` library
- Produces forward volatility estimate `σ_i`
- Used in risk engine, not directly in μ

**Step 3 — Shrinkage toward market mean**
- Apply James-Stein shrinkage to reduce estimation error:
```
μ_shrunk = (1 - λ) × μ_hist + λ × μ_market
```
- `λ = 0.3` (configurable)
- `μ_market` = SPY historical mean over same window

**Step 4 — Risk premium adjustment**
```
μ_i = μ_shrunk_i - risk_free_rate
```
- `risk_free_rate` = latest 3-month T-bill from FRED

**Output:** vector `μ` of expected excess returns per asset

### 5.2 Covariance Estimation

- Compute sample covariance matrix `Σ` from trailing 3-year daily returns
- Apply Ledoit-Wolf shrinkage to produce `Σ_shrunk` (reduces noise in high-dimensional portfolios)
- Use `sklearn.covariance.LedoitWolf` or manual implementation

### 5.3 v2 Regime Layer (deferred)

When implemented:
- Fit 2-state HMM (low-vol regime, high-vol regime) on SPY returns using `hmmlearn`
- Identify current regime
- Compute regime-conditional `μ` and `Σ` separately
- Weight forecast by regime transition probabilities

---

## 6. Risk Engine

All metrics computed for any given portfolio weight vector `w`.

### 6.1 Metrics Computed

| Metric | Formula / Method | Priority |
|---|---|---|
| **Max Drawdown** | Simulated on historical returns with weights `w` | Primary (optimization objective) |
| **Annualized Volatility** | `sqrt(w' Σ w × 252)` | Secondary |
| **VaR (95%, 1-year)** | 5th percentile of Monte Carlo return distribution | Secondary |
| **CVaR (95%, 1-year)** | Mean of bottom 5% of Monte Carlo distribution | Secondary |
| **Expected Annual Return** | `w' μ × 252` | Output |
| **Sharpe Ratio** | `(E[r] - rf) / σ` | Output |

### 6.2 Max Drawdown Simulation

```
1. Generate N=10,000 simulated annual return paths over horizon H using:
   - Parametric: multivariate normal with (μ, Σ_shrunk)
   - Each path = H annual return draws
2. For each path, compute portfolio cumulative return series
3. Max drawdown = max peak-to-trough decline per path
4. Report: median max drawdown, 95th percentile max drawdown
```

### 6.3 Monte Carlo Parameters

| Parameter | Default | Configurable |
|---|---|---|
| Simulations (N) | 10,000 | Yes |
| Horizon (H) | User input (2–5 years) | Yes |
| Seed | 42 | Yes |

---

## 7. Portfolio Optimizer

### 7.1 Optimization Problem

```
Minimize:    Expected Max Drawdown(w)
Subject to:  w' μ × 252 >= target_return
             sum(w) = 1
             w_i >= 0  (long-only)
             w_i <= max_weight  (default 0.40)
```

### 7.2 Solver

- Use `scipy.optimize.minimize` with SLSQP method
- Objective: 95th-percentile max drawdown from Monte Carlo simulation
- Constraint: annualized expected return >= target
- Bounds: per-asset weight in [0, max_weight]
- Run from 5 random starting points; take minimum objective solution

### 7.3 Risk Cost of Return Target

Compute the **efficient frontier** by sweeping target return from `rf` to `max_feasible_return` in 20 steps:

```
For each target_r in sweep:
    solve optimizer → get w*, drawdown*, volatility*, CVaR*

Output: table of (target_return, min_drawdown, volatility, CVaR)
```

This table is the core insight: the explicit risk cost of each return target.

### 7.4 Feasibility Check

Before running optimizer:
- Check `max(μ) × 252 >= target_return`; if not, return infeasibility error with `max achievable return` in error payload
- Cap target at 95th percentile of historically observed portfolio returns to avoid degenerate solutions

---

## 8. Tax Adjuster

### 8.1 Assumptions

- **Annual rebalancing**: portfolio is rebalanced once per year
- **Holding period rule**: positions held > 1 year are LTCG; rebalancing turnover is STCG
- **Turnover estimate**: computed as sum of absolute weight changes at each rebalance

### 8.2 After-Tax Return

```
turnover = sum(|w_new - w_old|) / 2  (one-way turnover)

pre_tax_return = w' μ × 252

after_tax_return = pre_tax_return
    - (ltcg_portion × pre_tax_return × tax_rate_lt)
    - (stcg_portion × pre_tax_return × tax_rate_st)
```

Where:
- `ltcg_portion = 1 - turnover` (rough estimate)
- `stcg_portion = turnover`

### 8.3 Default Tax Rates

| Rate | Default | User-configurable |
|---|---|---|
| LTCG | 15% | Yes |
| STCG | 37% (top ordinary) | Yes |

### 8.4 Output

Both pre-tax and after-tax expected returns are reported. Optimizer uses **pre-tax** returns (tax is reported as output, not input to optimizer in v1).

---

## 9. API Specification

### `POST /api/sync`

Trigger data sync for a list of tickers.

**Request:**
```json
{
  "tickers": ["SPY", "QQQ", "TLT", "GLD", "BRK-B"],
  "lookback_years": 10
}
```

**Response:**
```json
{
  "status": "ok",
  "tickers_synced": 5,
  "rows_upserted": 12543,
  "latest_date": "2026-02-18"
}
```

---

### `POST /api/optimize`

Run full engine pipeline.

**Request:**
```json
{
  "tickers": ["SPY", "QQQ", "TLT", "GLD"],
  "target_return": 0.20,
  "horizon_years": 3,
  "max_weight": 0.40,
  "tax_rate_lt": 0.15,
  "tax_rate_st": 0.37,
  "n_simulations": 10000
}
```

**Response:**
```json
{
  "run_id": "uuid",
  "feasible": true,
  "optimal_portfolio": {
    "weights": {"SPY": 0.35, "QQQ": 0.25, "TLT": 0.30, "GLD": 0.10},
    "expected_return_pretax": 0.213,
    "expected_return_aftertax": 0.187,
    "volatility": 0.142,
    "sharpe_ratio": 1.21,
    "max_drawdown_median": -0.18,
    "max_drawdown_p95": -0.31,
    "var_95": -0.09,
    "cvar_95": -0.14
  },
  "risk_cost_table": [
    {"target_return": 0.05, "min_drawdown_p95": -0.08, "volatility": 0.07, "cvar_95": -0.04},
    {"target_return": 0.10, "min_drawdown_p95": -0.13, "volatility": 0.09, "cvar_95": -0.07},
    {"target_return": 0.20, "min_drawdown_p95": -0.31, "volatility": 0.14, "cvar_95": -0.14}
  ],
  "forecasts": {
    "SPY":  {"mu": 0.082, "sigma": 0.161},
    "QQQ":  {"mu": 0.114, "sigma": 0.228},
    "TLT":  {"mu": 0.021, "sigma": 0.132},
    "GLD":  {"mu": 0.048, "sigma": 0.153}
  }
}
```

---

### `GET /api/assets`

List tickers with data in local DB.

**Response:**
```json
{
  "assets": [
    {"ticker": "SPY", "name": "SPDR S&P 500 ETF", "latest_date": "2026-02-18", "rows": 2520}
  ]
}
```

---

### `GET /api/risk?tickers=SPY,QQQ&weights=0.6,0.4&horizon_years=3`

Compute risk metrics for an arbitrary portfolio (no optimization).

**Response:** same shape as `optimal_portfolio` block above.

---

## 10. Frontend

### Pages / Views

**1. Asset + Parameters Panel**
- Multi-select asset ticker input (typeahead from `/api/assets`)
- "Sync Data" button → calls `POST /api/sync`
- Target return slider (5%–60%)
- Time horizon selector (2 / 3 / 5 years)
- Tax rate inputs (LTCG / STCG)
- Max single-position weight slider

**2. Results Panel** (appears after optimize run)

*Portfolio weights*: horizontal bar chart of weights

*Key metrics card*:
```
Expected Return (pre-tax):  21.3%
Expected Return (after-tax): 18.7%
Volatility:                 14.2%
Sharpe Ratio:                1.21
Max Drawdown (median):      -18%
Max Drawdown (95th pct):    -31%
CVaR (95%):                 -14%
```

*Risk Cost of Return Table*: tabular view of the efficient frontier sweep — the core product insight

*Per-asset forecast table*: μ and σ for each asset

### Tech Stack
- **Vite + React 18 + TypeScript** — fast dev server, strict typing against API response shapes
- **Tailwind CSS** — utility-first styling, no runtime JS overhead
- **No charting libraries** — use HTML tables and CSS bar charts first; add Recharts only if a chart genuinely requires it
- **No global state library** — React `useState` / `useReducer` is sufficient; all state is local to the session

### Component Structure
```
frontend/
├── src/
│   ├── main.tsx               # React root mount
│   ├── App.tsx                # top-level layout (sidebar + results)
│   ├── api/
│   │   └── client.ts          # typed fetch wrappers for each endpoint
│   ├── types/
│   │   └── api.ts             # TypeScript interfaces mirroring API responses
│   ├── components/
│   │   ├── AssetSelector.tsx  # typeahead multi-select from /api/assets
│   │   ├── ParamForm.tsx      # target return, horizon, tax rates, max weight
│   │   ├── SyncButton.tsx     # calls /api/sync, shows status
│   │   ├── WeightsBar.tsx     # horizontal bar chart of portfolio weights
│   │   ├── MetricsCard.tsx    # key metrics grid
│   │   ├── RiskCostTable.tsx  # efficient frontier table (core insight)
│   │   └── ForecastTable.tsx  # per-asset μ and σ
│   └── hooks/
│       └── useOptimize.ts     # encapsulates /api/optimize call + loading/error state
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### TypeScript API Types (`src/types/api.ts`)
```typescript
export interface AssetInfo {
  ticker: string;
  name: string;
  latest_date: string;
  rows: number;
}

export interface PortfolioMetrics {
  weights: Record<string, number>;
  expected_return_pretax: number;
  expected_return_aftertax: number;
  volatility: number;
  sharpe_ratio: number;
  max_drawdown_median: number;
  max_drawdown_p95: number;
  var_95: number;
  cvar_95: number;
}

export interface RiskCostRow {
  target_return: number;
  min_drawdown_p95: number;
  volatility: number;
  cvar_95: number;
}

export interface AssetForecast {
  mu: number;
  sigma: number;
}

export interface OptimizeResponse {
  run_id: string;
  feasible: boolean;
  optimal_portfolio: PortfolioMetrics;
  risk_cost_table: RiskCostRow[];
  forecasts: Record<string, AssetForecast>;
}

export interface OptimizeRequest {
  tickers: string[];
  target_return: number;
  horizon_years: number;
  max_weight: number;
  tax_rate_lt: number;
  tax_rate_st: number;
  n_simulations: number;
}
```

### Vite Proxy Config
Vite dev server proxies `/api/*` to `http://localhost:8000` to avoid CORS in development:
```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```
FastAPI serves the built `frontend/dist/` folder in production (no separate server needed).

---

## 11. Project Structure

```
financily/
├── backend/
│   ├── main.py                  # FastAPI app + route registration
│   ├── config.py                # constants, defaults, DB path
│   ├── data/
│   │   ├── db.py                # DuckDB connection + schema init
│   │   ├── fetcher.py           # yfinance + FRED fetch logic
│   │   └── sync.py              # upsert logic, incremental sync
│   ├── engine/
│   │   ├── forecaster.py        # GARCH + shrinkage return estimates
│   │   ├── covariance.py        # Ledoit-Wolf covariance
│   │   ├── risk.py              # drawdown, VaR, CVaR, volatility
│   │   ├── optimizer.py         # SLSQP max-drawdown optimizer
│   │   └── tax.py               # after-tax return computation
│   ├── api/
│   │   ├── sync.py              # /api/sync endpoint
│   │   ├── optimize.py          # /api/optimize endpoint
│   │   ├── assets.py            # /api/assets endpoint
│   │   └── risk.py              # /api/risk endpoint
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/client.ts
│   │   ├── types/api.ts
│   │   ├── components/
│   │   │   ├── AssetSelector.tsx
│   │   │   ├── ParamForm.tsx
│   │   │   ├── SyncButton.tsx
│   │   │   ├── WeightsBar.tsx
│   │   │   ├── MetricsCard.tsx
│   │   │   ├── RiskCostTable.tsx
│   │   │   └── ForecastTable.tsx
│   │   └── hooks/useOptimize.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── specs/
│   ├── vision.md
│   └── specs.md
├── data/                        # DuckDB file lives here (gitignored)
│   └── financily.duckdb
└── README.md
```

---

## 12. Dependencies

**Backend (`backend/requirements.txt`)**
```
fastapi>=0.110
uvicorn[standard]>=0.27
duckdb>=0.10
yfinance>=0.2
arch>=6.3           # GARCH models
scikit-learn>=1.4   # LedoitWolf
scipy>=1.12         # optimizer
numpy>=1.26
pandas>=2.2
fredapi>=0.5        # FRED macro data
httpx>=0.27         # async HTTP for FastAPI
```

**Frontend (`frontend/package.json` key deps)**
```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5",
    "vite": "^5",
    "tailwindcss": "^3",
    "autoprefixer": "^10",
    "postcss": "^8",
    "@playwright/test": "^1.44"
  }
}
```

---

## 13. Build Plan

### Phase 1 — Data Foundation
- [ ] DuckDB schema + connection layer
- [ ] `fetcher.py`: Yahoo Finance + FRED pulls
- [ ] `sync.py`: incremental upsert
- [ ] `POST /api/sync` endpoint
- [ ] `GET /api/assets` endpoint

### Phase 2 — Quant Engine
- [ ] `forecaster.py`: historical mean + GARCH + shrinkage
- [ ] `covariance.py`: Ledoit-Wolf
- [ ] `risk.py`: Monte Carlo drawdown, VaR, CVaR, volatility
- [ ] `optimizer.py`: SLSQP under return constraint
- [ ] `tax.py`: STCG/LTCG annual rebalancing model
- [ ] Unit tests for engine modules

### Phase 3 — API Layer
- [ ] `POST /api/optimize` full pipeline
- [ ] `GET /api/risk` for arbitrary weights
- [ ] Error handling: infeasibility, missing data, sync required

### Phase 4 — Frontend
- [ ] Scaffold Vite + React + TypeScript + Tailwind
- [ ] Install Playwright, configure `playwright.config.ts`, install Chromium
- [ ] `src/types/api.ts`: TypeScript interfaces for all API shapes
- [ ] `src/api/client.ts`: typed fetch wrappers
- [ ] `AssetSelector` + `ParamForm` + `SyncButton` (with `data-testid` attributes)
- [ ] `useOptimize` hook with loading / error states
- [ ] `WeightsBar`, `MetricsCard`, `RiskCostTable`, `ForecastTable` (with `data-testid` attributes)
- [ ] `e2e/mocks/api.ts`: mock response factories + `setupApiMocks` helper
- [ ] `e2e/app.spec.ts`: full user journey tests (5 tests)
- [ ] `e2e/components.spec.ts`: error states + edge cases (6 tests)
- [ ] FastAPI serves `frontend/dist/` as static files

### Phase 5 — v2 Regime Layer (future)
- [ ] `hmmlearn` HMM on SPY returns
- [ ] Regime-conditional μ and Σ
- [ ] Regime-weighted forecast blending
- [ ] "Current regime" indicator in UI

---

## 14. Key Design Invariants

1. **No cloud.** Everything runs on local Mac. No external API calls except data sync.
2. **No paid data.** Only Yahoo Finance and FRED.
3. **Optimizer operates pre-tax.** Tax is a reporting output, not an optimization input (v1).
4. **Long-only, no leverage.** All weights in [0, 1], sum to 1.
5. **Drawdown is the primary risk metric.** It is what is minimized; all other risk metrics are informational.
6. **Risk cost table is mandatory output.** Every optimize run produces the full efficient frontier sweep, not just the single optimal portfolio.
7. **Shrinkage everywhere.** Both returns (James-Stein) and covariance (Ledoit-Wolf) use shrinkage estimators — raw sample estimates are not used directly.
