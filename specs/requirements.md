# Financily — Requirements

**Version:** 1.0
**Date:** 2026-02-19
**Purpose:** Definitive, verifiable requirements for every piece of the system.

Each requirement has a unique ID, a **SHALL** statement (what the system must do), and an **Acceptance Criteria** (how to verify it is met). Requirements are grouped by system area.

Cross-references: `specs.md` (architecture), `implementation-plan.md` (task ordering).

---

## Requirement ID Scheme

| Prefix | Area |
|---|---|
| `SYS` | System-level / platform / constraints |
| `DAT` | Data layer (fetch, storage, sync) |
| `FOR` | Forecasting engine |
| `COV` | Covariance estimation |
| `RSK` | Risk engine |
| `OPT` | Portfolio optimizer |
| `TAX` | Tax model |
| `API` | API layer |
| `FE` | Frontend |
| `TST` | Testing |

---

## 1. System-Level Requirements (SYS)

### SYS-001 — Self-hosted, no cloud
**SHALL** run entirely on a local macOS machine. No computation, storage, or data shall be sent to any external service except to fetch market data during a user-initiated sync.

**Acceptance Criteria:** The application starts and produces results with no internet connection, provided data has previously been synced and stored locally.

---

### SYS-002 — No paid data sources
**SHALL** source all market and macro data exclusively from free public APIs: Yahoo Finance for price data and FRED for macro/rate data.

**Acceptance Criteria:** The system operates correctly with a FRED API key absent, falling back to `yfinance` for rate data. No paid API key is required for any part of normal operation.

---

### SYS-003 — Single-process deployment
**SHALL** run as a single process: `uvicorn backend.main:app`. No separate database server, no message queue, no background worker process is required.

**Acceptance Criteria:** `uvicorn backend.main:app` is the only command needed to run the complete application in production.

---

### SYS-004 — Local storage only
**SHALL** store all data in a single DuckDB file located at a path configurable via environment variable, defaulting to `data/financily.duckdb` relative to the project root.

**Acceptance Criteria:** Deleting the `.duckdb` file and restarting the app re-creates all tables with no manual migration step.

---

### SYS-005 — No real-time data requirement
**SHALL** operate in backward-analysis mode only. No streaming feeds, WebSocket connections, or scheduled background refreshes are required. Data is updated only when the user explicitly triggers a sync.

**Acceptance Criteria:** The application has no cron job, scheduler, or persistent background thread.

---

### SYS-006 — Long-only portfolio constraint
**SHALL** only produce portfolios with non-negative weights that sum to 1.0. Short positions and leverage are not permitted.

**Acceptance Criteria:** All weight vectors produced by the optimizer satisfy `w_i >= 0` and `sum(w) == 1.0 ± 1e-6` for all inputs.

---

### SYS-007 — Performance envelope
**SHALL** complete a full `/api/optimize` call — including Monte Carlo simulation with N=10,000 paths and an efficient frontier sweep of 20 points — in under 30 seconds on an Apple Silicon Mac for a universe of up to 10 assets.

**Acceptance Criteria:** Measured wall-clock time for the above scenario is < 30 seconds. If this is not met, N defaults to 5,000.

---

### SYS-008 — Configuration via environment variables
**SHALL** expose all tuneable defaults (DB path, lookback window, shrinkage lambda, simulation count, tax rates, etc.) as environment variables with sensible hardcoded fallbacks. A `.env` file at the project root shall be loaded automatically at startup.

**Acceptance Criteria:** Running the app with no `.env` file uses correct defaults for all parameters.

---

## 2. Data Layer Requirements (DAT)

### DAT-001 — Price data source
**SHALL** fetch daily OHLCV data for equities, ETFs, and bonds from Yahoo Finance using the `yfinance` library with `auto_adjust=True`.

**Acceptance Criteria:** `fetch_prices(["SPY"], start, end)` returns a DataFrame with columns `ticker`, `date`, `close`, `adj_close`, `volume` and no NaN rows.

---

### DAT-002 — Adjusted close
**SHALL** use split- and dividend-adjusted closing prices (`adj_close`) for all return calculations. Raw unadjusted close is stored but not used in computation.

**Acceptance Criteria:** Log returns computed from `adj_close` are continuous across historical split/dividend events for known tickers (e.g., AAPL post-split shows no jump).

---

### DAT-003 — Risk-free rate source
**SHALL** fetch the 3-month US Treasury bill rate (FRED series `DGS3MO`) as the risk-free rate. If a FRED API key is unavailable, it shall fall back to fetching `^IRX` from Yahoo Finance.

**Acceptance Criteria:** `fetch_risk_free_rate()` returns a positive float between 0.0 and 0.15 under normal market conditions.

---

