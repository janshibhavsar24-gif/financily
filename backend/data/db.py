from __future__ import annotations
import duckdb
from backend.config import DB_PATH


def get_connection() -> duckdb.DuckDBPyConnection:
    """Return a fresh DuckDB connection. Never share across threads."""
    return duckdb.connect(DB_PATH)


def init_schema(conn: duckdb.DuckDBPyConnection) -> None:
    """Create all tables if they do not exist. Safe to call repeatedly."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS prices (
            ticker     VARCHAR NOT NULL,
            date       DATE    NOT NULL,
            close      DOUBLE,
            adj_close  DOUBLE,
            volume     BIGINT,
            PRIMARY KEY (ticker, date)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS daily_returns (
            ticker  VARCHAR NOT NULL,
            date    DATE    NOT NULL,
            ret     DOUBLE  NOT NULL,
            PRIMARY KEY (ticker, date)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS macro_series (
            series_id  VARCHAR NOT NULL,
            date       DATE    NOT NULL,
            value      DOUBLE,
            PRIMARY KEY (series_id, date)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS portfolio_runs (
            run_id        VARCHAR PRIMARY KEY,
            run_at        TIMESTAMP NOT NULL,
            tickers       VARCHAR   NOT NULL,
            target_return DOUBLE    NOT NULL,
            horizon_years INTEGER   NOT NULL,
            tax_rate_st   DOUBLE,
            tax_rate_lt   DOUBLE,
            result        VARCHAR
        )
    """)
