# test_api.py — API integration tests using FastAPI TestClient.
#
# Rules (see requirement TST-003):
#   - Use FastAPI TestClient (synchronous, httpx-based) — no running server needed.
#   - Monkeypatch fetch_prices to return fixture data — no real yfinance calls.
#   - Each test is independent — use a fresh in-memory DuckDB per test.
#   - Tests must cover: sync, assets, optimize (success + error cases), risk, healthz.
#
# Run: pytest backend/tests/test_api.py -v
#      financily test --no-e2e

# TODO: import pytest
# TODO: import pandas as pd
# TODO: import numpy as np
# TODO: from pathlib import Path
# TODO: from fastapi.testclient import TestClient
# TODO: from backend.main import app

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

# TODO: @pytest.fixture()
# TODO: def client(tmp_path, monkeypatch):
#   """
#   Provide a TestClient with:
#     - DB_PATH pointed at a temp in-memory or tmp_path DuckDB file.
#     - fetch_prices monkeypatched to return fixture CSV data.
#   Schema is initialised automatically by the lifespan handler.
#   """
#   # monkeypatch.setattr("backend.data.fetcher.fetch_prices", _mock_fetch_prices)
#   # monkeypatch.setenv("DB_PATH", str(tmp_path / "test.duckdb"))
#   # with TestClient(app) as c:
#   #     yield c

# TODO: def _mock_fetch_prices(tickers, start, end):
#   """Return fixture CSV data as a DataFrame regardless of tickers/dates."""
#   # Load returns_spy_qqq_tlt.csv, pivot to prices format
#   # Return DataFrame with columns: ticker, date, close, adj_close, volume

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

# TODO: def test_healthz_returns_ok(client):
#   # response = client.get("/healthz")
#   # assert response.status_code == 200
#   # assert response.json() == {"status": "ok"}

# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

# TODO: def test_sync_returns_success(client):
#   # response = client.post("/api/sync", json={"tickers": ["SPY", "QQQ"]})
#   # assert response.status_code == 200
#   # body = response.json()
#   # assert body["status"] == "ok"
#   # assert body["tickers_synced"] == 2
#   # assert body["rows_upserted"] > 0

# TODO: def test_sync_empty_tickers_returns_422(client):
#   # response = client.post("/api/sync", json={"tickers": []})
#   # assert response.status_code == 422

# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------

# TODO: def test_assets_empty_before_sync(client):
#   # response = client.get("/api/assets")
#   # assert response.status_code == 200
#   # assert response.json()["assets"] == []

# TODO: def test_assets_populated_after_sync(client):
#   # client.post("/api/sync", json={"tickers": ["SPY", "QQQ", "TLT"]})
#   # response = client.get("/api/assets")
#   # tickers = [a["ticker"] for a in response.json()["assets"]]
#   # assert "SPY" in tickers and "QQQ" in tickers and "TLT" in tickers

# ---------------------------------------------------------------------------
# Optimize — success
# ---------------------------------------------------------------------------

# TODO: def test_optimize_returns_valid_response(client):
#   """Happy path: sync then optimize, assert schema and constraints."""
#   # client.post("/api/sync", json={"tickers": ["SPY", "QQQ", "TLT"]})
#   # response = client.post("/api/optimize", json={
#   #     "tickers": ["SPY", "QQQ", "TLT"],
#   #     "target_return": 0.08,
#   #     "horizon_years": 3,
#   # })
#   # assert response.status_code == 200
#   # body = response.json()
#   # assert body["feasible"] is True
#   # weights = body["optimal_portfolio"]["weights"]
#   # assert abs(sum(weights.values()) - 1.0) < 1e-5
#   # assert body["optimal_portfolio"]["max_drawdown_p95"] < 0
#   # assert len(body["risk_cost_table"]) >= 15

# ---------------------------------------------------------------------------
# Optimize — error cases
# ---------------------------------------------------------------------------

# TODO: def test_optimize_infeasible_target_returns_422(client):
#   # client.post("/api/sync", json={"tickers": ["SPY", "QQQ", "TLT"]})
#   # response = client.post("/api/optimize", json={
#   #     "tickers": ["SPY", "QQQ", "TLT"],
#   #     "target_return": 0.99,
#   #     "horizon_years": 3,
#   # })
#   # assert response.status_code == 422
#   # assert response.json()["detail"]["error"] == "infeasible"
#   # assert "max_achievable" in response.json()["detail"]

# TODO: def test_optimize_unknown_ticker_returns_422(client):
#   # response = client.post("/api/optimize", json={
#   #     "tickers": ["UNKNOWN", "TICKER"],
#   #     "target_return": 0.10,
#   #     "horizon_years": 3,
#   # })
#   # assert response.status_code == 422
#   # assert "sync first" in response.json()["detail"].lower()

# TODO: def test_optimize_fewer_than_2_tickers_returns_422(client):
#   # response = client.post("/api/optimize", json={
#   #     "tickers": ["SPY"],
#   #     "target_return": 0.10,
#   #     "horizon_years": 3,
#   # })
#   # assert response.status_code == 422

# TODO: def test_optimize_invalid_horizon_returns_422(client):
#   # response = client.post("/api/optimize", json={
#   #     "tickers": ["SPY", "QQQ"],
#   #     "target_return": 0.10,
#   #     "horizon_years": 4,    # invalid — must be 2, 3, or 5
#   # })
#   # assert response.status_code == 422

# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------

# TODO: def test_risk_returns_metrics_for_valid_weights(client):
#   # client.post("/api/sync", json={"tickers": ["SPY", "QQQ"]})
#   # response = client.get("/api/risk?tickers=SPY,QQQ&weights=0.6,0.4&horizon_years=3")
#   # assert response.status_code == 200
#   # assert response.json()["max_drawdown_p95"] < 0

# TODO: def test_risk_invalid_weights_sum_returns_422(client):
#   # response = client.get("/api/risk?tickers=SPY,QQQ&weights=0.6,0.5&horizon_years=3")
#   # assert response.status_code == 422

# TODO: def test_risk_mismatched_lengths_returns_422(client):
#   # response = client.get("/api/risk?tickers=SPY,QQQ,TLT&weights=0.5,0.5&horizon_years=3")
#   # assert response.status_code == 422