### DAT-004 — Schema: `prices` table
**SHALL** maintain a `prices` table with primary key `(ticker, date)` containing `ticker VARCHAR`, `date DATE`, `close DOUBLE`, `adj_close DOUBLE`, `volume BIGINT`.

**Acceptance Criteria:** Inserting a duplicate `(ticker, date)` pair replaces the existing row without error.

---

### DAT-005 — Schema: `daily_returns` table
**SHALL** maintain a `daily_returns` table with `ticker VARCHAR`, `date DATE`, `ret DOUBLE` (log return), primary key `(ticker, date)`. Returns are computed as `ln(adj_close_t / adj_close_{t-1})` and populated during every upsert.

**Acceptance Criteria:** After syncing SPY, `SELECT COUNT(*) FROM daily_returns WHERE ticker='SPY'` equals `SELECT COUNT(*) FROM prices WHERE ticker='SPY'` minus 1.

---

### DAT-006 — Schema: `macro_series` table
**SHALL** maintain a `macro_series` table with `series_id VARCHAR`, `date DATE`, `value DOUBLE`, primary key `(series_id, date)`.

**Acceptance Criteria:** After a sync that includes FRED data, `SELECT * FROM macro_series WHERE series_id='DGS3MO' ORDER BY date DESC LIMIT 1` returns a recent row.

---

### DAT-007 — Schema: `portfolio_runs` table
**SHALL** maintain a `portfolio_runs` table recording every optimize call with `run_id VARCHAR` (UUID), `run_at TIMESTAMP`, `tickers JSON`, `target_return DOUBLE`, `horizon_years INTEGER`, `tax_rate_st DOUBLE`, `tax_rate_lt DOUBLE`, `result JSON` (full response payload).

**Acceptance Criteria:** Every successful `/api/optimize` call inserts exactly one row into `portfolio_runs`.

---

### DAT-008 — Incremental sync
**SHALL** perform incremental sync: for each ticker, determine the last stored date and fetch only the gap from `last_date + 1` to today. If no data exists for a ticker, fetch the full lookback window (default 10 years).

**Acceptance Criteria:** Calling sync twice in the same day results in 0 new rows inserted on the second call.

---

### DAT-009 — Upsert semantics
**SHALL** use INSERT OR REPLACE (upsert) semantics when writing to `prices` and `daily_returns`. Re-syncing an existing date range must not produce duplicate rows.

**Acceptance Criteria:** Row count in `prices` for a given ticker is the same before and after re-syncing an already-covered date range.

---

### DAT-010 — Minimum history guard
**SHALL** refuse to run the forecasting or optimization pipeline if fewer than 60 trading days of complete overlapping returns are available for the requested ticker set.

**Acceptance Criteria:** `get_returns_matrix` raises `ValueError` with a descriptive message when fewer than 60 rows remain after requiring full overlap across all tickers.

---

### DAT-011 — Ticker normalisation
**SHALL** normalise all ticker symbols to uppercase before storage or lookup.

**Acceptance Criteria:** `fetch_prices(["spy"], ...)` and `fetch_prices(["SPY"], ...)` produce rows with `ticker = 'SPY'`.

---

## 3. Forecasting Engine Requirements (FOR)

### FOR-001 — Historical mean return
**SHALL** compute the per-asset annualised historical mean log return as `mean(daily_log_returns) × 252` over the trailing GARCH window (default 3 years).

**Acceptance Criteria:** Result is a finite float. For SPY over any 3-year window, the value is within [-0.30, 0.50].

---

### FOR-002 — GARCH(1,1) volatility forecast
**SHALL** fit a GARCH(1,1) model to each asset's trailing 3-year daily return series using the `arch` library and extract the 1-step-ahead conditional volatility forecast, annualised as `σ_daily × √252`.

**Acceptance Criteria:** `fit_garch_volatility(returns)` returns a positive finite float. For SPY, it is within [0.08, 0.60] under normal market conditions.

---

### FOR-003 — GARCH convergence fallback
**SHALL** fall back to the sample standard deviation (`returns.std() × √252`) when the GARCH(1,1) model fails to converge, rather than raising an error.

**Acceptance Criteria:** `fit_garch_volatility` never raises an exception for any non-empty return series, regardless of convergence.

---

### FOR-004 — James-Stein shrinkage
**SHALL** apply James-Stein shrinkage to per-asset historical means, pulling them toward the market mean (SPY mean over the same window):
```
μ_shrunk = (1 - λ) × μ_hist + λ × μ_market
```
where `λ = 0.3` by default and is configurable.

**Acceptance Criteria:** For any asset with `μ_hist > μ_market`, `μ_shrunk` is strictly less than `μ_hist` and strictly greater than `μ_market`.

---

### FOR-005 — Risk-free rate subtraction
**SHALL** subtract the current risk-free rate from each shrunk return estimate to produce excess returns. The risk-free rate is fetched fresh on each optimize call and cached for the duration of that call.

