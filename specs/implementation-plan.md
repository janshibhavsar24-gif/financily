# Financily — Implementation Plan

**Version:** 1.0
**Date:** 2026-02-19

This document breaks every spec item into concrete, ordered, file-level tasks. Each task names the file, the exact functions/components to write, their signatures, and what they must do.

---

## Conventions

- Tasks are numbered `P{phase}.{task}` (e.g. `P1.2`)
- Each task lists: **file**, **what to write**, **inputs/outputs**, **depends on**
- A task is done only when it passes its stated verification

---

## Phase 0 — Project Scaffold

### P0.1 — Repo structure (monorepo)

The project is a monorepo with two packages (`backend/`, `frontend/`) coordinated from the root. No workspace tooling (Turborepo, nx) is needed at this scale.

Create the following structure:

```
financily/                        # repo root
├── backend/                      # Python package
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── data/
│   │   ├── __init__.py
│   │   ├── db.py
│   │   ├── fetcher.py
│   │   └── sync.py
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── forecaster.py
│   │   ├── covariance.py
│   │   ├── risk.py
│   │   ├── optimizer.py
│   │   └── tax.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── sync.py
│   │   ├── optimize.py
│   │   ├── assets.py
│   │   └── risk.py
│   └── tests/
│       ├── __init__.py
│       ├── fixtures/             # CSV fixtures for unit tests
│       ├── test_engine.py
│       └── test_api.py
├── frontend/                     # Node package (scaffold in P4.1)
│   ├── src/
│   ├── e2e/
│   ├── index.html
│   ├── vite.config.ts
│   ├── playwright.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── specs/
│   ├── vision.md
│   ├── specs.md
│   ├── implementation-plan.md
│   └── requirements.md
├── data/                         # gitignored — DuckDB file lives here
├── cli.py                        # root CLI entry point (see P0.4)
├── pyproject.toml                # installs `financily` CLI command
├── .env.example                  # template for all env vars
├── .gitignore
└── README.md
```

Root `.gitignore` must cover both Python and Node artifacts:
```
# Python
__pycache__/
*.pyc
.venv/
*.egg-info/
dist/

# Node
node_modules/
frontend/dist/

# App data
data/
.env
```

### P0.2 — Root `pyproject.toml`

Defines the project as an installable Python package with a CLI entry point. This is what makes `financily dev` work from anywhere after a one-time `pip install -e .`.

```toml
[project]
name = "financily"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "uvicorn[standard]>=0.27",
    "duckdb>=0.10",
    "yfinance>=0.2",
    "arch>=6.3",
    "scikit-learn>=1.4",
    "scipy>=1.12",
    "numpy>=1.26",
    "pandas>=2.2",
    "fredapi>=0.5",
    "httpx>=0.27",
    "python-dotenv>=1.0",
    "typer>=0.12",          # CLI framework
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",           # for FastAPI TestClient
]

[project.scripts]
financily = "cli:app"        # `financily` command → cli.py::app

[build-system]
requires = ["setuptools>=70"]
build-backend = "setuptools.backends.legacy:build"

[tool.setuptools.packages.find]
where = ["."]
include = ["backend*"]
```

Install once at the repo root:
```bash
pip install -e ".[dev]"
```

After this, `financily` is available as a shell command.

---

### P0.3 — Backend `requirements.txt`

Kept as a flat file for environments that prefer `pip install -r` over `pyproject.toml`. It mirrors the `[project.dependencies]` list in `pyproject.toml` exactly.

```
fastapi>=0.110
uvicorn[standard]>=0.27
duckdb>=0.10
yfinance>=0.2
arch>=6.3
scikit-learn>=1.4
scipy>=1.12
numpy>=1.26
pandas>=2.2
fredapi>=0.5
httpx>=0.27
python-dotenv>=1.0
typer>=0.12
pytest>=8.0
pytest-asyncio>=0.23
```

Preferred install (from repo root): `pip install -e ".[dev]"`
Alternative: `pip install -r backend/requirements.txt`

### P0.4 — `config.py`

**File:** `backend/config.py`

```python
DB_PATH: str            # absolute path to data/financily.duckdb
LOOKBACK_YEARS: int     # default 10
GARCH_WINDOW_YEARS: int # default 3 — window for GARCH fit
SHRINKAGE_LAMBDA: float # default 0.3 — James-Stein shrinkage intensity
MARKET_TICKER: str      # "SPY"
RISK_FREE_SERIES: str   # "DGS3MO"
N_SIMULATIONS: int      # default 10_000
RANDOM_SEED: int        # default 42
MAX_WEIGHT: float       # default 0.40
FRONTIER_STEPS: int     # default 20 — number of points on the risk cost sweep
DEFAULT_TAX_RATE_LT: float  # 0.15
DEFAULT_TAX_RATE_ST: float  # 0.37
```

All values read from env via `python-dotenv` with the above as fallback defaults.

---

### P0.5 — CLI (`cli.py` at repo root)

**File:** `cli.py`

The CLI is a `typer` app installed as the `financily` shell command via `pyproject.toml`. It provides four commands: `dev`, `build`, `start`, and `test`.

```python
import signal
import subprocess
import sys
import typer
from pathlib import Path

app = typer.Typer(help="Financily — local investment risk engine")

ROOT = Path(__file__).parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
```

#### `financily dev`

Starts both the FastAPI backend and the Vite frontend dev server concurrently in a single terminal. Output from both processes is interleaved and prefixed (`[backend]` / `[frontend]`). `Ctrl+C` kills both.

```python
@app.command()
def dev(
    backend_port: int = typer.Option(8000, help="Port for FastAPI"),
    frontend_port: int = typer.Option(5173, help="Port for Vite"),
):
    """Start backend + frontend dev servers concurrently."""
    backend_cmd = [
        sys.executable, "-m", "uvicorn",
        "backend.main:app",
        "--reload",
        f"--port={backend_port}",
    ]
    frontend_cmd = ["npm", "run", "dev", "--", "--port", str(frontend_port)]

    procs = [
        subprocess.Popen(backend_cmd, cwd=ROOT),
        subprocess.Popen(frontend_cmd, cwd=FRONTEND_DIR),
    ]

    def _shutdown(sig, frame):
        for p in procs:
            p.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    # Block until either process exits (crash detection)
    for p in procs:
        p.wait()
```

