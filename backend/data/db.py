# db.py — DuckDB connection management and schema initialisation.
#
# Rules:
#   - get_connection() returns a new connection every call.
#     Do NOT share a connection across threads or requests.
#   - init_schema() uses CREATE TABLE IF NOT EXISTS — safe to call repeatedly.
#   - init_schema() is called once in main.py lifespan, never from a request.
#   - All SQL uses parameterised queries (conn.execute("... WHERE x = ?", [val])).
#     Never use f-strings or % formatting in SQL.
#
# Tables:
#   prices         — daily OHLCV, adj_close used for all return calculations
#   daily_returns  — pre-computed log returns (populated during every sync upsert)
#   macro_series   — FRED time series (risk-free rate, macro indicators)
#   portfolio_runs — audit log of every /api/optimize call

# TODO: import duckdb
# TODO: from backend.config import DB_PATH

# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

# TODO: def get_connection() -> duckdb.DuckDBPyConnection:
#   """
#   Return a fresh DuckDB connection to DB_PATH.
#   Creates the .duckdb file if it does not exist.
#   Caller is responsible for closing the connection.
#   """

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

# TODO: def init_schema(conn: duckdb.DuckDBPyConnection) -> None:
#   """
#   Create all four tables if they do not already exist.
#
#   prices (ticker VARCHAR, date DATE, close DOUBLE, adj_close DOUBLE, volume BIGINT)
#     PRIMARY KEY (ticker, date)
#
#   daily_returns (ticker VARCHAR, date DATE, ret DOUBLE)
#     PRIMARY KEY (ticker, date)
#     ret = ln(adj_close_t / adj_close_{t-1})
#
#   macro_series (series_id VARCHAR, date DATE, value DOUBLE)
#     PRIMARY KEY (series_id, date)
#
#   portfolio_runs (
#     run_id VARCHAR PRIMARY KEY,
#     run_at TIMESTAMP,
#     tickers JSON,
#     target_return DOUBLE,
#     horizon_years INTEGER,
#     tax_rate_st DOUBLE,
#     tax_rate_lt DOUBLE,
#     result JSON           -- full OptimizeResponse payload
#   )
#   """
