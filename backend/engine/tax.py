# tax.py — after-tax return estimation.
#
# Model assumptions (see requirement TAX-001):
#   - Portfolio is rebalanced exactly once per year.
#   - Gains on rebalanced (turned-over) portion → short-term capital gains (STCG).
#   - Gains on held portion → long-term capital gains (LTCG).
#   - Turnover = one-way turnover = sum(|w_new - w_prev|) / 2.
#
# Rules:
#   - Pure functions only. No DuckDB, no network calls.
#   - Optimizer runs on pre-tax returns — tax is applied to the output only.
#   - Both pre-tax and after-tax returns are always reported (TAX-005).

# TODO: import numpy as np
# TODO: from backend.config import DEFAULT_TAX_RATE_LT, DEFAULT_TAX_RATE_ST

# TODO: def estimate_turnover(
#     w_prev: np.ndarray,    # previous portfolio weights, shape (n,)
#     w_new: np.ndarray,     # new (optimised) portfolio weights, shape (n,)
# ) -> float:
#   """
#   One-way turnover = sum(|w_new - w_prev|) / 2.
#   For the initial portfolio (no prior weights), caller should pass
#   equal-weight array as w_prev: np.full(n, 1/n).
#   Returns value in [0, 1].
#
#   Verification:
#     estimate_turnover([0.5, 0.5], [1.0, 0.0]) == 0.5
#     estimate_turnover([0.25]*4, [0.25]*4) == 0.0
#   """

# TODO: def after_tax_return(
#     pretax_return: float,
#     turnover: float,
#     tax_rate_lt: float = DEFAULT_TAX_RATE_LT,
#     tax_rate_st: float = DEFAULT_TAX_RATE_ST,
# ) -> float:
#   """
#   ltcg_portion = 1 - turnover
#   stcg_portion = turnover
#
#   after_tax = pretax_return * (
#     1 - ltcg_portion * tax_rate_lt - stcg_portion * tax_rate_st
#   )
#
#   Verification:
#     after_tax_return(0.20, turnover=0.0, lt=0.15, st=0.37) ≈ 0.170
#     after_tax_return(0.20, turnover=1.0, lt=0.15, st=0.37) ≈ 0.126
#   """