#### `financily build`

Compiles the React frontend into `frontend/dist/`.

```python
@app.command()
def build():
    """Build the frontend for production."""
    result = subprocess.run(["npm", "run", "build"], cwd=FRONTEND_DIR)
    if result.returncode != 0:
        typer.echo("Frontend build failed.", err=True)
        raise typer.Exit(1)
    typer.echo("Build complete → frontend/dist/")
```

#### `financily start`

Production mode: builds the frontend (if `frontend/dist/` is absent or stale) then starts only the FastAPI server, which serves both the API and the static frontend.

```python
@app.command()
def start(
    port: int = typer.Option(8000, help="Port for FastAPI"),
    skip_build: bool = typer.Option(False, "--skip-build", help="Skip npm build step"),
):
    """Build frontend (if needed) and start the production server."""
    dist = FRONTEND_DIR / "dist"
    if not skip_build or not dist.exists():
        typer.echo("Building frontend...")
        build()
    typer.echo(f"Starting server on http://localhost:{port}")
    subprocess.run([
        sys.executable, "-m", "uvicorn",
        "backend.main:app",
        f"--port={port}",
    ], cwd=ROOT)
```

#### `financily test`

Runs backend pytest suite and/or Playwright e2e tests.

```python
@app.command()
def test(
    backend: bool = typer.Option(True, help="Run pytest"),
    e2e: bool = typer.Option(True, help="Run Playwright e2e tests"),
):
    """Run backend unit/integration tests and/or Playwright e2e tests."""
    if backend:
        typer.echo("Running backend tests...")
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "backend/tests", "-v"],
            cwd=ROOT,
        )
        if result.returncode != 0:
            raise typer.Exit(result.returncode)

    if e2e:
        typer.echo("Running Playwright e2e tests...")
        result = subprocess.run(
            ["npm", "run", "test:e2e"],
            cwd=FRONTEND_DIR,
        )
        if result.returncode != 0:
            raise typer.Exit(result.returncode)
```

**Summary of CLI commands:**

| Command | What it does |
|---|---|
| `financily dev` | Backend (`:8000`, hot-reload) + Frontend (`:5173`, HMR) concurrently |
| `financily build` | Compile React → `frontend/dist/` |
| `financily start` | Build frontend + serve everything from FastAPI on `:8000` |
| `financily start --skip-build` | Skip npm build, just start FastAPI (use when dist is fresh) |
| `financily test` | Run pytest + Playwright |
| `financily test --no-e2e` | Run pytest only |
| `financily test --no-backend` | Run Playwright only |

**One-time setup from repo root:**
```bash
pip install -e ".[dev]"      # installs `financily` CLI
cd frontend && npm install   # install Node deps
```

**Verification:** `financily --help` prints the command list. `financily dev` starts both servers and a browser at `localhost:5173` shows the app.

---

### P0.6 — `.env.example`

```
# Backend
DB_PATH=data/financily.duckdb
LOOKBACK_YEARS=10
GARCH_WINDOW_YEARS=3
SHRINKAGE_LAMBDA=0.3
N_SIMULATIONS=10000
RANDOM_SEED=42
MAX_WEIGHT=0.40
FRONTIER_STEPS=20
DEFAULT_TAX_RATE_LT=0.15
DEFAULT_TAX_RATE_ST=0.37
FRED_API_KEY=              # optional — leave blank to use yfinance fallback

# CLI
BACKEND_PORT=8000
FRONTEND_PORT=5173
```

Copy to `.env` (gitignored) and fill in values. The CLI and backend both load this file automatically on startup.

---

## Phase 1 — Data Layer

### P1.1 — Database schema (`backend/data/db.py`)

**Functions to implement:**

```python
def get_connection() -> duckdb.DuckDBPyConnection:
    """
    Return a DuckDB connection to DB_PATH.
    Creates the file if it does not exist.
    Connection is not shared across threads — callers get a fresh connection.
    """

def init_schema(conn: duckdb.DuckDBPyConnection) -> None:
    """
    Execute CREATE TABLE IF NOT EXISTS for:
      - prices (ticker, date, close, adj_close, volume) PK (ticker, date)
      - daily_returns (ticker, date, ret) PK (ticker, date)
      - macro_series (series_id, date, value) PK (series_id, date)
      - portfolio_runs (run_id, run_at, tickers JSON, target_return,
                        horizon_years, tax_rate_st, tax_rate_lt, result JSON)
    """
```

**Startup:** `main.py` calls `init_schema` on app startup via FastAPI lifespan.

**Verification:** `python -c "from data.db import get_connection, init_schema; conn = get_connection(); init_schema(conn); print(conn.execute('SHOW TABLES').fetchall())"` prints 4 table names.

---

### P1.2 — Yahoo Finance fetcher (`backend/data/fetcher.py`)

```python
def fetch_prices(
    tickers: list[str],
    start: date,
    end: date,
) -> pd.DataFrame:
    """
    Call yfinance.download(tickers, start, end, auto_adjust=True).
    Return a DataFrame with columns: ticker, date, close, adj_close, volume.
    Rows where adj_close is NaN are dropped.
    Ticker names are normalised to uppercase.
    """

def fetch_risk_free_rate(
    series_id: str = RISK_FREE_SERIES,
) -> float:
    """
    Fetch the latest available value for a FRED series (e.g. DGS3MO).
    Uses direct FRED API via fredapi.Fred (FRED_API_KEY from env, optional —
    fall back to yfinance '^IRX' if key absent).
    Returns rate as a decimal (e.g. 0.052 for 5.2%).
    """

def fetch_macro_series(
    series_ids: list[str],
    start: date,
    end: date,
) -> pd.DataFrame:
    """
    Fetch one or more FRED series.
    Return DataFrame: series_id, date, value.
    """
```

