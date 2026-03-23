from __future__ import annotations
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent.parent / ".env")

# Storage
DB_PATH: str = os.getenv("DB_PATH", str(Path(__file__).parent.parent / "data" / "financily.duckdb"))

# Data fetch
LOOKBACK_YEARS: int = int(os.getenv("LOOKBACK_YEARS", "10"))
RISK_FREE_SERIES: str = os.getenv("RISK_FREE_SERIES", "DGS3MO")
FRED_API_KEY: str | None = os.getenv("FRED_API_KEY")

# Forecasting engine
MARKET_TICKER: str = os.getenv("MARKET_TICKER", "SPY")
GARCH_WINDOW_YEARS: int = int(os.getenv("GARCH_WINDOW_YEARS", "3"))
SHRINKAGE_LAMBDA: float = float(os.getenv("SHRINKAGE_LAMBDA", "0.3"))

# Risk engine / Monte Carlo
N_SIMULATIONS: int = int(os.getenv("N_SIMULATIONS", "10000"))
RANDOM_SEED: int = int(os.getenv("RANDOM_SEED", "42"))

# Optimizer
MAX_WEIGHT: float = float(os.getenv("MAX_WEIGHT", "0.40"))
FRONTIER_STEPS: int = int(os.getenv("FRONTIER_STEPS", "20"))
N_OPTIMIZER_STARTS: int = int(os.getenv("N_OPTIMIZER_STARTS", "5"))

# Tax model
DEFAULT_TAX_RATE_LT: float = float(os.getenv("DEFAULT_TAX_RATE_LT", "0.15"))
DEFAULT_TAX_RATE_ST: float = float(os.getenv("DEFAULT_TAX_RATE_ST", "0.37"))

# Due Diligence AI feature
ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY")
DD_MODEL: str = os.getenv("DD_MODEL", "claude-sonnet-4-6")
DD_MAX_TOKENS: int = int(os.getenv("DD_MAX_TOKENS", "4096"))
DD_CHAT_MAX_TOKENS: int = int(os.getenv("DD_CHAT_MAX_TOKENS", "1024"))