**Acceptance Criteria:** `μ_excess = μ_shrunk - rf`. For `rf = 0.05` and `μ_shrunk = 0.10`, `μ_excess = 0.05`.

---

### FOR-006 — Market ticker always included
**SHALL** always include SPY (`MARKET_TICKER`) in the returns matrix when computing shrinkage, even if SPY is not in the user-requested asset universe. SPY's weight in the output portfolio is 0 if not requested.

**Acceptance Criteria:** `forecast_returns(conn, ["QQQ", "TLT"])` succeeds and returns shrunk estimates without error, even though SPY is not in the ticker list.

---

### FOR-007 — Forecast output shape
**SHALL** return per-asset forecast metadata (`mu`, `sigma`) for every ticker in the request, to be included in the API response for user inspection.

**Acceptance Criteria:** The `forecasts` field in `OptimizeResponse` contains one entry per requested ticker, each with a finite `mu` and positive `sigma`.

---

## 4. Covariance Estimation Requirements (COV)

### COV-001 — Ledoit-Wolf shrinkage
**SHALL** apply Ledoit-Wolf shrinkage to the sample covariance matrix to reduce estimation error, using `sklearn.covariance.LedoitWolf`.

**Acceptance Criteria:** The resulting covariance matrix is symmetric and all eigenvalues are non-negative (positive semi-definite).

---

### COV-002 — Annualisation
**SHALL** annualise the covariance matrix by multiplying by 252.

**Acceptance Criteria:** The diagonal of the annualised covariance matrix equals the square of each asset's annualised volatility (i.e. `Σ[i,i] = σ_i²`).

---

### COV-003 — Positive definiteness enforcement
**SHALL** add a small jitter `1e-8 × I` to the covariance matrix if any eigenvalue is negative after shrinkage, to ensure numerical stability in the optimizer.

**Acceptance Criteria:** All eigenvalues of the final covariance matrix are ≥ 0 before the matrix is passed to the optimizer.

---

### COV-004 — Same window as forecaster
**SHALL** use the same trailing return window for covariance estimation as for return forecasting (default 3 years, same `get_returns_matrix` call).

**Acceptance Criteria:** `ledoit_wolf_covariance` is called with the same DataFrame that `forecast_returns` uses internally.

---

## 5. Risk Engine Requirements (RSK)

### RSK-001 — Monte Carlo path simulation
**SHALL** generate N simulated annual return paths for the portfolio by drawing from a multivariate normal distribution parameterised by `(μ, Σ_shrunk)`, where each draw represents one year of returns for each asset.

**Acceptance Criteria:** `simulate_paths(mu, cov, weights, horizon_years=3, n_simulations=10000)` returns an array of shape `(10000, 3)` with finite values.

---

### RSK-002 — Simulation seed
**SHALL** accept a random seed parameter (default 42) and produce reproducible results for the same seed and inputs.

**Acceptance Criteria:** Two calls to `simulate_paths` with the same seed, inputs, and parameters produce identical output arrays.

---

### RSK-003 — Max drawdown calculation
**SHALL** compute max drawdown for each simulated path as the maximum peak-to-trough percentage decline in the cumulative wealth series:
```
MDD = max over t of: (peak_{0..t} - value_t) / peak_{0..t}
```
Report both the median and 95th percentile of the max drawdown distribution. Both values are negative floats.

**Acceptance Criteria:** `compute_max_drawdown_distribution(paths)` returns `(median_mdd, p95_mdd)` where both are negative, and `p95_mdd <= median_mdd`.

---

### RSK-004 — VaR computation
**SHALL** compute 1-year Value at Risk at the 95% confidence level as the 5th percentile of the distribution of total portfolio returns over the full horizon (compounded across all years).

**Acceptance Criteria:** `var_95` is a negative float. For any diversified portfolio with positive expected return, it is between -0.80 and 0.00.

---

### RSK-005 — CVaR computation
**SHALL** compute 1-year Conditional Value at Risk at the 95% level as the mean of the worst 5% of compounded total-horizon returns.

**Acceptance Criteria:** `cvar_95 <= var_95` (CVaR is always at least as bad as VaR).

---

### RSK-006 — Portfolio volatility
**SHALL** compute annualised portfolio volatility as `√(wᵀ Σ w)`, where `Σ` is the annualised Ledoit-Wolf covariance matrix.

**Acceptance Criteria:** For a 100% SPY portfolio, result matches `σ_SPY` (the diagonal element of Σ for SPY) to within 1e-6.

---

### RSK-007 — Sharpe ratio
**SHALL** compute the Sharpe ratio as `(E[return] - rf) / volatility`, where `E[return]` is the annualised expected return (including risk-free rate, not excess).

**Acceptance Criteria:** Sharpe ratio is positive for any portfolio whose expected return exceeds the risk-free rate.

---