**Notes:**
- `yfinance` calls are synchronous; wrap in `asyncio.to_thread` when called from FastAPI.
- FRED API key is optional — document in README.

**Verification:** `fetch_prices(["SPY"], date(2023,1,1), date(2024,1,1))` returns a non-empty DataFrame with correct columns.

---

### P1.3 — Incremental sync (`backend/data/sync.py`)

```python
def upsert_prices(
    conn: duckdb.DuckDBPyConnection,
    df: pd.DataFrame,          # output of fetch_prices
) -> int:
    """
    INSERT OR REPLACE into prices.
    Also compute log returns and upsert into daily_returns:
      ret = log(adj_close_t / adj_close_{t-1})
    Returns number of rows upserted into prices.
    """

def get_last_sync_date(
    conn: duckdb.DuckDBPyConnection,
    ticker: str,
) -> date | None:
    """
    SELECT MAX(date) FROM prices WHERE ticker = ?
    Returns None if no data exists yet.
    """

async def sync_tickers(
    tickers: list[str],
    lookback_years: int = LOOKBACK_YEARS,
) -> dict:
    """
    For each ticker:
      1. Call get_last_sync_date
      2. If None → start = today - lookback_years years
         Else     → start = last_sync_date + 1 day
      3. Fetch prices from start → today
      4. Upsert

    Also sync RISK_FREE_SERIES from FRED.

    Returns:
      {
        "tickers_synced": int,
        "rows_upserted": int,
        "latest_date": str (ISO format),
      }
    """
```

**Verification:** Run `sync_tickers(["SPY","QQQ"])` twice — second run should upsert 0 rows if called same day.

---

### P1.4 — `/api/sync` endpoint (`backend/api/sync.py`)

```python
class SyncRequest(BaseModel):
    tickers: list[str]
    lookback_years: int = LOOKBACK_YEARS

class SyncResponse(BaseModel):
    status: str
    tickers_synced: int
    rows_upserted: int
    latest_date: str

router = APIRouter()

@router.post("/api/sync", response_model=SyncResponse)
async def sync_endpoint(body: SyncRequest) -> SyncResponse:
    """
    Calls sync_tickers. Returns SyncResponse.
    On yfinance error: returns HTTP 502 with error detail.
    """
```

---

### P1.5 — `/api/assets` endpoint (`backend/api/assets.py`)

```python
class AssetInfo(BaseModel):
    ticker: str
    name: str           # best-effort: yfinance .info["longName"], else ticker
    latest_date: str
    rows: int

class AssetsResponse(BaseModel):
    assets: list[AssetInfo]

@router.get("/api/assets", response_model=AssetsResponse)
async def list_assets() -> AssetsResponse:
    """
    SELECT ticker, MAX(date) as latest_date, COUNT(*) as rows
    FROM prices GROUP BY ticker ORDER BY ticker.
    Asset name: attempt yfinance .info lookup with 5s timeout; fall back to ticker.
    """
```

---

### P1.6 — FastAPI app entry point (`backend/main.py`)

```python
# Lifespan: call init_schema on startup
# Mount routers from api/sync.py, api/assets.py
# Serve frontend/dist/ as StaticFiles at "/" (added in P4.6)
# CORS: allow localhost origins in dev (controlled by ENV var)
```

**Verification:** `uvicorn backend.main:app --reload` starts. `GET /api/assets` returns `{"assets":[]}` before sync. `POST /api/sync` with `["SPY"]` returns success.

---

## Phase 2 — Quant Engine

### P2.1 — Return Forecaster (`backend/engine/forecaster.py`)

```python
def get_returns_matrix(
    conn: duckdb.DuckDBPyConnection,
    tickers: list[str],
    window_years: int = GARCH_WINDOW_YEARS,
) -> pd.DataFrame:
    """
    Query daily_returns for each ticker over trailing window_years.
    Pivot to wide format: index=date, columns=ticker.
    Drop rows where any ticker has NaN (require complete overlap).
    Raise ValueError if fewer than 60 rows remain after filtering.
    """

def compute_historical_mean(returns: pd.Series) -> float:
    """
    Annualised mean log return: returns.mean() * 252
    """

def fit_garch_volatility(returns: pd.Series) -> float:
    """
    Fit GARCH(1,1) using arch.arch_model(returns*100, vol='Garch', p=1, q=1).
    Forecast 1-step ahead conditional volatility.
    Return annualised volatility: forecast_vol / 100 * sqrt(252).
    On convergence failure: fall back to returns.std() * sqrt(252).
    """

def james_stein_shrinkage(
    mu_hist: np.ndarray,    # shape (n,)
    mu_market: float,
    lam: float = SHRINKAGE_LAMBDA,
) -> np.ndarray:
    """
    mu_shrunk = (1 - lam) * mu_hist + lam * mu_market
    Returns array of same shape as mu_hist.
    """

def forecast_returns(
    conn: duckdb.DuckDBPyConnection,
    tickers: list[str],
) -> tuple[np.ndarray, np.ndarray, dict]:
    """
    Main entry point for the forecasting step.

    Returns:
      mu    : np.ndarray shape (n,) — annualised excess returns after shrinkage
      sigma : np.ndarray shape (n,) — annualised GARCH volatility per asset
      meta  : dict — per-ticker {"mu": float, "sigma": float} for API output

    Steps:
      1. get_returns_matrix for tickers + MARKET_TICKER
      2. compute_historical_mean per ticker and for market
      3. fit_garch_volatility per ticker
      4. james_stein_shrinkage(mu_hist, mu_market)
      5. subtract risk_free_rate (fetch_risk_free_rate)
      6. return (mu, sigma, meta)
    """
```

**Verification:** `forecast_returns(conn, ["SPY","QQQ","TLT"])` returns arrays of length 3, all finite values.

---

