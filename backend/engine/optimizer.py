# optimizer.py — SLSQP portfolio optimisation (min max drawdown, s.t. return target).
#
# Problem formulation:
#   Minimise:    p95_max_drawdown(w)
#   Subject to:  w @ mu * 252 >= target_return
#                sum(w) == 1
#                0 <= w_i <= max_weight  for all i
#
# Pipeline:
#   check_feasibility → optimize_portfolio → compute_risk_cost_table
#
# Rules:
#   - Pure functions only. No DuckDB, no network calls.
#   - Always try N_OPTIMIZER_STARTS random starting points; return the best.
#   - If ALL starts fail to converge, raise RuntimeError (caught by api/optimize.py → 500).
#   - compute_risk_cost_table sweeps 20 points on the frontier — skip infeasible ones silently.
#   - The objective function calls simulate_paths internally — keep n_simulations
#     moderate (1000) during the sweep to stay within the 30s performance budget,
#     and use the full N_SIMULATIONS for the final optimal portfolio metrics.

# TODO: import numpy as np
# TODO: from scipy.optimize import minimize, LinearConstraint, Bounds
# TODO: from backend.config import (
#     MAX_WEIGHT, N_SIMULATIONS, RANDOM_SEED, FRONTIER_STEPS, N_OPTIMIZER_STARTS
# )
# TODO: from backend.engine.risk import compute_max_drawdown_distribution, simulate_paths

# ---------------------------------------------------------------------------
# Feasibility check
# ---------------------------------------------------------------------------

# TODO: def check_feasibility(
#     mu: np.ndarray,          # shape (n,) — annualised excess returns
#     target_return: float,    # annualised, e.g. 0.20 for 20%
#     max_weight: float = MAX_WEIGHT,
# ) -> tuple[bool, float]:
#   """
#   Upper bound on achievable return given max_weight constraint:
#     max_achievable = max(mu) * 252 * max_weight + ...
#   Conservative check: max_achievable = max(mu) * 252
#   (single asset at 100% is always >= any constrained portfolio)
#
#   Return (is_feasible: bool, max_achievable: float).
#   If not feasible, api/optimize.py raises HTTP 422 without calling the solver.
#   """

# ---------------------------------------------------------------------------
# Objective function (internal)
# ---------------------------------------------------------------------------

# TODO: def _objective(
#     weights: np.ndarray,
#     mu: np.ndarray,
#     cov: np.ndarray,
#     horizon_years: int,
#     n_simulations: int,
#     seed: int,
# ) -> float:
#   """
#   Returns p95 max drawdown as a POSITIVE float (for minimisation).
#   Internally calls simulate_paths then compute_max_drawdown_distribution.
#   scipy.optimize.minimize minimises, so negate the negative p95 drawdown.
#   """

# ---------------------------------------------------------------------------
# Main optimizer
# ---------------------------------------------------------------------------

# TODO: def optimize_portfolio(
#     mu: np.ndarray,
#     cov: np.ndarray,
#     target_return: float,
#     horizon_years: int,
#     max_weight: float = MAX_WEIGHT,
#     n_simulations: int = N_SIMULATIONS,
#     n_starts: int = N_OPTIMIZER_STARTS,
#     seed: int = RANDOM_SEED,
# ) -> np.ndarray:
#   """
#   Run SLSQP from n_starts Dirichlet(1,...,1) random starting points.
#   Return weights of the run with the lowest objective value.
#   Raise RuntimeError("Optimization failed to converge.") if all starts fail.
#
#   Constraints for scipy:
#     LinearConstraint(mu * 252, target_return, np.inf)  — return >= target
#     LinearConstraint(ones, 1.0, 1.0)                   — weights sum to 1
#   Bounds: (0, max_weight) per weight.
#   """

# ---------------------------------------------------------------------------
# Efficient frontier sweep
# ---------------------------------------------------------------------------

# TODO: def compute_risk_cost_table(
#     mu: np.ndarray,
#     cov: np.ndarray,
#     risk_free_rate: float,
#     horizon_years: int,
#     max_weight: float = MAX_WEIGHT,
#     n_steps: int = FRONTIER_STEPS,
#     n_simulations: int = 1000,    # intentionally lower — 20 runs × 1000 = fast
# ) -> list[dict]:
#   """
#   Sweep target_return from risk_free_rate to 0.95 * max(mu) * 252
#   in n_steps equally-spaced points.
#
#   For each point:
#     1. check_feasibility — skip if not feasible
#     2. optimize_portfolio
#     3. simulate_paths + compute_max_drawdown_distribution + compute_var_cvar
#
#   Return list of dicts:
#     [{"target_return", "min_drawdown_p95", "volatility", "cvar_95"}, ...]
#
#   Must return at least 15 rows (requirement OPT-007).
#   Frontier must be monotonically non-decreasing in drawdown magnitude (OPT-008).
#   """