### RSK-008 — Consistent metric bundle
**SHALL** return all risk metrics together in a single `compute_portfolio_metrics` call so that all metrics are computed from the same simulation draw, ensuring internal consistency.

**Acceptance Criteria:** A single call to `compute_portfolio_metrics` returns `expected_return_pretax`, `volatility`, `sharpe_ratio`, `max_drawdown_median`, `max_drawdown_p95`, `var_95`, `cvar_95` in one dict.

---

## 6. Portfolio Optimizer Requirements (OPT)

### OPT-001 — Optimization objective
**SHALL** minimize the 95th-percentile max drawdown (as computed by `RSK-003`) subject to a minimum expected return constraint. The objective is the primary differentiator of the product.

**Acceptance Criteria:** For two portfolios A and B both satisfying the return constraint, the optimizer prefers the one with lower `p95_max_drawdown`.

---

### OPT-002 — Return constraint
**SHALL** enforce that the annualised expected excess return of the optimised portfolio satisfies `wᵀ μ × 252 >= target_return`.

**Acceptance Criteria:** The optimal portfolio's `expected_return_pretax >= target_return - 1e-4` (tolerance for numerical solver imprecision).

---

### OPT-003 — Weight constraints
**SHALL** enforce:
- `w_i >= 0` for all assets (long-only)
- `sum(w) == 1.0`
- `w_i <= max_weight` (default 0.40, user-configurable up to 1.0)

**Acceptance Criteria:** No weight in the output is negative or exceeds `max_weight`. Weights sum to 1.0 ± 1e-6.

---

### OPT-004 — SLSQP solver
**SHALL** use `scipy.optimize.minimize` with `method='SLSQP'` as the solver.

**Acceptance Criteria:** The solver is called with the correct constraint and bounds structures as required by SciPy's SLSQP interface.

---

### OPT-005 — Multiple random starts
**SHALL** run the optimizer from 5 independent random starting weight vectors (drawn from a Dirichlet distribution) and return the solution with the lowest objective value among all converged runs.

**Acceptance Criteria:** With `n_starts=5`, if at least one start converges, the function returns a valid solution. If all 5 starts fail, a `RuntimeError` is raised with a descriptive message.

---

### OPT-006 — Feasibility pre-check
**SHALL** check feasibility before running the optimizer: if `max(μ) × 252 < target_return` given the weight constraints, the optimizer is not called and an infeasibility result is returned immediately with the maximum achievable return.

**Acceptance Criteria:** `check_feasibility(mu, target_return=0.99)` returns `(False, max_achievable)` without attempting optimisation. `max_achievable` is a positive float.

---

### OPT-007 — Risk cost table (efficient frontier sweep)
**SHALL** compute the efficient frontier by sweeping `target_return` from `risk_free_rate` to `0.95 × max_feasible_return` in `FRONTIER_STEPS` (default 20) equally-spaced steps, solving the optimizer at each point.

**Acceptance Criteria:** `compute_risk_cost_table` returns a list of at least 15 rows (some points may be skipped if infeasible). Each row contains `target_return`, `min_drawdown_p95`, `volatility`, `cvar_95`.

---

### OPT-008 — Monotonic frontier
**SHALL** produce a risk cost table where `min_drawdown_p95` is monotonically non-decreasing in magnitude as `target_return` increases (higher return target → at least as bad drawdown risk or worse).

**Acceptance Criteria:** For consecutive rows `r_i` and `r_{i+1}` in the table with `r_{i+1}.target_return > r_i.target_return`, `|r_{i+1}.min_drawdown_p95| >= |r_i.min_drawdown_p95| - 0.01` (small tolerance for Monte Carlo noise).

---

### OPT-009 — Pre-tax optimization
**SHALL** perform all optimization using pre-tax expected returns. Tax adjustment is applied to the output only, not as a constraint or objective component.

**Acceptance Criteria:** The optimizer receives `μ` (excess returns before tax) and does not receive tax rates as parameters. Tax rates are inputs to `TaxAdjuster` only.

---

## 7. Tax Model Requirements (TAX)

### TAX-001 — Annual rebalancing assumption
**SHALL** model tax impact assuming the portfolio is rebalanced exactly once per year. Gains on the rebalanced portion are classified as short-term capital gains (STCG); the rest are long-term (LTCG).

**Acceptance Criteria:** Tax model documentation explicitly states the annual rebalancing assumption.

---

### TAX-002 — Turnover calculation
**SHALL** compute one-way turnover as `sum(|w_new - w_prev|) / 2`. For the initial portfolio (no prior weights), use equal-weight as the baseline for `w_prev`.

**Acceptance Criteria:** `estimate_turnover([0.5, 0.5], [1.0, 0.0])` returns `0.5`. `estimate_turnover([0.25, 0.25, 0.25, 0.25], [0.25, 0.25, 0.25, 0.25])` returns `0.0`.