### P2.2 — Covariance Estimator (`backend/engine/covariance.py`)

```python
def ledoit_wolf_covariance(
    returns: pd.DataFrame,   # wide format, shape (T, n)
) -> np.ndarray:
    """
    Scale returns to daily, apply sklearn.covariance.LedoitWolf().fit(returns).
    Return annualised covariance matrix: cov_daily * 252.
    Shape: (n, n).
    Raise ValueError if matrix is not positive semi-definite after shrinkage
    (add jitter 1e-8 * I if needed).
    """
```

**Verification:** Result is symmetric, all eigenvalues >= 0.

---

### P2.3 — Risk Engine (`backend/engine/risk.py`)

```python
def simulate_paths(
    mu: np.ndarray,          # shape (n,)
    cov: np.ndarray,         # shape (n, n)
    weights: np.ndarray,     # shape (n,)
    horizon_years: int,
    n_simulations: int = N_SIMULATIONS,
    seed: int = RANDOM_SEED,
) -> np.ndarray:
    """
    Draw n_simulations × horizon_years samples from MVN(mu, cov).
    Each draw is one year of portfolio return for one path.
    Return array shape (n_simulations, horizon_years) of annual portfolio returns.
    Portfolio return per year = weights @ annual_asset_returns.
    """

def compute_max_drawdown_distribution(
    paths: np.ndarray,       # shape (n_simulations, horizon_years)
) -> tuple[float, float]:
    """
    For each path, compute cumulative wealth series and max drawdown.
    Max drawdown = max over t of (peak_{0..t} - value_t) / peak_{0..t}.
    Return (median_max_drawdown, p95_max_drawdown) — both negative floats.
    """

def compute_var_cvar(
    paths: np.ndarray,       # shape (n_simulations, horizon_years)
    confidence: float = 0.95,
) -> tuple[float, float]:
    """
    Compound each path to get total return over horizon.
    total_return[i] = product(1 + paths[i]) - 1
    VaR  = (1 - confidence) percentile of total_return  (negative float)
    CVaR = mean of total_return values <= VaR            (negative float)
    """

def compute_portfolio_metrics(
    weights: np.ndarray,
    mu: np.ndarray,
    cov: np.ndarray,
    sigma_assets: np.ndarray,
    horizon_years: int,
    risk_free_rate: float,
    n_simulations: int = N_SIMULATIONS,
) -> dict:
    """
    Compute all risk metrics for a given weight vector.
    Returns:
    {
      "expected_return_pretax": float,   # w @ mu * 252 (already excess, re-add rf)
      "volatility": float,               # sqrt(w @ cov @ w)
      "sharpe_ratio": float,             # (E[r] - rf) / vol
      "max_drawdown_median": float,
      "max_drawdown_p95": float,
      "var_95": float,
      "cvar_95": float,
    }
    """
```

**Verification:** For `weights = [1.0]` (single asset), `max_drawdown_p95` is negative and has magnitude in [0.05, 0.80] for any reasonable asset.

---

### P2.4 — Portfolio Optimizer (`backend/engine/optimizer.py`)

```python
def check_feasibility(
    mu: np.ndarray,
    target_return: float,
    max_weight: float = MAX_WEIGHT,
) -> tuple[bool, float]:
    """
    Upper bound on achievable return = max(mu) * 252 (single-asset, but capped
    at max_weight so if max_weight < 1.0, check max_weight * max(mu) * 252 + rest).
    Returns (is_feasible: bool, max_achievable: float).
    """

def _objective(
    weights: np.ndarray,
    mu: np.ndarray,
    cov: np.ndarray,
    horizon_years: int,
    n_simulations: int,
) -> float:
    """
    Returns p95 max drawdown (positive, for minimisation — negate the negative float).
    This is the function passed to scipy.optimize.minimize.
    """

def optimize_portfolio(
    mu: np.ndarray,
    cov: np.ndarray,
    target_return: float,      # annualised
    horizon_years: int,
    max_weight: float = MAX_WEIGHT,
    n_simulations: int = N_SIMULATIONS,
    n_starts: int = 5,
) -> np.ndarray:
    """
    SLSQP minimisation of _objective.
    Constraints:
      - w @ mu * 252 >= target_return
      - sum(w) == 1
    Bounds: w_i in [0, max_weight]

    Try n_starts random initialisations (Dirichlet(1,...,1)).
    Return weights of the run with lowest objective value.
    Raise RuntimeError if all starts fail to converge.
    """

def compute_risk_cost_table(
    mu: np.ndarray,
    cov: np.ndarray,
    risk_free_rate: float,
    horizon_years: int,
    max_weight: float = MAX_WEIGHT,
    n_steps: int = FRONTIER_STEPS,
    n_simulations: int = N_SIMULATIONS,
) -> list[dict]:
    """
    Sweep target_return from risk_free_rate to 0.95 * max(mu) * 252
    in n_steps equally-spaced points.
    For each point: call optimize_portfolio → compute_portfolio_metrics.
    Return list of dicts:
      {"target_return", "min_drawdown_p95", "volatility", "cvar_95"}
    Skip infeasible points silently.
    """
```

**Verification:** `optimize_portfolio(mu, cov, target_return=0.10, horizon_years=3)` for SPY/QQQ/TLT/GLD returns weights that sum to 1.0 ± 1e-6 and satisfy the return constraint.

---

### P2.5 — Tax Adjuster (`backend/engine/tax.py`)

```python
def estimate_turnover(
    w_prev: np.ndarray,
    w_new: np.ndarray,
) -> float:
    """
    One-way turnover = sum(|w_new - w_prev|) / 2
    For initial portfolio (no prior weights), use w_new as turnover proxy
    against equal-weight baseline.
    """

def after_tax_return(
    pretax_return: float,
    turnover: float,
    tax_rate_lt: float = DEFAULT_TAX_RATE_LT,
    tax_rate_st: float = DEFAULT_TAX_RATE_ST,
) -> float:
    """
    ltcg_portion = 1 - turnover
    stcg_portion = turnover
    after_tax = pretax_return
        - ltcg_portion * pretax_return * tax_rate_lt
        - stcg_portion * pretax_return * tax_rate_st
    """
```

