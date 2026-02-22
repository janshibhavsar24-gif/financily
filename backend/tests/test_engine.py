import pytest
import numpy as np
import pandas as pd
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def returns_df() -> pd.DataFrame:
    """Load returns_spy_qqq_tlt.csv once for the entire test session."""
    path = FIXTURES_DIR / "returns_spy_qqq_tlt.csv"
    return pd.read_csv(path, index_col="date", parse_dates=True)


# ---------------------------------------------------------------------------
# forecaster.py tests
# ---------------------------------------------------------------------------

def test_compute_historical_mean_annualises_correctly(returns_df):
    from backend.engine.forecaster import compute_historical_mean
    result = compute_historical_mean(returns_df["SPY"])
    assert isinstance(result, float)
    assert -0.30 <= result <= 0.50


def test_fit_garch_volatility_returns_positive_float(returns_df):
    from backend.engine.forecaster import fit_garch_volatility
    result = fit_garch_volatility(returns_df["SPY"])
    assert result > 0
    assert np.isfinite(result)


def test_fit_garch_volatility_never_raises(returns_df):
    from backend.engine.forecaster import fit_garch_volatility
    result = fit_garch_volatility(pd.Series(np.zeros(100)))
    assert result >= 0


def test_james_stein_shrinkage_lies_between_hist_and_market():
    from backend.engine.forecaster import james_stein_shrinkage
    mu_hist = np.array([0.15, 0.10, 0.05])
    mu_market = 0.08
    result = james_stein_shrinkage(mu_hist, mu_market, lam=0.3)
    for h, r in zip(mu_hist, result):
        lo = min(h, mu_market)
        hi = max(h, mu_market)
        assert lo <= r <= hi


# ---------------------------------------------------------------------------
# covariance.py tests
# ---------------------------------------------------------------------------

def test_ledoit_wolf_covariance_is_psd(returns_df):
    from backend.engine.covariance import ledoit_wolf_covariance
    cov = ledoit_wolf_covariance(returns_df)
    eigenvalues = np.linalg.eigvalsh(cov)
    assert np.all(eigenvalues >= -1e-9)


def test_ledoit_wolf_covariance_is_symmetric(returns_df):
    from backend.engine.covariance import ledoit_wolf_covariance
    cov = ledoit_wolf_covariance(returns_df)
    assert np.allclose(cov, cov.T)


# ---------------------------------------------------------------------------
# risk.py tests
# ---------------------------------------------------------------------------

def test_simulate_paths_shape_and_reproducibility():
    from backend.engine.risk import simulate_paths
    mu = np.array([0.08, 0.10, 0.03])
    cov = np.eye(3) * 0.04
    w = np.array([0.4, 0.4, 0.2])
    paths1 = simulate_paths(mu, cov, w, horizon_years=3, n_simulations=500, seed=42)
    paths2 = simulate_paths(mu, cov, w, horizon_years=3, n_simulations=500, seed=42)
    assert paths1.shape == (500, 3)
    assert np.allclose(paths1, paths2)


def test_max_drawdown_distribution_ordering():
    from backend.engine.risk import simulate_paths, compute_max_drawdown_distribution
    mu = np.array([0.08, 0.06])
    cov = np.eye(2) * 0.04
    w = np.array([0.6, 0.4])
    paths = simulate_paths(mu, cov, w, horizon_years=5, n_simulations=2000, seed=42)
    median_mdd, p95_mdd = compute_max_drawdown_distribution(paths)
    assert median_mdd < 0
    assert p95_mdd <= median_mdd


def test_cvar_worse_than_var():
    from backend.engine.risk import simulate_paths, compute_var_cvar
    mu = np.array([0.08, 0.06])
    cov = np.eye(2) * 0.04
    w = np.array([0.6, 0.4])
    paths = simulate_paths(mu, cov, w, horizon_years=5, n_simulations=2000, seed=42)
    var, cvar = compute_var_cvar(paths)
    assert cvar <= var


# ---------------------------------------------------------------------------
# tax.py tests
# ---------------------------------------------------------------------------

def test_estimate_turnover_zero_for_identical_weights():
    from backend.engine.tax import estimate_turnover
    assert estimate_turnover(np.array([0.25] * 4), np.array([0.25] * 4)) == pytest.approx(0.0)


def test_estimate_turnover_half_for_full_rotation():
    from backend.engine.tax import estimate_turnover
    assert estimate_turnover(np.array([0.5, 0.5]), np.array([1.0, 0.0])) == pytest.approx(0.5)


def test_after_tax_return_buy_and_hold():
    from backend.engine.tax import after_tax_return
    result = after_tax_return(0.20, turnover=0.0, tax_rate_lt=0.15, tax_rate_st=0.37)
    assert result == pytest.approx(0.17, abs=1e-4)


def test_after_tax_return_full_turnover():
    from backend.engine.tax import after_tax_return
    result = after_tax_return(0.20, turnover=1.0, tax_rate_lt=0.15, tax_rate_st=0.37)
    assert result == pytest.approx(0.126, abs=1e-4)


# ---------------------------------------------------------------------------
# Integration test — full pipeline
# ---------------------------------------------------------------------------

def test_full_pipeline_spy_qqq_tlt(returns_df):
    """
    End-to-end pipeline using fixture data (no network, no DuckDB).
    forecast → covariance → optimizer → metrics → tax.
    """
    from backend.engine.forecaster import compute_historical_mean, james_stein_shrinkage
    from backend.engine.covariance import ledoit_wolf_covariance
    from backend.engine.optimizer import optimize_portfolio
    from backend.engine.risk import compute_portfolio_metrics
    from backend.engine.tax import after_tax_return, estimate_turnover

    tickers = ["SPY", "QQQ", "TLT"]
    mu_hist = np.array([compute_historical_mean(returns_df[t]) for t in tickers])
    market_mu = compute_historical_mean(returns_df["SPY"])
    mu_shrunk = james_stein_shrinkage(mu_hist, market_mu)
    rf = 0.05
    mu = mu_shrunk - rf

    cov = ledoit_wolf_covariance(returns_df[tickers])

    weights = optimize_portfolio(
        mu, cov,
        target_return=0.02,  # modest excess return, always feasible with fixture
        horizon_years=3,
        n_simulations=500,
    )
    assert weights.sum() == pytest.approx(1.0, abs=1e-6)
    assert all(w >= -1e-9 for w in weights)

    metrics = compute_portfolio_metrics(
        weights, mu, cov,
        horizon_years=3,
        risk_free_rate=rf,
        n_simulations=500,
    )
    assert metrics["expected_return_pretax"] is not None
    assert metrics["max_drawdown_p95"] < 0

    n = len(tickers)
    turnover = estimate_turnover(np.full(n, 1.0 / n), weights)
    aftertax = after_tax_return(metrics["expected_return_pretax"], turnover)
    assert aftertax < metrics["expected_return_pretax"]