---

### TAX-003 — After-tax return formula
**SHALL** compute after-tax return as:
```
after_tax = pretax × (1 - ltcg_portion × tax_rate_lt - stcg_portion × tax_rate_st)
```
where `ltcg_portion = 1 - turnover` and `stcg_portion = turnover`.

**Acceptance Criteria:** `after_tax_return(0.20, turnover=0.0, lt=0.15, st=0.37)` ≈ 0.170. `after_tax_return(0.20, turnover=1.0, lt=0.15, st=0.37)` ≈ 0.126.

---

### TAX-004 — Default tax rates
**SHALL** default to 15% LTCG and 37% STCG (top US ordinary income bracket). Both rates must be user-configurable per request.

**Acceptance Criteria:** Passing `tax_rate_lt=0.20, tax_rate_st=0.32` in the optimize request overrides the defaults for that request only.

---

### TAX-005 — Both figures in output
**SHALL** include both `expected_return_pretax` and `expected_return_aftertax` in every optimize response, so the tax drag is always visible.

**Acceptance Criteria:** `expected_return_aftertax <= expected_return_pretax` for any positive pretax return and any non-zero tax rate. Both fields are present in every `PortfolioMetrics` object.

---

## 8. API Requirements (API)

### API-001 — `POST /api/sync` — request shape
**SHALL** accept a JSON body with `tickers: list[str]` and optional `lookback_years: int` (default 10). Tickers must be non-empty.

**Acceptance Criteria:** Request with empty `tickers` list returns HTTP 422.

---

### API-002 — `POST /api/sync` — response shape
**SHALL** return `{ "status": "ok", "tickers_synced": int, "rows_upserted": int, "latest_date": str }` on success.

**Acceptance Criteria:** `rows_upserted` is non-negative and `latest_date` is a valid ISO date string on success.

---

### API-003 — `POST /api/sync` — upstream failure
**SHALL** return HTTP 502 with a descriptive `detail` string if Yahoo Finance or FRED is unreachable during sync.

**Acceptance Criteria:** A mocked `yfinance.download` that raises `ConnectionError` causes the endpoint to return 502, not 500.

---

### API-004 — `GET /api/assets` — response shape
**SHALL** return `{ "assets": [ { "ticker", "name", "latest_date", "rows" } ] }` listing all tickers present in the `prices` table, sorted alphabetically by ticker.

**Acceptance Criteria:** `GET /api/assets` before any sync returns `{ "assets": [] }`. After syncing SPY, it returns one entry with `ticker = "SPY"`.

---

### API-005 — `GET /api/assets` — asset name resolution
**SHALL** attempt to resolve a human-readable name for each ticker via `yfinance.Ticker.info["longName"]` with a 5-second timeout. If resolution fails or times out, the ticker symbol is used as the name.

**Acceptance Criteria:** Name resolution failure does not cause the endpoint to error; it returns the ticker as the name instead.

---

### API-006 — `POST /api/optimize` — request shape
**SHALL** accept: `tickers: list[str]` (min 2), `target_return: float` (0–1), `horizon_years: int` (2, 3, or 5), `max_weight: float` (0.1–1.0), `tax_rate_lt: float`, `tax_rate_st: float`, `n_simulations: int`.

**Acceptance Criteria:** Requests with `len(tickers) < 2` or `horizon_years` not in `{2, 3, 5}` return HTTP 422 with a field-level validation error.

---

### API-007 — `POST /api/optimize` — success response shape
**SHALL** return `OptimizeResponse` with fields: `run_id`, `feasible: true`, `optimal_portfolio: PortfolioMetrics`, `risk_cost_table: list[RiskCostRow]`, `forecasts: dict[str, AssetForecast]`.

**Acceptance Criteria:** All fields are present and correctly typed. `risk_cost_table` has at least 15 entries.

---

### API-008 — `POST /api/optimize` — infeasibility response
**SHALL** return HTTP 422 with body `{ "detail": { "error": "infeasible", "max_achievable": float } }` when `target_return` exceeds the maximum achievable return for the given asset universe.

**Acceptance Criteria:** Requesting `target_return=0.99` with any realistic asset universe returns 422 with a `max_achievable` value less than 0.99.

---

### API-009 — `POST /api/optimize` — missing data response
**SHALL** return HTTP 422 with `{ "detail": "No data for ticker X. Run sync first." }` if any requested ticker is absent from the `prices` table, and HTTP 422 with `{ "detail": "Need ≥ 60 trading days. Sync more data." }` if overlap is insufficient.

**Acceptance Criteria:** Requesting an unsynced ticker returns 422, not 500.

---

### API-010 — `POST /api/optimize` — run persistence
**SHALL** insert a row into `portfolio_runs` for every successful (feasible) optimize call before returning the response.

