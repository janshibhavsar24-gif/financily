# covariance.py — Ledoit-Wolf shrinkage covariance estimation.
#
# Rules:
#   - Always apply Ledoit-Wolf shrinkage — never return raw sample covariance.
#   - Always annualise: multiply daily covariance by 252.
#   - Enforce positive semi-definiteness after shrinkage (add jitter if needed).
#   - The returned matrix is symmetric with shape (n, n).
#   - Input is a wide daily returns DataFrame (same as from get_returns_matrix).

# TODO: import numpy as np
# TODO: import pandas as pd
# TODO: from sklearn.covariance import LedoitWolf

# TODO: def ledoit_wolf_covariance(
#     returns: pd.DataFrame,   # wide format: index=date, columns=ticker, values=log return
# ) -> np.ndarray:
#   """
#   Fit LedoitWolf() on the daily returns matrix.
#   Annualise: cov_annual = cov_daily * 252.
#   Check all eigenvalues >= 0. If any are negative (numerical error),
#   add jitter: cov += 1e-8 * I.
#   Return the (n, n) annualised shrunk covariance matrix.
#   """
