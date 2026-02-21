# test_engine.py — unit and integration tests for all engine/ modules.
#
# Rules (see requirements TST-001, TST-002):
#   - No network calls. All tests use CSV fixtures from tests/fixtures/.
#   - No DuckDB writes — pass DataFrames directly to engine functions.
#   - Tests are fast: the fixture is ~750 rows, GARCH fits in < 2s.
#   - Each test targets one function — one responsibility per test.
#
# Run: pytest backend/tests/test_engine.py -v
#      financily test --no-e2e

# TODO: import pytest
# TODO: import numpy as np
# TODO: import pandas as pd
# TODO: from pathlib import Path

# TODO: FIXTURES_DIR = Path(__file__).parent / "fixtures"

# ---------------------------------------------------------------------------
# Fixture — shared returns DataFrame loaded once per session
# ---------------------------------------------------------------------------

# TODO: @pytest.fixture(scope="session")
# TODO: def returns_df() -> pd.DataFrame:
#   """Load returns_spy_qqq_tlt.csv once for the entire test session."""
#   # pd.read_csv(FIXTURES_DIR / "returns_spy_qqq_tlt.csv", index_col="date", parse_dates=True)

# ---------------------------------------------------------------------------
# forecaster.py tests
# ---------------------------------------------------------------------------

# TODO: def test_compute_historical_mean_annualises_correctly(returns_df):
#   """mean(daily) * 252 should be in [-0.30, 0.50] for any reasonable asset."""
#   # from backend.engine.forecaster import compute_historical_mean
#   # result = compute_historical_mean(returns_df["SPY"])
#   # assert isinstance(result, float)
#   # assert -0.30 <= result <= 0.50

# TODO: def test_fit_garch_volatility_returns_positive_float(returns_df):
#   """GARCH vol must be a positive finite float."""
#   # from backend.engine.forecaster import fit_garch_volatility
#   # result = fit_garch_volatility(returns_df["SPY"])
#   # assert result > 0
#   # assert np.isfinite(result)

# TODO: def test_fit_garch_volatility_never_raises(returns_df):
#   """Even on a degenerate series (all zeros), must return without raising."""
#   # from backend.engine.forecaster import fit_garch_volatility
#   # result = fit_garch_volatility(pd.Series(np.zeros(100)))
#   # assert result >= 0

# TODO: def test_james_stein_shrinkage_lies_between_hist_and_market():
#   """Shrunk estimate must be strictly between hist and market for any lam in (0,1)."""
#   # from backend.engine.forecaster import james_stein_shrinkage
#   # mu_hist = np.array([0.15, 0.10, 0.05])
#   # mu_market = 0.08
#   # result = james_stein_shrinkage(mu_hist, mu_market, lam=0.3)
#   # assert all(min(h, mu_market) <= r <= max(h, mu_market) for h, r in zip(mu_hist, result))

# ---------------------------------------------------------------------------
# covariance.py tests
# ---------------------------------------------------------------------------

# TODO: def test_ledoit_wolf_covariance_is_psd(returns_df):
#   """All eigenvalues of the returned matrix must be >= 0."""
#   # from backend.engine.covariance import ledoit_wolf_covariance
#   # cov = ledoit_wolf_covariance(returns_df)
#   # eigenvalues = np.linalg.eigvalsh(cov)
#   # assert np.all(eigenvalues >= -1e-9)

# TODO: def test_ledoit_wolf_covariance_is_symmetric(returns_df):
#   # from backend.engine.covariance import ledoit_wolf_covariance
#   # cov = ledoit_wolf_covariance(returns_df)
#   # assert np.allclose(cov, cov.T)

# ---------------------------------------------------------------------------
# risk.py tests
# ---------------------------------------------------------------------------

# TODO: def test_simulate_paths_shape_and_reproducibility():
#   """Shape (N, H) and same seed produces identical output."""
#   # from backend.engine.risk import simulate_paths
#   # mu = np.array([0.08, 0.10, 0.03])
#   # cov = np.eye(3) * 0.04
#   # w = np.array([0.4, 0.4, 0.2])
#   # paths1 = simulate_paths(mu, cov, w, horizon_years=3, n_simulations=500, seed=42)
#   # paths2 = simulate_paths(mu, cov, w, horizon_years=3, n_simulations=500, seed=42)
#   # assert paths1.shape == (500, 3)
#   # assert np.allclose(paths1, paths2)