**Acceptance Criteria:** `SELECT COUNT(*) FROM portfolio_runs` increments by 1 after each successful optimize call.

---

### API-011 — `GET /api/risk` — request shape
**SHALL** accept query parameters `tickers` (comma-separated), `weights` (comma-separated floats), `horizon_years: int`. Weights must sum to 1.0 ± 1e-4.

**Acceptance Criteria:** Request with weights that do not sum to 1 returns HTTP 422. Request with `len(tickers) != len(weights)` returns HTTP 422.

---

### API-012 — `GET /api/risk` — response shape
**SHALL** return a `PortfolioMetrics` object (same shape as the `optimal_portfolio` field in optimize response) without running the optimizer.

**Acceptance Criteria:** `GET /api/risk?tickers=SPY,QQQ&weights=0.6,0.4&horizon_years=3` returns all metrics fields populated with finite values.

---

### API-013 — `GET /healthz`
**SHALL** expose a health check endpoint at `GET /healthz` that returns `{ "status": "ok" }` with HTTP 200 when the application is running and the database is accessible.

**Acceptance Criteria:** Returns 200 `{ "status": "ok" }` immediately after startup. Used by the frontend to verify backend connectivity.

---

### API-014 — CPU-bound work off the event loop
**SHALL** run all quant engine computation (forecasting, covariance, simulation, optimization) inside `asyncio.to_thread` to avoid blocking the FastAPI event loop.

**Acceptance Criteria:** A second HTTP request made during an in-progress `/api/optimize` call receives a response (e.g. from `/healthz`) within 1 second, not queued behind the optimize job.

---

### API-015 — Static file serving
**SHALL** serve the compiled frontend (`frontend/dist/`) as static files from the root path `/` when the dist directory exists. Single-page app fallback (HTML5 history mode): all non-API paths return `index.html`.

**Acceptance Criteria:** `GET /` returns `index.html` after running `npm run build`. `GET /api/assets` is still handled by the API router, not served as a static file.

---

## 9. Frontend Requirements (FE)

### FE-001 — Tech stack
**SHALL** be implemented as a Vite + React 18 + TypeScript single-page application styled with Tailwind CSS. No other CSS framework or component library is permitted in v1.

**Acceptance Criteria:** `npm run build` produces a `dist/` directory with no TypeScript errors and no Tailwind class names that are not from the core Tailwind utility set.

---

### FE-002 — TypeScript API types
**SHALL** define all API request/response shapes as TypeScript interfaces in `src/types/api.ts`. No component or hook shall use `any` for API data.

**Acceptance Criteria:** Running `tsc --noEmit` on the frontend produces zero type errors.

---

### FE-003 — API client
**SHALL** expose typed async functions in `src/api/client.ts` that wrap every API endpoint. All functions throw a typed `ApiError` (with `.status: number` and `.detail: string`) on non-2xx responses.

**Acceptance Criteria:** A 422 response from `/api/optimize` is caught as an `ApiError` with `status=422` and a non-empty `detail` string, not as a generic `Error`.

---

### FE-004 — Vite dev proxy
**SHALL** proxy all requests to `/api/*` from the Vite dev server (`localhost:5173`) to the FastAPI backend (`localhost:8000`) to avoid CORS issues in development.

**Acceptance Criteria:** `POST /api/sync` called from the frontend at `localhost:5173` reaches the FastAPI server with no CORS error in any browser console.

---

### FE-005 — `AssetSelector` component
**SHALL** render a text input with autocomplete powered by the `/api/assets` response. Selected tickers are displayed as removable chips. Typing a partial ticker string filters the dropdown.

**Acceptance Criteria:**
- On mount, the dropdown is populated from `/api/assets`.
- Selecting a ticker adds a chip with `data-testid="chip-{TICKER}"`.
- Clicking the chip's remove button removes it from the selected set.
- If `/api/assets` returns an empty list, the dropdown shows "No data — sync first".

---

### FE-006 — `SyncButton` component
**SHALL** render a "Sync Data" button that calls `POST /api/sync` with the currently selected tickers. The button is disabled when no tickers are selected. It cycles through states: idle → syncing → success/error.

**Acceptance Criteria:**
- Button text reads "Syncing…" while the request is in flight.
- On success: shows "Synced — {rows_upserted} rows, last date {latest_date}".
- On error: shows the error message in red text.
- After sync completes (success or error), the button returns to an interactive idle state.

---

### FE-007 — `ParamForm` component
**SHALL** render inputs for all optimize parameters: target return (range slider, 5%–60%, step 1%), time horizon (button group: 2 / 3 / 5 years), max single position weight (range slider, 10%–100%, step 5%), LTCG tax rate (number input), STCG tax rate (number input), simulation count (select: Fast=1000 / Standard=5000 / Precise=10000).

