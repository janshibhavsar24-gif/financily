# main.py — FastAPI application entry point.
#
# Responsibilities:
#   1. Lifespan handler: initialise DuckDB schema once on startup.
#   2. Register all API routers.
#   3. In production: serve the compiled frontend (frontend/dist/) as
#      static files at "/" so a single `uvicorn backend.main:app` command
#      runs the entire application.
#   4. Expose GET /healthz for liveness checks (used by frontend + CLI).
#
# Rules:
#   - No business logic here — only wiring.
#   - CORS is enabled for localhost origins in dev (controlled by ENV var).
#   - Static file mount must be registered LAST, after all API routers,
#     otherwise "/" catches API paths before the routers see them.
#
# Run (dev):    uvicorn backend.main:app --reload --port 8000
# Run (prod):   uvicorn backend.main:app --port 8000
# Preferred:    financily dev / financily start  (via cli.py)

# TODO: from contextlib import asynccontextmanager
# TODO: from pathlib import Path
# TODO: import os

# TODO: from fastapi import FastAPI
# TODO: from fastapi.middleware.cors import CORSMiddleware
# TODO: from fastapi.staticfiles import StaticFiles
# TODO: from fastapi.responses import JSONResponse

# TODO: from backend.data.db import get_connection, init_schema
# TODO: from backend.api.sync import router as sync_router
# TODO: from backend.api.assets import router as assets_router
# TODO: from backend.api.optimize import router as optimize_router
# TODO: from backend.api.risk import router as risk_router

# ---------------------------------------------------------------------------
# Lifespan — runs once at startup and once at shutdown
# ---------------------------------------------------------------------------

# TODO: @asynccontextmanager
# TODO: async def lifespan(app: FastAPI):
#   On startup:
#     conn = get_connection()
#     init_schema(conn)
#     conn.close()
#   yield
#   On shutdown: nothing needed (DuckDB auto-closes)

# ---------------------------------------------------------------------------
# App instantiation
# ---------------------------------------------------------------------------

# TODO: app = FastAPI(title="Financily", lifespan=lifespan)

# ---------------------------------------------------------------------------
# CORS — allow Vite dev server to reach the API without browser errors
# ---------------------------------------------------------------------------

# TODO: app.add_middleware(
#   CORSMiddleware,
#   allow_origins=["http://localhost:5173"],   # Vite dev server
#   allow_methods=["*"],
#   allow_headers=["*"],
# )

# ---------------------------------------------------------------------------
# Health check — must be registered before static file mount
# ---------------------------------------------------------------------------

# TODO: @app.get("/healthz")
# TODO: async def healthz():
#   Return {"status": "ok"} with HTTP 200.
#   Also verifies DB is accessible: attempt get_connection(), catch and return 503 if it fails.

# ---------------------------------------------------------------------------
# API routers — all registered before static file mount
# ---------------------------------------------------------------------------

# TODO: app.include_router(sync_router)
# TODO: app.include_router(assets_router)
# TODO: app.include_router(optimize_router)
# TODO: app.include_router(risk_router)

# ---------------------------------------------------------------------------
# Static file serving — MUST be last
# ---------------------------------------------------------------------------

# TODO: FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
# TODO: if FRONTEND_DIST.is_dir():
#   app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
#   html=True enables SPA fallback: non-API paths return index.html
