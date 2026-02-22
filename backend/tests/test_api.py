import pytest
import pandas as pd
import numpy as np
from pathlib import Path
from fastapi.testclient import TestClient

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _mock_fetch_prices(tickers, start, end):
    """Return fixture CSV data as a price DataFrame."""
    returns = pd.read_csv(
        FIXTURES_DIR / "returns_spy_qqq_tlt.csv",
        index_col="date",
        parse_dates=True,
    )
    # Reconstruct synthetic prices from returns for any requested ticker
    rows = []
    for ticker in tickers:
        ticker = ticker.upper()
        if ticker not in returns.columns:
            # Generate synthetic data for unknown tickers
            col = returns["SPY"]
        else:
            col = returns[ticker]
        # Convert log returns -> prices starting at 100
        prices = 100.0 * np.exp(col.cumsum().values)
        df_t = pd.DataFrame({
            "ticker": ticker,
            "date": col.index.date,
            "close": prices,
            "adj_close": prices,
            "volume": 1_000_000,
        })
        rows.append(df_t)
    return pd.concat(rows, ignore_index=True)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """
    Provide a TestClient with:
      - DB_PATH pointed at a temp DuckDB file.
      - fetch_prices monkeypatched to return fixture CSV data.
    Schema is initialised automatically by the lifespan handler.
    """
    db_path = str(tmp_path / "test.duckdb")
    # Patch the already-imported DB_PATH constant in every module that uses it
    monkeypatch.setattr("backend.config.DB_PATH", db_path)
    monkeypatch.setattr("backend.data.db.DB_PATH", db_path)
    monkeypatch.setattr("backend.data.fetcher.fetch_prices", _mock_fetch_prices)
    monkeypatch.setattr("backend.data.sync.fetch_prices", _mock_fetch_prices)

    from backend.main import app
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def test_healthz_returns_ok(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

def test_sync_returns_success(client):
    response = client.post("/api/sync", json={"tickers": ["SPY", "QQQ"]})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["tickers_synced"] == 2
    assert body["rows_upserted"] > 0


def test_sync_empty_tickers_returns_422(client):
    response = client.post("/api/sync", json={"tickers": []})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------

def test_assets_empty_before_sync(client):
    response = client.get("/api/assets")
    assert response.status_code == 200
    assert response.json()["assets"] == []


def test_assets_populated_after_sync(client):
    client.post("/api/sync", json={"tickers": ["SPY", "QQQ", "TLT"]})
    response = client.get("/api/assets")
    tickers = [a["ticker"] for a in response.json()["assets"]]
    assert "SPY" in tickers and "QQQ" in tickers and "TLT" in tickers


# ---------------------------------------------------------------------------
# Optimize — success
# ---------------------------------------------------------------------------

def test_optimize_returns_valid_response(client):
    """Happy path: sync then optimize, assert schema and constraints."""
    client.post("/api/sync", json={"tickers": ["SPY", "QQQ", "TLT"]})
    response = client.post("/api/optimize", json={
        "tickers": ["SPY", "QQQ", "TLT"],
        "target_return": 0.02,
        "horizon_years": 3,
        "n_simulations": 500,
    })
    assert response.status_code == 200
    body = response.json()
    assert body["feasible"] is True
    weights = body["optimal_portfolio"]["weights"]
    assert abs(sum(weights.values()) - 1.0) < 1e-4
    assert body["optimal_portfolio"]["max_drawdown_p95"] < 0
    assert len(body["risk_cost_table"]) >= 1


# ---------------------------------------------------------------------------
# Optimize — error cases
# ---------------------------------------------------------------------------

def test_optimize_infeasible_target_returns_422(client):
    client.post("/api/sync", json={"tickers": ["SPY", "QQQ", "TLT"]})
    response = client.post("/api/optimize", json={
        "tickers": ["SPY", "QQQ", "TLT"],
        "target_return": 0.99,
        "horizon_years": 3,
        "n_simulations": 200,
    })
    assert response.status_code == 422
    import json
    detail = response.json()["detail"]
    parsed = json.loads(detail) if isinstance(detail, str) else detail
    assert parsed["error"] == "infeasible"
    assert "max_achievable" in parsed


def test_optimize_unknown_ticker_returns_422(client):
    response = client.post("/api/optimize", json={
        "tickers": ["UNKNOWN", "TICKER"],
        "target_return": 0.10,
        "horizon_years": 3,
    })
    assert response.status_code == 422


def test_optimize_fewer_than_2_tickers_returns_422(client):
    response = client.post("/api/optimize", json={
        "tickers": ["SPY"],
        "target_return": 0.10,
        "horizon_years": 3,
    })
    assert response.status_code == 422


def test_optimize_invalid_horizon_returns_422(client):
    response = client.post("/api/optimize", json={
        "tickers": ["SPY", "QQQ"],
        "target_return": 0.10,
        "horizon_years": 4,
    })
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------

def test_risk_returns_metrics_for_valid_weights(client):
    client.post("/api/sync", json={"tickers": ["SPY", "QQQ"]})
    response = client.get("/api/risk?tickers=SPY,QQQ&weights=0.6,0.4&horizon_years=3")
    assert response.status_code == 200
    assert response.json()["max_drawdown_p95"] < 0


def test_risk_invalid_weights_sum_returns_422(client):
    response = client.get("/api/risk?tickers=SPY,QQQ&weights=0.6,0.5&horizon_years=3")
    assert response.status_code == 422


def test_risk_mismatched_lengths_returns_422(client):
    response = client.get("/api/risk?tickers=SPY,QQQ,TLT&weights=0.5,0.5&horizon_years=3")
    assert response.status_code == 422