**Verification:** `after_tax_return(0.20, turnover=0.0, tax_rate_lt=0.15, tax_rate_st=0.37)` ≈ 0.17. `after_tax_return(0.20, turnover=1.0, ...)` ≈ 0.126.

---

### P2.6 — Engine integration test

Write `backend/tests/test_engine.py`:

```python
def test_full_pipeline_spy_qqq_tlt():
    """
    End-to-end: load test fixture of ~3 years SPY/QQQ/TLT daily returns,
    run forecast_returns → ledoit_wolf_covariance → optimize_portfolio(target=0.10)
    → compute_portfolio_metrics → after_tax_return.
    Assert:
      - weights sum to 1.0
      - expected_return_pretax > 0
      - max_drawdown_p95 < 0
      - after_tax < pretax
    """
```

Use a small fixture CSV (50 rows) instead of live data. Do not call yfinance in tests.

---

## Phase 3 — API Layer

### P3.1 — `/api/optimize` endpoint (`backend/api/optimize.py`)

```python
class OptimizeRequest(BaseModel):
    tickers: list[str]          # min 2
    target_return: float        # e.g. 0.20
    horizon_years: int          # 2, 3, or 5
    max_weight: float = MAX_WEIGHT
    tax_rate_lt: float = DEFAULT_TAX_RATE_LT
    tax_rate_st: float = DEFAULT_TAX_RATE_ST
    n_simulations: int = N_SIMULATIONS

class PortfolioMetrics(BaseModel):
    weights: dict[str, float]
    expected_return_pretax: float
    expected_return_aftertax: float
    volatility: float
    sharpe_ratio: float
    max_drawdown_median: float
    max_drawdown_p95: float
    var_95: float
    cvar_95: float

class RiskCostRow(BaseModel):
    target_return: float
    min_drawdown_p95: float
    volatility: float
    cvar_95: float

class AssetForecast(BaseModel):
    mu: float
    sigma: float

class OptimizeResponse(BaseModel):
    run_id: str
    feasible: bool
    optimal_portfolio: PortfolioMetrics
    risk_cost_table: list[RiskCostRow]
    forecasts: dict[str, AssetForecast]

@router.post("/api/optimize", response_model=OptimizeResponse)
async def optimize_endpoint(body: OptimizeRequest) -> OptimizeResponse:
    """
    Pipeline (all CPU-bound work wrapped in asyncio.to_thread):
      1. get_returns_matrix — raise HTTP 422 if insufficient data (prompt sync)
      2. forecast_returns → (mu, sigma, meta)
      3. ledoit_wolf_covariance
      4. check_feasibility — if False, return HTTP 422 with max_achievable in detail
      5. optimize_portfolio
      6. compute_portfolio_metrics for optimal weights
      7. after_tax_return
      8. compute_risk_cost_table
      9. persist to portfolio_runs table
      10. return OptimizeResponse
    """
```

**Error responses:**

| Condition | HTTP | detail |
|---|---|---|
| Ticker not in DB | 422 | `"No data for ticker X. Run sync first."` |
| Insufficient history | 422 | `"Need ≥ 60 trading days. Sync more data."` |
| Target infeasible | 422 | `{"error": "infeasible", "max_achievable": 0.14}` |
| Optimizer failure | 500 | `"Optimization failed to converge."` |

---

### P3.2 — `/api/risk` endpoint (`backend/api/risk.py`)

```python
@router.get("/api/risk")
async def risk_endpoint(
    tickers: str,           # comma-separated
    weights: str,           # comma-separated floats, must sum to 1
    horizon_years: int = 3,
) -> PortfolioMetrics:
    """
    Compute risk metrics for an arbitrary portfolio without running the optimizer.
    Validate: len(tickers) == len(weights), sum(weights) ≈ 1.0 ± 1e-4.
    Return same PortfolioMetrics shape as optimize response.
    """
```

---

### P3.3 — Register all routers in `main.py`

```python
from api.sync import router as sync_router
from api.assets import router as assets_router
from api.optimize import router as optimize_router
from api.risk import router as risk_router

app.include_router(sync_router)
app.include_router(assets_router)
app.include_router(optimize_router)
app.include_router(risk_router)
```

Add `GET /healthz` that returns `{"status": "ok"}` — used by frontend to check backend is running.

---

### P3.4 — API integration test

Write `backend/tests/test_api.py` using FastAPI `TestClient`:

```python
def test_sync_assets_optimize_round_trip():
    """
    1. POST /api/sync with fixture data injected via monkeypatch on fetch_prices
    2. GET /api/assets — assert SPY/QQQ/TLT present
    3. POST /api/optimize — assert response matches OptimizeResponse schema
    4. GET /api/risk — assert metrics returned
    """
```

---

## Phase 4 — Frontend

### P4.1 — Vite scaffold

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss autoprefixer postcss
npx tailwindcss init -p
npm install -D @playwright/test
npx playwright install chromium
```

`tailwind.config.ts` content pattern:
```
content: ["./index.html", "./src/**/*.{ts,tsx}"]
```

Add to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

### P4.2 — TypeScript API types (`frontend/src/types/api.ts`)

Transcribe the interfaces from specs.md section 10 exactly:

```typescript
AssetInfo, OptimizeRequest, OptimizeResponse,
PortfolioMetrics, RiskCostRow, AssetForecast,
SyncRequest, SyncResponse
```

These are the source of truth — all components import from here, never inline types.

---

### P4.3 — API client (`frontend/src/api/client.ts`)

```typescript
const BASE = ""  // proxied via Vite to localhost:8000