**Acceptance Criteria:**
- All inputs reflect their current values visually.
- Slider values display as formatted percentages (e.g. "20%").
- Every change propagates immediately to the parent via `onChange`.
- "Run Optimizer" button is disabled while the optimize request is in flight.

---

### FE-008 — `useOptimize` hook
**SHALL** encapsulate the optimize request lifecycle: loading state, result state, and error state. It exposes `{ state, run, reset }`.

**Acceptance Criteria:**
- `state.loading` is `true` from the moment `run()` is called until the response is received.
- `state.result` is populated on success and `null` on error.
- `state.error` is a human-readable string on failure:
  - Infeasibility 422: "Target return of X% is not achievable. Max achievable: Y%."
  - Missing data 422: passes through the detail string from the API.
  - Other errors: "An unexpected error occurred."

---

### FE-009 — `WeightsBar` component
**SHALL** render portfolio weights as a list of labelled horizontal CSS bars. Each bar's width is proportional to the weight. Bars are sorted descending by weight.

**Acceptance Criteria:**
- Each bar has `data-testid="weight-bar-{TICKER}"`.
- Bar width is the weight × 100% of the container width.
- Label shows ticker and weight as a percentage (e.g. "SPY 35%").
- Colors are deterministically assigned per ticker (same ticker always gets the same color).

---

### FE-010 — `MetricsCard` component
**SHALL** render all portfolio metrics in a 2-column grid. Positive returns are prefixed with "+". Negative values (drawdown, VaR, CVaR) use an en-dash "−" (U+2212), not a hyphen-minus.

**Acceptance Criteria:**
- `data-testid="metric-{field_name}"` on each value cell (e.g. `metric-max_drawdown_p95`).
- `max_drawdown_p95 = -0.31` displays as "−31%", not "-31%".
- `expected_return_pretax = 0.213` displays as "+21.3%".
- Drawdown and CVaR values are rendered in red (`text-red-600`).

---

### FE-011 — `RiskCostTable` component
**SHALL** render the efficient frontier sweep as an HTML table with columns: Target Return, Min Drawdown (p95), Volatility, CVaR 95%. The row closest to the user's current `targetReturn` is highlighted.

**Acceptance Criteria:**
- Each row has `data-testid="risk-row-{target_return}"` where `target_return` is the numeric value (e.g. `risk-row-0.20`).
- The highlighted row has a Tailwind `ring` class applied.
- All values are formatted as percentages.
- Table has a visible caption: "Risk cost of each return target".

---

### FE-012 — `ForecastTable` component
**SHALL** render per-asset forecasts as an HTML table with columns: Ticker, Expected Excess Return, Forecast Volatility. Both values formatted as percentages.

**Acceptance Criteria:**
- Table has caption "Per-asset return forecasts (GARCH + shrinkage)".
- All requested tickers appear as rows.
- No row has NaN or undefined values.

---

### FE-013 — `App.tsx` two-panel layout
**SHALL** render a fixed left sidebar (parameters) and a scrollable right panel (results). The right panel shows:
- Empty state: "Select assets and run the optimizer" when no result exists.
- Loading spinner while `state.loading` is true.
- Error box in red when `state.error` is set.
- All four result components (`WeightsBar`, `MetricsCard`, `RiskCostTable`, `ForecastTable`) when `state.result` is set.

**Acceptance Criteria:** Only one of (empty state / spinner / error / results) is visible at any time.

---

### FE-014 — No charting libraries
**SHALL NOT** import any charting library (e.g. Recharts, Chart.js, D3) in v1. All data visualisation is achieved with HTML tables and CSS.

**Acceptance Criteria:** `package.json` contains no charting library dependency.

---

### FE-015 — No global state library
**SHALL NOT** use Redux, Zustand, Jotai, or any global state management library. All state is managed with React `useState` / `useReducer` within components and hooks.

**Acceptance Criteria:** `package.json` contains no state management library dependency.

---

## 10. Testing Requirements (TST)

### TST-001 — Backend unit tests: engine modules
**SHALL** have unit tests in `backend/tests/test_engine.py` covering:
- `compute_historical_mean`: correct annualisation.
- `fit_garch_volatility`: returns a positive float; does not raise on convergence failure.
- `james_stein_shrinkage`: result lies between `μ_hist` and `μ_market` for any λ ∈ (0, 1).
- `after_tax_return`: correct formula for turnover=0 and turnover=1.
- `estimate_turnover`: zero turnover for identical weight vectors.
- `compute_max_drawdown_distribution`: `p95 <= median` (both negative).
- `compute_var_cvar`: `cvar <= var` (both negative).

**Acceptance Criteria:** All tests pass with `pytest backend/tests/test_engine.py`. No test calls `yfinance.download` or any external API.

---

