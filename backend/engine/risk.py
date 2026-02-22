import numpy as np
from backend.config import N_SIMULATIONS, RANDOM_SEED


def simulate_paths(
    mu: np.ndarray,
    cov: np.ndarray,
    weights: np.ndarray,
    horizon_years: int,
    n_simulations: int = N_SIMULATIONS,
    seed: int = RANDOM_SEED,
) -> np.ndarray:
    """
    Draw annual returns via MVN and project portfolio returns.
    Returns array of shape (n_simulations, horizon_years).
    """
    rng = np.random.default_rng(seed)
    # shape: (n_simulations, horizon_years, n_assets)
    asset_returns = rng.multivariate_normal(mu, cov, size=(n_simulations, horizon_years))
    # portfolio return per year per path
    port_returns = asset_returns @ weights
    return port_returns


def compute_max_drawdown_distribution(
    paths: np.ndarray,
) -> tuple[float, float]:
    """
    Compute max drawdown for each path.
    Returns (median_mdd, p95_mdd) — both negative floats.
    p95 <= median (both negative).
    """
    n_sims, horizon = paths.shape
    max_drawdowns = np.empty(n_sims)

    for i in range(n_sims):
        wealth = np.cumprod(1.0 + paths[i])
        peak = np.maximum.accumulate(wealth)
        drawdowns = (peak - wealth) / peak
        max_drawdowns[i] = float(np.max(drawdowns))

    # Both returned as negative floats (drawdown magnitude negated)
    median_mdd = float(-np.median(max_drawdowns))
    p95_mdd = float(-np.percentile(max_drawdowns, 95))

    return median_mdd, p95_mdd


def compute_var_cvar(
    paths: np.ndarray,
    confidence: float = 0.95,
) -> tuple[float, float]:
    """
    Compound each path to total return over the horizon.
    VaR  = (1 - confidence) percentile of total returns (negative float).
    CVaR = mean of total returns <= VaR (negative float).
    CVaR <= VaR.
    """
    total_returns = np.prod(1.0 + paths, axis=1) - 1.0
    var = float(np.percentile(total_returns, (1.0 - confidence) * 100.0))
    tail = total_returns[total_returns <= var]
    cvar = float(np.mean(tail)) if len(tail) > 0 else var
    return var, cvar


def compute_portfolio_metrics(
    weights: np.ndarray,
    mu: np.ndarray,
    cov: np.ndarray,
    horizon_years: int,
    risk_free_rate: float,
    n_simulations: int = N_SIMULATIONS,
    seed: int = RANDOM_SEED,
) -> dict:
    """
    Compute the full metric bundle for a portfolio weight vector.
    `mu` is already excess return (rf subtracted in forecaster).
    expected_return_pretax adds rf back to report the gross return.
    """
    paths = simulate_paths(mu, cov, weights, horizon_years, n_simulations, seed)

    median_mdd, p95_mdd = compute_max_drawdown_distribution(paths)
    var_95, cvar_95 = compute_var_cvar(paths)

    port_excess = float(weights @ mu)
    expected_return_pretax = port_excess + risk_free_rate
    volatility = float(np.sqrt(weights @ cov @ weights))
    sharpe = (expected_return_pretax - risk_free_rate) / volatility if volatility > 0 else 0.0

    return {
        "expected_return_pretax": expected_return_pretax,
        "volatility": volatility,
        "sharpe_ratio": sharpe,
        "max_drawdown_median": median_mdd,
        "max_drawdown_p95": p95_mdd,
        "var_95": var_95,
        "cvar_95": cvar_95,
    }
