import numpy as np
import pandas as pd
from sklearn.covariance import LedoitWolf


def ledoit_wolf_covariance(returns: pd.DataFrame) -> np.ndarray:
    """
    Fit LedoitWolf shrinkage on daily returns, annualise by *252.
    Enforces PSD by adding jitter if any eigenvalue < 0.
    Returns symmetric (n, n) annualised covariance matrix.
    """
    lw = LedoitWolf()
    lw.fit(returns.values)
    cov_daily = lw.covariance_
    cov_annual = cov_daily * 252.0

    # Enforce PSD
    eigvals = np.linalg.eigvalsh(cov_annual)
    if np.any(eigvals < 0):
        cov_annual += 1e-8 * np.eye(cov_annual.shape[0])

    return cov_annual
