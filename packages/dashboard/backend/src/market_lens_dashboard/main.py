'''Main file for the dashboard backend. Sets up the FastAPI application and includes the necessary routers.'''

import os
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .routers import stocks
from .routers import health

app = FastAPI(
    title=os.getenv("APP_NAME", "Dashboard Backend API"),
    openapi_url="/openapi",
    docs_url="/docs",
)

app.include_router(stocks.router)
app.include_router(health.router)


@app.get("/version", include_in_schema=False)
async def get_version():
    return {"version": "0.1.0"}


def _frontend_dist() -> Path | None:
    # PyInstaller bundles the built frontend under frontend-dist/ inside _MEIPASS.
    if hasattr(sys, "_MEIPASS"):
        p = Path(sys._MEIPASS) / "frontend-dist"
        if p.is_dir():
            return p
    return None


_dist = _frontend_dist()
if _dist is not None:
    _assets = _dist / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets), name="static-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Serve any file that exists in dist/ (favicon, robots.txt, etc.);
        # fall back to index.html so client-side routing works.
        candidate = _dist / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")