export async function syncTickers(req: SyncRequest): Promise<SyncResponse>
export async function listAssets(): Promise<AssetsResponse>
export async function optimizePortfolio(req: OptimizeRequest): Promise<OptimizeResponse>
export async function getRiskMetrics(
  tickers: string[],
  weights: number[],
  horizonYears: number
): Promise<PortfolioMetrics>
```

Each function throws a typed `ApiError` (with `.status` and `.detail`) on non-2xx responses. No `any` types.

**Vite proxy (`vite.config.ts`):**
```typescript
server: { proxy: { '/api': 'http://localhost:8000' } }
```

---

### P4.4 — `useOptimize` hook (`frontend/src/hooks/useOptimize.ts`)

```typescript
interface UseOptimizeState {
  result: OptimizeResponse | null
  loading: boolean
  error: string | null
}

export function useOptimize(): {
  state: UseOptimizeState
  run: (req: OptimizeRequest) => Promise<void>
  reset: () => void
}
```

- Sets `loading = true` before fetch, `false` after (success or error)
- On `ApiError` with status 422 and `max_achievable` in detail: sets `error` to human-readable infeasibility message
- On other errors: sets `error` to detail string

---

### P4.5 — Components

#### `SyncButton.tsx`
```
Props: { tickers: string[] }
State: idle | syncing | success | error
On click: call syncTickers(tickers)
Display: button text changes to "Syncing…" while loading
On success: show "Synced — {rows_upserted} rows, last date {latest_date}"
On error: show error in red
```

#### `AssetSelector.tsx`
```
Props: { selected: string[], onChange: (tickers: string[]) => void }
On mount: call listAssets() to populate options
Render: text input with autocomplete dropdown
  - user types partial ticker → filter options
  - select → add to selected chips
  - chip × button → remove
  - shows "No data — sync first" if listAssets returns empty
```

#### `ParamForm.tsx`
```
Props: { value: OptimizeRequest, onChange: (r: OptimizeRequest) => void }
Fields:
  - target_return: range slider 5%–60%, step 1%, displays as "X%"
  - horizon_years: button group [2, 3, 5]
  - max_weight: range slider 10%–100%, step 5%, displays as "X%"
  - tax_rate_lt: number input, default 15%
  - tax_rate_st: number input, default 37%
  - n_simulations: select [1000, 5000, 10000] (label: "Fast / Standard / Precise")
Submit button: "Run Optimizer" — disabled while loading
```

#### `WeightsBar.tsx`
```
Props: { weights: Record<string, number> }
Render: for each ticker, a labeled horizontal CSS bar
  bar width = weight * 100%
  label: "SPY  35%"
  colour: deterministic from ticker hash (Tailwind bg-* classes)
Sort: descending by weight
```

#### `MetricsCard.tsx`
```
Props: { metrics: PortfolioMetrics }
Render: 2-column grid of label/value pairs
  - Expected Return (pre-tax): formatted as "+X.X%"
  - Expected Return (after-tax): formatted as "+X.X%"
  - Volatility: formatted as "X.X%"
  - Sharpe Ratio: formatted as "X.XX"
  - Max Drawdown (median): formatted as "−X%"  ← red text
  - Max Drawdown (95th pct): formatted as "−X%"  ← red text, bold
  - CVaR 95%: formatted as "−X%"  ← red text
```

#### `RiskCostTable.tsx`
```
Props: { rows: RiskCostRow[], targetReturn: number }
Render: HTML table
  Columns: Target Return | Min Drawdown (p95) | Volatility | CVaR 95%
  Highlight the row closest to targetReturn with a Tailwind ring
  Values formatted as percentages
  Caption: "Risk cost of each return target"
```

#### `ForecastTable.tsx`
```
Props: { forecasts: Record<string, AssetForecast> }
Render: HTML table
  Columns: Ticker | Exp. Excess Return | Forecast Volatility
  Values formatted as percentages
  Caption: "Per-asset return forecasts (GARCH + shrinkage)"
```

---

### P4.6 — `App.tsx` layout

```
Two-panel layout (Tailwind flex):
  Left panel (w-80, fixed):
    - <AssetSelector>
    - <SyncButton tickers={selected}>
    - <ParamForm>
    - "Run Optimizer" button

  Right panel (flex-1, scrollable):
    if loading:   spinner
    if error:     red error box with message
    if result:
      - <WeightsBar>
      - <MetricsCard>
      - <RiskCostTable>
      - <ForecastTable>
    else:
      empty state: "Select assets and run the optimizer"
```

---

### P4.8 — Playwright config (`frontend/playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 15_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Start the Vite dev server automatically before running tests.
  // Tests mock all /api/* routes — no running backend required.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
```

Add to `package.json` scripts:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

**File structure for Playwright tests:**
```
frontend/
  e2e/
    mocks/
      api.ts       # mock response factories + route setup helper
    app.spec.ts    # full user journey
    components.spec.ts  # isolated component behaviour + error states
