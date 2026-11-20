import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.app.services.market_data import market_data, NSE_FNO_UNIVERSE
from backend.app.services.angel_service import angel_service

router = APIRouter(tags=["WebSockets"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_json(self, data: dict):
        for conn in list(self.active_connections):
            try:
                await conn.send_json(data)
            except Exception:
                self.disconnect(conn)

manager = ConnectionManager()

@router.websocket("/ws/ticks")
async def websocket_tick_stream(websocket: WebSocket):
    """
    High-frequency WebSocket endpoint.
    Streams tick updates for ALL 179+ F&O stocks every 1 second.
    If Angel One is connected, fetches real data; otherwise uses simulation.
    """
    await manager.connect(websocket)
    try:
        batch_idx = 0
        batch_size = 30  # Update 30 stocks per tick cycle, rotating through all
        total = len(NSE_FNO_UNIVERSE)

        while True:
            updated_quotes = []
            start = batch_idx * batch_size
            end = min(start + batch_size, total)
            batch_items = NSE_FNO_UNIVERSE[start:end]

            for item in batch_items:
                sym = item['symbol']
                # If Angel One is live-connected with JWT, fetch real quote
                if angel_service.is_connected and angel_service.jwt_token:
                    q = angel_service.fetch_live_quote(sym)
                else:
                    q = market_data.update_tick(sym)
                if q:
                    updated_quotes.append({
                        "symbol": q.get("symbol", sym),
                        "ltp": q.get("ltp", 0),
                        "change_pct": q.get("change_pct", 0),
                        "high": q.get("high", 0),
                        "low": q.get("low", 0),
                        "volume": q.get("volume", 0),
                        "change": q.get("change", 0)
                    })

            # Advance batch rotation
            batch_idx += 1
            if end >= total:
                batch_idx = 0

            # Count overall market breadth
            all_quotes = market_data.live_quotes
            bullish = sum(1 for v in all_quotes.values() if v.get('change_pct', 0) > 0)
            bearish = sum(1 for v in all_quotes.values() if v.get('change_pct', 0) < 0)

            payload = {
                "type": "TICK_UPDATE",
                "ticks": updated_quotes,
                "market_breadth": {
                    "bullish": bullish,
                    "bearish": bearish,
                    "total": total
                },
                "angel_live": angel_service.is_connected and angel_service.jwt_token is not None
            }

            await websocket.send_json(payload)
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
