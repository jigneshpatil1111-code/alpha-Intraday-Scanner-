from fastapi import APIRouter
from backend.app.api.auth_routes import router as auth_router
from backend.app.api.scanner_routes import router as scanner_router
from backend.app.api.backtest_routes import router as backtest_router
from backend.app.api.trade_routes import router as trade_router
from backend.app.api.websocket_routes import router as ws_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(scanner_router)
api_router.include_router(backtest_router)
api_router.include_router(trade_router)
api_router.include_router(ws_router)
