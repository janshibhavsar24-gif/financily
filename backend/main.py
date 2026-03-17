from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.data.db import get_connection, init_schema
from backend.data.universe import init_asset_universe
from backend.api.sync import router as sync_router
from backend.api.assets import router as assets_router
from backend.api.optimize import router as optimize_router
from backend.api.risk import router as risk_router
from backend.api.search import router as search_router
from backend.api.monitor import router as monitor_router
from backend.api.analytics import router as analytics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure DB directory and schema exist
    import asyncio
    from backend.config import DB_PATH
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = get_connection()
    init_schema(conn)
    conn.close()
    # Populate asset universe in background (no-op if already loaded)
    asyncio.create_task(asyncio.to_thread(_init_universe))
    yield
    # Shutdown: nothing needed (DuckDB auto-closes)


def _init_universe() -> None:
    conn = get_connection()
    try:
        init_asset_universe(conn)
    finally:
        conn.close()


app = FastAPI(title="Financily", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz():
    try:
        conn = get_connection()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        return JSONResponse({"status": "ok"})
    except Exception as exc:
        return JSONResponse({"status": "error", "detail": str(exc)}, status_code=503)


app.include_router(sync_router)
app.include_router(assets_router)
app.include_router(optimize_router)
app.include_router(risk_router)
app.include_router(search_router)
app.include_router(monitor_router)
app.include_router(analytics_router)

# Static file serving — MUST be registered last
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
