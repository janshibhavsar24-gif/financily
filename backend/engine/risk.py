# risk.py — portfolio risk metrics via Monte Carlo simulation.
#
# Pipeline:
#   simulate_paths → compute_max_drawdown_distribution
#                  → compute_var_cvar
#                  → compute_portfolio_metrics (combines all above)
#
# Public entry point: compute_portfolio_metrics() — call this from optimizer.py
# and api/risk.py. All other functions are internal helpers.
#
# Rules:
#   - All functions are pure (no DuckDB, no network calls).
#   - All stochastic functions accept a seed parameter (default RANDOM_SEED).
#   - Same seed + same inputs = identical output (reproducibility requirement).
#   - Drawdown, VaR, CVaR are always returned as NEGATIVE floats.
#   - Max drawdown p95 <= max drawdown median (both negative).
#   - CVaR <= VaR (both negative — CVaR is always at least as bad).

# TODO: import numpy as np
# TODO: from backend.config import N_SIMULATIONS, RANDOM_SEED

# ---------------------------------------------------------------------------
# Step 1 — Simulate return paths
# ---------------------------------------------------------------------------

# TODO: def simulate_paths(
#     mu: np.ndarray,           # shape (n,) — annualised excess returns
#     cov: np.ndarray,          # shape (n, n) — annualised covariance
#     weights: np.ndarray,      # shape (n,) — portfolio weights, sum to 1
#     horizon_years: int,
#     n_simulations: int = N_SIMULATIONS,
#     seed: int = RANDOM_SEED,
# ) -> np.ndarray:
#   """
#   Draw n_simulations * horizon_years samples from MVN(mu, cov).
#   Each draw = one year of asset returns for one path.
#   Portfolio return per year = weights @ asset_returns.
#   Return array shape (n_simulations, horizon_years).
#
#   Use np.random.default_rng(seed).multivariate_normal(mu, cov, size=(n_simulations, horizon_years))
#   for efficient vectorised drawing. Avoid loops.
#   """

# ---------------------------------------------------------------------------
# Step 2a — Max drawdown distribution
# ---------------------------------------------------------------------------

# TODO: def compute_max_drawdown_distribution(
#     paths: np.ndarray,    # shape (n_simulations, horizon_years)
# ) -> tuple[float, float]:
#   """
#   For each path:
#     1. Compute cumulative wealth: cumprod(1 + annual_return)
#     2. Running peak = cummax of wealth series
#     3. Drawdown at each step = (peak - wealth) / peak
#     4. Max drawdown for path = max(drawdown over all steps)
#
#   Return (median_max_drawdown, p95_max_drawdown) — both negative floats.
#   p95 is the 95th percentile of the drawdown distribution (worst tail).
#   Assert p95 <= median (both negative) before returning.
#   """

# ---------------------------------------------------------------------------
# Step 2b — VaR and CVaR
# ---------------------------------------------------------------------------

# TODO: def compute_var_cvar(
#     paths: np.ndarray,       # shape (n_simulations, horizon_years)
#     confidence: float = 0.95,
# ) -> tuple[float, float]:
#   """
#   Compound each path to total return: total[i] = prod(1 + paths[i]) - 1
#   VaR  = np.percentile(total, (1 - confidence) * 100)   → negative float
#   CVaR = mean of total[total <= VaR]                     → negative float
#   Assert CVaR <= VaR before returning.
#   """

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

# TODO: def compute_portfolio_metrics(
#     weights: np.ndarray,
#     mu: np.ndarray,
#     cov: np.ndarray,
#     horizon_years: int,
#     risk_free_rate: float,
#     n_simulations: int = N_SIMULATIONS,
#     seed: int = RANDOM_SEED,
# ) -> dict:
#   """
#   Compute the full metric bundle for a given weight vector.
#   All metrics are computed from the same simulation draw.
#
#   Returns:
#     {
#       "expected_return_pretax": float,   # (w @ mu + rf) * 252 — NOT excess
#       "volatility": float,               # sqrt(w @ cov @ w)
#       "sharpe_ratio": float,             # (E[r] - rf) / vol
#       "max_drawdown_median": float,      # negative
#       "max_drawdown_p95": float,         # negative, <= median
#       "var_95": float,                   # negative
#       "cvar_95": float,                  # negative, <= var_95
#     }
#   Note: expected_return_pretax is the gross return (rf already added back).
#   The `mu` passed in is excess return (rf already subtracted in forecaster.py).
#   """
