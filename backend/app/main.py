from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.app.config import settings
from backend.app.database import init_db
from backend.app.api.router import api_router

# Initialize Database Schema
init_db()

# Initialize FastAPI App
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Institutional-grade Quantitative Terminal & Scanner for NSE F&O with 3D Visualizer"
)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount APIs and WebSockets
app.include_router(api_router, prefix="/api")

# Static Files & Frontend Serving
BASE_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

if FRONTEND_DIR.exists():
    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
    app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/legacy")
    async def serve_legacy():
        return FileResponse(FRONTEND_DIR / "legacy_dashboard.html")

@app.get("/api/health")
def health_check():
    return {
        "status": "ONLINE",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "trading_mode": settings.TRADING_MODE
    }