```

---

### P4.9 — Playwright tests

#### `e2e/mocks/api.ts`

Define typed mock response factories and a `setupApiMocks` helper that calls `page.route()` for all `/api/*` endpoints. Tests import this and call it in `test.beforeEach`.

```typescript
import type { Page } from '@playwright/test'
import type { AssetsResponse, OptimizeResponse, SyncResponse } from '../src/types/api'

export const mockAssets: AssetsResponse = {
  assets: [
    { ticker: 'SPY',  name: 'SPDR S&P 500 ETF',   latest_date: '2026-02-18', rows: 2520 },
    { ticker: 'QQQ',  name: 'Invesco QQQ Trust',   latest_date: '2026-02-18', rows: 2520 },
    { ticker: 'TLT',  name: 'iShares 20+ Year Treasury', latest_date: '2026-02-18', rows: 2520 },
    { ticker: 'GLD',  name: 'SPDR Gold Shares',    latest_date: '2026-02-18', rows: 2520 },
  ],
}

export const mockSyncSuccess: SyncResponse = {
  status: 'ok', tickers_synced: 4, rows_upserted: 120, latest_date: '2026-02-18',
}

export const mockOptimizeResult: OptimizeResponse = {
  run_id: 'test-run-1',
  feasible: true,
  optimal_portfolio: {
    weights: { SPY: 0.35, QQQ: 0.25, TLT: 0.30, GLD: 0.10 },
    expected_return_pretax: 0.213,
    expected_return_aftertax: 0.187,
    volatility: 0.142,
    sharpe_ratio: 1.21,
    max_drawdown_median: -0.18,
    max_drawdown_p95: -0.31,
    var_95: -0.09,
    cvar_95: -0.14,
  },
  risk_cost_table: [
    { target_return: 0.05, min_drawdown_p95: -0.08, volatility: 0.07, cvar_95: -0.04 },
    { target_return: 0.10, min_drawdown_p95: -0.13, volatility: 0.09, cvar_95: -0.07 },
    { target_return: 0.15, min_drawdown_p95: -0.20, volatility: 0.11, cvar_95: -0.10 },
    { target_return: 0.20, min_drawdown_p95: -0.31, volatility: 0.14, cvar_95: -0.14 },
  ],
  forecasts: {
    SPY: { mu: 0.082, sigma: 0.161 },
    QQQ: { mu: 0.114, sigma: 0.228 },
    TLT: { mu: 0.021, sigma: 0.132 },
    GLD: { mu: 0.048, sigma: 0.153 },
  },
}

export async function setupApiMocks(page: Page, overrides: {
  assets?: AssetsResponse
  sync?: SyncResponse | { status: number; body: object }
  optimize?: OptimizeResponse | { status: number; body: object }
} = {}) {
  await page.route('/api/assets', route =>
    route.fulfill({ json: overrides.assets ?? mockAssets })
  )
  await page.route('/api/sync', route => {
    const override = overrides.sync
    if (override && 'status' in override)
      route.fulfill({ status: override.status, json: override.body })
    else
      route.fulfill({ json: override ?? mockSyncSuccess })
  })
  await page.route('/api/optimize', route => {
    const override = overrides.optimize
    if (override && 'status' in override)
      route.fulfill({ status: override.status, json: override.body })
    else
      route.fulfill({ json: override ?? mockOptimizeResult })
  })
}
```

---

#### `e2e/app.spec.ts` — full user journey

```typescript
test('empty state shown on load', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
  await expect(page.getByText('Select assets and run the optimizer')).toBeVisible()
})

test('asset selector populates from /api/assets', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
  await page.getByRole('textbox', { name: /search assets/i }).fill('SP')
  await expect(page.getByText('SPDR S&P 500 ETF')).toBeVisible()
})

test('can add and remove an asset chip', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
  const input = page.getByRole('textbox', { name: /search assets/i })
  await input.fill('SPY')
  await page.getByRole('option', { name: /SPY/ }).click()
  await expect(page.getByTestId('chip-SPY')).toBeVisible()
  await page.getByTestId('chip-SPY').getByRole('button').click()
  await expect(page.getByTestId('chip-SPY')).not.toBeVisible()
})

test('sync button shows success message', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
  // Add SPY so the sync button is enabled
  await page.getByRole('textbox', { name: /search assets/i }).fill('SPY')
  await page.getByRole('option', { name: /SPY/ }).click()
  await page.getByRole('button', { name: /sync data/i }).click()
  await expect(page.getByText(/synced — 120 rows/i)).toBeVisible()
})

test('happy path: full optimize run renders all result panels', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')

  // Select assets
  for (const ticker of ['SPY', 'QQQ', 'TLT', 'GLD']) {
    await page.getByRole('textbox', { name: /search assets/i }).fill(ticker)
    await page.getByRole('option', { name: new RegExp(ticker) }).click()
  }

  await page.getByRole('button', { name: /run optimizer/i }).click()

  // WeightsBar: all 4 tickers visible
  await expect(page.getByTestId('weight-bar-SPY')).toBeVisible()
  await expect(page.getByTestId('weight-bar-QQQ')).toBeVisible()

  // MetricsCard: key values visible
  await expect(page.getByText('21.3%')).toBeVisible()  // pretax return
  await expect(page.getByText('18.7%')).toBeVisible()  // aftertax return
  await expect(page.getByText('−31%')).toBeVisible()   // max drawdown p95

  // RiskCostTable present
  await expect(page.getByText('Risk cost of each return target')).toBeVisible()

  // ForecastTable present
  await expect(page.getByText('Per-asset return forecasts')).toBeVisible()
})

test('run optimizer button is disabled while loading', async ({ page }) => {
  await setupApiMocks(page)
  // Slow down the optimize response to catch the loading state
  await page.route('/api/optimize', async route => {
    await new Promise(r => setTimeout(r, 500))
    await route.fulfill({ json: mockOptimizeResult })
  })
  await page.goto('/')
  for (const ticker of ['SPY', 'QQQ']) {
    await page.getByRole('textbox', { name: /search assets/i }).fill(ticker)
    await page.getByRole('option', { name: new RegExp(ticker) }).click()
  }
  await page.getByRole('button', { name: /run optimizer/i }).click()
  await expect(page.getByRole('button', { name: /run optimizer/i })).toBeDisabled()
})
```

---

#### `e2e/components.spec.ts` — error states + component edge cases

```typescript
test('shows infeasibility error when target return too high', async ({ page }) => {
  await setupApiMocks(page, {
    optimize: {
      status: 422,
      body: { detail: { error: 'infeasible', max_achievable: 0.14 } },
    },
  })
  await page.goto('/')
  for (const ticker of ['SPY', 'QQQ']) {
    await page.getByRole('textbox', { name: /search assets/i }).fill(ticker)
    await page.getByRole('option', { name: new RegExp(ticker) }).click()
  }
  await page.getByRole('button', { name: /run optimizer/i }).click()
  await expect(page.getByText(/max achievable.*14%/i)).toBeVisible()
})

test('shows sync error message on backend failure', async ({ page }) => {
  await setupApiMocks(page, {
    sync: { status: 502, body: { detail: 'Yahoo Finance unavailable' } },
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: /search assets/i }).fill('SPY')
  await page.getByRole('option', { name: /SPY/ }).click()
  await page.getByRole('button', { name: /sync data/i }).click()
  await expect(page.getByText(/yahoo finance unavailable/i)).toBeVisible()
})

test('shows "no data — sync first" when assets list is empty', async ({ page }) => {
  await setupApiMocks(page, { assets: { assets: [] } })
  await page.goto('/')
  await page.getByRole('textbox', { name: /search assets/i }).click()
  await expect(page.getByText(/no data — sync first/i)).toBeVisible()
})

test('RiskCostTable highlights row matching target return', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
  for (const ticker of ['SPY', 'QQQ', 'TLT', 'GLD']) {
    await page.getByRole('textbox', { name: /search assets/i }).fill(ticker)
    await page.getByRole('option', { name: new RegExp(ticker) }).click()
  }
  // Default target return is 20% — the 0.20 row should be highlighted
  await page.getByRole('button', { name: /run optimizer/i }).click()
  await expect(page.getByTestId('risk-row-0.20')).toHaveClass(/ring/)
})

test('MetricsCard formats negative drawdown values with minus sign', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
  for (const ticker of ['SPY', 'QQQ']) {
    await page.getByRole('textbox', { name: /search assets/i }).fill(ticker)
    await page.getByRole('option', { name: new RegExp(ticker) }).click()
  }
  await page.getByRole('button', { name: /run optimizer/i }).click()
  // max_drawdown_p95 = -0.31 → should display "−31%", NOT "31%" or "-31%"
  await expect(page.getByTestId('metric-max_drawdown_p95')).toHaveText('−31%')
})

test('ParamForm horizon selector updates value', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/')
  await page.getByRole('button', { name: '5' }).click()  // horizon = 5 years
  // Verify it's reflected in the submitted request
  let capturedBody: string | null = null
  await page.route('/api/optimize', async route => {
    capturedBody = route.request().postData()
    await route.fulfill({ json: mockOptimizeResult })
  })
  for (const ticker of ['SPY', 'QQQ']) {
    await page.getByRole('textbox', { name: /search assets/i }).fill(ticker)
    await page.getByRole('option', { name: new RegExp(ticker) }).click()
  }
  await page.getByRole('button', { name: /run optimizer/i }).click()
  await page.waitForResponse('/api/optimize')
  expect(JSON.parse(capturedBody!).horizon_years).toBe(5)
})
```

**`data-testid` attributes required on components** (add during P4.5):

| Component | `data-testid` |
|---|---|
| `AssetSelector` chip | `chip-{TICKER}` |
| `WeightsBar` per row | `weight-bar-{TICKER}` |
| `MetricsCard` each metric value | `metric-{field_name}` |
| `RiskCostTable` each row | `risk-row-{target_return}` |

These are the only `data-testid` attributes needed. All other selectors use semantic roles and text.

---

### P4.7 — FastAPI serves frontend build

In `backend/main.py`, after all routers:

```python
from fastapi.staticfiles import StaticFiles
import os

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
```

Build command: `cd frontend && npm run build`

In dev, frontend runs on `:5173` (Vite) proxying to backend on `:8000`. In production, only `uvicorn backend.main:app` is needed.

---

## Phase 5 — End-to-End Verification

### P5.1 — Manual smoke test checklist

```
[ ] uvicorn backend.main:app starts without error
[ ] GET /healthz → {"status":"ok"}
[ ] POST /api/sync {tickers:["SPY","QQQ","TLT","GLD"], lookback_years:5} returns success
[ ] GET /api/assets returns 4 tickers
[ ] POST /api/optimize {tickers:[...], target_return:0.15, horizon_years:3}
      → feasible:true
      → weights sum to 1.0
      → risk_cost_table has ~20 rows
      → max_drawdown_p95 < 0
[ ] POST /api/optimize with target_return:0.99 → HTTP 422 infeasible
[ ] Frontend (npm run dev): asset selector populates from /api/assets
[ ] Sync button triggers sync and shows row count
[ ] Running optimizer populates all result panels
[ ] RiskCostTable highlights correct row
```

### P5.2 — Performance check

Monte Carlo with N=10,000 and 3 assets over horizon=3 must complete the full optimize call in < 30 seconds on an M-series Mac. If not:
- Reduce default N to 5,000
- Or vectorise `simulate_paths` using `np.random.default_rng().multivariate_normal` with `size=(N, H)`

---

## Dependency Graph

```
P0.1 → P0.2 → P0.3 → P0.4
P0.1 → P0.5                  (CLI depends on repo structure)
P0.1 → P0.6                  (.env.example depends on knowing all config keys)

P0.4 → P1.1 → P1.2 → P1.3 → P1.4
                              P1.3 → P1.5
P1.1 → P1.6 (registers P1.4, P1.5)

P1.1 → P2.1 → P2.2 → P2.3 → P2.4
                       P2.3 → P2.4
                P2.1 → P2.5
P2.1 + P2.2 + P2.3 + P2.4 + P2.5 → P2.6

P2.6 → P3.1 → P3.3
P1.5 → P3.3
P2.3 → P3.2 → P3.3
P3.3 → P3.4

P3.3 → P4.1 → P4.2 → P4.3 → P4.4
                       P4.3 → P4.5 → P4.6 → P4.7
P4.1 → P4.8
P4.2 + P4.5 + P4.6 → P4.9   (tests depend on types + testids being on components)

P0.5 + P4.7 → P5.1           (CLI `start` command requires built frontend)
P3.4 + P4.9 → P5.1           (smoke test requires all tests passing first)
```

---

## What Is Explicitly Out of Scope (v1)

- HMM regime detection (`hmmlearn`) — v2
- Real-time price feeds
- Portfolio tracking / transaction history
- Multi-user / auth
- Tax-loss harvesting engine
- Copula / tail dependence modeling
- Stress scenario engine ("tech drops 40%")