### TST-002 — Backend integration test: full engine pipeline
**SHALL** have an integration test in `backend/tests/test_engine.py` that loads a fixture CSV of ~3 years of SPY/QQQ/TLT daily returns and runs the full pipeline: `forecast_returns → ledoit_wolf_covariance → optimize_portfolio(target=0.10) → compute_portfolio_metrics → after_tax_return`.

**Acceptance Criteria:** Weights sum to 1.0, `expected_return_pretax > 0`, `max_drawdown_p95 < 0`, `after_tax < pretax`.

---

### TST-003 — Backend API tests: round trip
**SHALL** have API tests in `backend/tests/test_api.py` using FastAPI `TestClient` with `fetch_prices` monkeypatched to return fixture data. Tests cover:
- `POST /api/sync` with fixture data → success response.
- `GET /api/assets` → returns synced tickers.
- `POST /api/optimize` → valid `OptimizeResponse` schema.
- `POST /api/optimize` with `target_return=0.99` → HTTP 422 with `error=infeasible`.
- `POST /api/optimize` with unknown ticker → HTTP 422 with "sync first" message.
- `GET /api/risk` with valid and invalid weight vectors.
- `GET /healthz` → 200 `{ "status": "ok" }`.

**Acceptance Criteria:** All tests pass with `pytest backend/tests/test_api.py`. No test makes real network calls.

---

### TST-004 — Playwright setup
**SHALL** have a `playwright.config.ts` in `frontend/` that:
- Sets `testDir: './e2e'`.
- Runs only Chromium.
- Configures `webServer` to start `npm run dev` automatically before tests run, reusing an existing server if already running.
- Sets test timeout to 15 seconds.

**Acceptance Criteria:** `npm run test:e2e` starts the Vite dev server if not already running and runs all Playwright tests without requiring a separate terminal.

---

### TST-005 — Playwright: no backend required
**SHALL** mock all `/api/*` routes with `page.route()` in every Playwright test. No test shall require a running FastAPI backend.

**Acceptance Criteria:** `npm run test:e2e` passes with the FastAPI backend stopped.

---

### TST-006 — Playwright: mock factory (`e2e/mocks/api.ts`)
**SHALL** provide a `setupApiMocks(page, overrides?)` helper that installs route mocks for `/api/assets`, `/api/sync`, and `/api/optimize`. The `overrides` parameter allows individual tests to replace the default happy-path response with an error response.

**Acceptance Criteria:** `setupApiMocks(page, { optimize: { status: 422, body: { ... } } })` causes only the optimize route to return 422; all other routes return their defaults.

---

### TST-007 — Playwright: user journey tests (`e2e/app.spec.ts`)
**SHALL** have 5 tests covering the full user journey:
1. Empty state is shown on load.
2. Asset selector populates from `/api/assets`.
3. Asset chip can be added and removed.
4. Sync button shows success message with row count.
5. Happy path: selecting 4 assets and running optimizer renders `WeightsBar`, `MetricsCard`, `RiskCostTable`, and `ForecastTable`.

Additionally:
6. "Run Optimizer" button is disabled while the optimize request is in flight.

**Acceptance Criteria:** All 6 tests pass with `npm run test:e2e`.

---

### TST-008 — Playwright: component and error state tests (`e2e/components.spec.ts`)
**SHALL** have 6 tests covering edge cases:
1. Infeasibility 422 → error message showing max achievable return.
2. Sync 502 → error message in red.
3. Empty `/api/assets` list → "No data — sync first" in dropdown.
4. `RiskCostTable` highlights the row matching the current target return.
5. `MetricsCard` formats negative drawdown with en-dash "−", not hyphen.
6. `ParamForm` horizon selector wires through to the request body.

**Acceptance Criteria:** All 6 tests pass with `npm run test:e2e`.

---

### TST-009 — `data-testid` coverage
**SHALL** add `data-testid` attributes to the following elements (and only these — no other elements require `data-testid`):

| Component | Attribute |
|---|---|
| Asset chip | `chip-{TICKER}` |
| Weight bar row | `weight-bar-{TICKER}` |
| Metrics value cell | `metric-{field_name}` |
| Risk cost table row | `risk-row-{target_return}` |

**Acceptance Criteria:** The above `data-testid` selectors are used in Playwright tests. No other `data-testid` attributes appear in the codebase.

---

## 11. Constraints and Non-Requirements

The following are explicitly outside v1 scope and no requirement is placed on them:

| Item | Deferred to |
|---|---|
| HMM regime detection | v2 |
| Regime-conditional μ and Σ | v2 |
| Real-time price feeds | — |
| Portfolio position tracking | — |
| Transaction history | — |
| Stress scenario engine ("tech drops 40%") | v2 |
| Copula / tail dependence modeling | v2 |
| Tax-loss harvesting engine | v2 |
| Multi-user support / authentication | — |
| Cloud deployment | — |
| Mobile-responsive UI | — |
| PDF/CSV export of results | — |
| Institutional compliance features | — |
