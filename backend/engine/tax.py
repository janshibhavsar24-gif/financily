import numpy as np
from backend.config import DEFAULT_TAX_RATE_LT, DEFAULT_TAX_RATE_ST


def estimate_turnover(w_prev: np.ndarray, w_new: np.ndarray) -> float:
    """
    One-way portfolio turnover = sum(|w_new - w_prev|) / 2.
    Returns value in [0, 1].
    """
    return float(np.sum(np.abs(np.asarray(w_new) - np.asarray(w_prev))) / 2.0)


def after_tax_return(
    pretax_return: float,
    turnover: float,
    tax_rate_lt: float = DEFAULT_TAX_RATE_LT,
    tax_rate_st: float = DEFAULT_TAX_RATE_ST,
) -> float:
    """
    after_tax = pretax * (1 - ltcg_portion * tax_lt - stcg_portion * tax_st)
    where ltcg_portion = 1 - turnover, stcg_portion = turnover.
    """
    ltcg_portion = 1.0 - turnover
    stcg_portion = turnover
    return pretax_return * (1.0 - ltcg_portion * tax_rate_lt - stcg_portion * tax_rate_st)
