"""
Financily CLI — run backend and frontend with a single command.

Commands:
  financily dev     — start backend (reload) + frontend dev server in parallel
  financily start   — start backend (prod) only (serves compiled frontend)
  financily build   — build frontend for production
  financily test    — run all tests (backend + e2e)
"""
import subprocess
import sys
from pathlib import Path

import typer

app = typer.Typer(help="Financily dev tools")
ROOT = Path(__file__).parent
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"


@app.command()
def dev(
    port: int = typer.Option(8000, help="Backend port"),
    no_frontend: bool = typer.Option(False, "--no-fe", help="Skip frontend dev server"),
):
    """Start backend (--reload) and frontend dev server in parallel."""
    import threading

    def run_backend():
        subprocess.run(
            [sys.executable, "-m", "uvicorn", "backend.main:app",
             "--reload", f"--port={port}"],
            cwd=ROOT,
        )

    def run_frontend():
        subprocess.run(["npm", "run", "dev"], cwd=FRONTEND)

    threads = [threading.Thread(target=run_backend, daemon=True)]
    if not no_frontend:
        threads.append(threading.Thread(target=run_frontend, daemon=True))

    for t in threads:
        t.start()
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        typer.echo("\nStopping…")


@app.command()
def start(port: int = typer.Option(8000, help="Backend port")):
    """Start backend in production mode (serves compiled frontend/dist)."""
    subprocess.run(
        [sys.executable, "-m", "uvicorn", "backend.main:app", f"--port={port}"],
        cwd=ROOT,
    )


@app.command()
def build():
    """Build the frontend for production (output: frontend/dist/)."""
    typer.echo("Building frontend…")
    result = subprocess.run(["npm", "run", "build"], cwd=FRONTEND)
    if result.returncode != 0:
        raise typer.Exit(result.returncode)
    typer.echo("Build complete → frontend/dist/")


@app.command()
def test(
    no_e2e: bool = typer.Option(False, "--no-e2e", help="Skip Playwright e2e tests"),
    no_backend: bool = typer.Option(False, "--no-backend", help="Skip backend tests"),
):
    """Run backend pytest + Playwright e2e tests."""
    exit_code = 0

    if not no_backend:
        typer.echo("Running backend tests…")
        r = subprocess.run(
            [sys.executable, "-m", "pytest", "backend/tests", "-v"],
            cwd=ROOT,
        )
        exit_code = max(exit_code, r.returncode)

    if not no_e2e:
        typer.echo("Running Playwright e2e tests…")
        r = subprocess.run(["npm", "run", "test:e2e"], cwd=FRONTEND)
        exit_code = max(exit_code, r.returncode)

    raise typer.Exit(exit_code)


if __name__ == "__main__":
    app()
