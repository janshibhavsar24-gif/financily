from __future__ import annotations
import numpy as np
from scipy.optimize import minimize, LinearConstraint, Bounds

from backend.config import (
    MAX_WEIGHT, N_SIMULATIONS, RANDOM_SEED, FRONTIER_STEPS, N_OPTIMIZER_STARTS
)
from backend.engine.risk import (
    compute_max_drawdown_distribution,
    compute_var_cvar,
    simulate_paths,
)


def check_feasibility(
    mu: np.ndarray,
    target_return: float,
    max_weight: float = MAX_WEIGHT,
) -> tuple[bool, float]:
    """
    Conservative feasibility check: max achievable = max(mu) + rf (rf already in mu as excess).
    We use max single-asset excess return as upper bound.
    Returns (is_feasible, max_achievable).
    """
    # max achievable excess return (if we could put 100% in best asset)
    max_achievable = float(np.max(mu))
    is_feasible = max_achievable >= target_return
    return is_feasible, max_achievable


def _objective(
    weights: np.ndarray,
    mu: np.ndarray,
    cov: np.ndarray,
    horizon_years: int,
    n_simulations: int,
    seed: int,
) -> float:
    """Returns p95 max drawdown as a POSITIVE float (for minimisation)."""
    paths = simulate_paths(mu, cov, weights, horizon_years, n_simulations, seed)
    _, p95_mdd = compute_max_drawdown_distribution(paths)
    return -p95_mdd  # p95_mdd is negative; negate to get positive for minimiser


def optimize_portfolio(
    mu: np.ndarray,
    cov: np.ndarray,
    target_return: float,
    horizon_years: int,
    max_weight: float = MAX_WEIGHT,
    n_simulations: int = N_SIMULATIONS,
    n_starts: int = N_OPTIMIZER_STARTS,
    seed: int = RANDOM_SEED,
) -> np.ndarray:
    """
    Run SLSQP from n_starts Dirichlet random starts.
    Returns weights with the lowest objective (best p95 drawdown).
    Raises RuntimeError if all starts fail.
    """
    n = len(mu)
    rng = np.random.default_rng(seed)

    constraints = [
        LinearConstraint(mu, target_return, np.inf),   # return >= target (excess)
        LinearConstraint(np.ones(n), 1.0, 1.0),        # weights sum to 1
    ]
    bounds = Bounds(lb=0.0, ub=max_weight)

    best_weights = None
    best_obj = np.inf

    for i in range(n_starts):
        w0 = rng.dirichlet(np.ones(n))
        w0 = np.clip(w0, 0.0, max_weight)
        w0 /= w0.sum()

        try:
            result = minimize(
                _objective,
                x0=w0,
                args=(mu, cov, horizon_years, n_simulations, seed + i),
                method="SLSQP",
                bounds=bounds,
                constraints=constraints,
                options={"ftol": 1e-8, "maxiter": 500},
            )
            if result.success and result.fun < best_obj:
                best_obj = result.fun
                best_weights = result.x
        except Exception:
            continue

    if best_weights is None:
        raise RuntimeError("Optimization failed to converge after all starts.")

    # Normalise to sum exactly to 1
    best_weights = np.clip(best_weights, 0.0, max_weight)
    best_weights /= best_weights.sum()
    return best_weights


def compute_risk_cost_table(
    mu: np.ndarray,
    cov: np.ndarray,
    risk_free_rate: float,
    horizon_years: int,
    max_weight: float = MAX_WEIGHT,
    n_steps: int = FRONTIER_STEPS,
    n_simulations: int = 1000,
) -> list[dict]:
    """
    Sweep target_return from rf to 0.95 * max(mu) in n_steps.
    Returns list of dicts: {target_return, min_drawdown_p95, volatility, cvar_95}.
    Skips infeasible points silently. Returns at least the feasible subset.
    """
    max_excess = float(np.max(mu))
    lo = 0.0  # start from 0 excess return (= risk_free_rate gross)
    hi = 0.95 * max_excess

    if hi <= lo:
        return []

    targets = np.linspace(lo, hi, n_steps)
    rows = []

    for i, target in enumerate(targets):
        feasible, _ = check_feasibility(mu, target, max_weight)
        if not feasible:
            continue
        try:
            w = optimize_portfolio(
                mu, cov, target, horizon_years,
                max_weight=max_weight,
                n_simulations=n_simulations,
                n_starts=2,
                seed=RANDOM_SEED + i,
            )
        except RuntimeError:
            continue

        paths = simulate_paths(mu, cov, w, horizon_years, n_simulations, RANDOM_SEED + i)
        _, p95_mdd = compute_max_drawdown_distribution(paths)
        _, cvar_95 = compute_var_cvar(paths)
        vol = float(np.sqrt(w @ cov @ w))

        rows.append({
            "target_return": float(target + risk_free_rate),  # gross return
            "min_drawdown_p95": float(p95_mdd),
            "volatility": float(vol),
            "cvar_95": float(cvar_95),
        })

    return rows