# TODO: def test_max_drawdown_distribution_ordering():
#   """p95 must be <= median (both negative)."""
#   # from backend.engine.risk import simulate_paths, compute_max_drawdown_distribution
#   # ... build paths, then:
#   # median_mdd, p95_mdd = compute_max_drawdown_distribution(paths)
#   # assert median_mdd < 0
#   # assert p95_mdd <= median_mdd

# TODO: def test_cvar_worse_than_var():
#   """CVaR must always be <= VaR (both negative)."""
#   # from backend.engine.risk import simulate_paths, compute_var_cvar
#   # var, cvar = compute_var_cvar(paths)
#   # assert cvar <= var

# ---------------------------------------------------------------------------
# tax.py tests
# ---------------------------------------------------------------------------

# TODO: def test_estimate_turnover_zero_for_identical_weights():
#   # from backend.engine.tax import estimate_turnover
#   # assert estimate_turnover(np.array([0.25]*4), np.array([0.25]*4)) == pytest.approx(0.0)

# TODO: def test_estimate_turnover_half_for_full_rotation():
#   # from backend.engine.tax import estimate_turnover
#   # assert estimate_turnover(np.array([0.5, 0.5]), np.array([1.0, 0.0])) == pytest.approx(0.5)

# TODO: def test_after_tax_return_buy_and_hold():
#   """Zero turnover → only LTCG applies."""
#   # from backend.engine.tax import after_tax_return
#   # result = after_tax_return(0.20, turnover=0.0, tax_rate_lt=0.15, tax_rate_st=0.37)
#   # assert result == pytest.approx(0.17, abs=1e-4)

# TODO: def test_after_tax_return_full_turnover():
#   """Full turnover → only STCG applies."""
#   # from backend.engine.tax import after_tax_return
#   # result = after_tax_return(0.20, turnover=1.0, tax_rate_lt=0.15, tax_rate_st=0.37)
#   # assert result == pytest.approx(0.126, abs=1e-4)

# ---------------------------------------------------------------------------
# Integration test — full pipeline
# ---------------------------------------------------------------------------

# TODO: def test_full_pipeline_spy_qqq_tlt(returns_df):
#   """
#   End-to-end pipeline using fixture data (no network, no DuckDB):
#   forecast → covariance → optimizer → metrics → tax.
#   See requirement TST-002.
#   """
#   # from backend.engine.forecaster import compute_historical_mean, james_stein_shrinkage
#   # from backend.engine.covariance import ledoit_wolf_covariance
#   # from backend.engine.optimizer import optimize_portfolio
#   # from backend.engine.risk import compute_portfolio_metrics
#   # from backend.engine.tax import after_tax_return, estimate_turnover
#   # import numpy as np
#   #
#   # tickers = ["SPY", "QQQ", "TLT"]
#   # mu_hist = np.array([compute_historical_mean(returns_df[t]) for t in tickers])
#   # market_mu = compute_historical_mean(returns_df["SPY"])
#   # mu = james_stein_shrinkage(mu_hist, market_mu) - 0.05  # subtract mock rf
#   # cov = ledoit_wolf_covariance(returns_df[tickers])
#   #
#   # weights = optimize_portfolio(mu, cov, target_return=0.10, horizon_years=3, n_simulations=500)
#   # assert weights.sum() == pytest.approx(1.0, abs=1e-6)
#   # assert all(w >= -1e-9 for w in weights)
#   #
#   # metrics = compute_portfolio_metrics(weights, mu, cov, horizon_years=3,
#   #                                     risk_free_rate=0.05, n_simulations=500)
#   # assert metrics["expected_return_pretax"] > 0
#   # assert metrics["max_drawdown_p95"] < 0
#   #
#   # n = len(tickers)
#   # turnover = estimate_turnover(np.full(n, 1/n), weights)
#   # aftertax = after_tax_return(metrics["expected_return_pretax"], turnover)
#   # assert aftertax < metrics["expected_return_pretax"]
