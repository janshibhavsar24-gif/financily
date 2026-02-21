# config.py — single source of truth for all runtime configuration.
#
# Rules:
#   - Every tuneable value in the system is defined here.
#   - Values are read from environment variables via python-dotenv.
#   - Hardcoded fallback defaults are used when no .env file is present.
#   - No other file should hardcode these values — always import from here.
#   - The .env file lives at the repo root and is loaded automatically.
#
# Usage:
#   from backend.config import DB_PATH, N_SIMULATIONS
#
# To change a value for a session, set it in .env (copy from .env.example).

# TODO: from pathlib import Path
# TODO: from dotenv import load_dotenv
# TODO: import os

# TODO: load_dotenv(Path(__file__).parent.parent / ".env")

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

# TODO: DB_PATH: str = os.getenv("DB_PATH", str(Path(__file__).parent.parent / "data" / "financily.duckdb"))
#   Absolute path to the DuckDB file. Created automatically on first run.

# ---------------------------------------------------------------------------
# Data fetch
# ---------------------------------------------------------------------------

# TODO: LOOKBACK_YEARS: int = int(os.getenv("LOOKBACK_YEARS", "10"))
#   Years of price history fetched on a fresh sync (no prior data).

# TODO: RISK_FREE_SERIES: str = os.getenv("RISK_FREE_SERIES", "DGS3MO")
#   FRED series ID for the risk-free rate (3-month T-bill).

# TODO: FRED_API_KEY: str | None = os.getenv("FRED_API_KEY")
#   Optional. If absent, risk-free rate falls back to yfinance ^IRX.

# ---------------------------------------------------------------------------
# Forecasting engine
# ---------------------------------------------------------------------------

# TODO: MARKET_TICKER: str = os.getenv("MARKET_TICKER", "SPY")
#   Reference market used for James-Stein shrinkage target.
#   Always fetched alongside user-requested tickers even if not in universe.

# TODO: GARCH_WINDOW_YEARS: int = int(os.getenv("GARCH_WINDOW_YEARS", "3"))
#   Trailing window (years) used for GARCH fit, mean estimation, and covariance.

# TODO: SHRINKAGE_LAMBDA: float = float(os.getenv("SHRINKAGE_LAMBDA", "0.3"))
#   James-Stein shrinkage intensity. 0 = no shrinkage, 1 = full shrinkage to market mean.

# ---------------------------------------------------------------------------
# Risk engine / Monte Carlo
# ---------------------------------------------------------------------------

# TODO: N_SIMULATIONS: int = int(os.getenv("N_SIMULATIONS", "10000"))
#   Number of Monte Carlo paths. Reduce to 5000 if optimize calls exceed 30s.

# TODO: RANDOM_SEED: int = int(os.getenv("RANDOM_SEED", "42"))
#   Global seed for all stochastic operations. Ensures reproducibility.

# ---------------------------------------------------------------------------
# Optimizer
# ---------------------------------------------------------------------------

# TODO: MAX_WEIGHT: float = float(os.getenv("MAX_WEIGHT", "0.40"))
#   Maximum weight for any single asset. User can override per request.

# TODO: FRONTIER_STEPS: int = int(os.getenv("FRONTIER_STEPS", "20"))
#   Number of points on the efficient frontier sweep in compute_risk_cost_table.

# TODO: N_OPTIMIZER_STARTS: int = int(os.getenv("N_OPTIMIZER_STARTS", "5"))
#   Number of random starting points for SLSQP. Best solution across all is returned.

# ---------------------------------------------------------------------------
# Tax model
# ---------------------------------------------------------------------------

# TODO: DEFAULT_TAX_RATE_LT: float = float(os.getenv("DEFAULT_TAX_RATE_LT", "0.15"))
#   Long-term capital gains rate. User can override per /api/optimize request.

# TODO: DEFAULT_TAX_RATE_ST: float = float(os.getenv("DEFAULT_TAX_RATE_ST", "0.37"))
#   Short-term capital gains rate (top ordinary income bracket).
