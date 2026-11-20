import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.app.services.market_data import market_data, NSE_FNO_UNIVERSE
from backend.app.services.scanner_service import scanner_service

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
        for conn in self.active_connections:
            try:
                await conn.send_json(data)
            except Exception:
                pass

manager = ConnectionManager()

@router.websocket("/ws/ticks")
async def websocket_tick_stream(websocket: WebSocket):
    """
    High-frequency WebSocket endpoint.
    Streams tick fluctuations and real-time EMA/VWAP updates every 1-2 seconds.
    """
    await manager.connect(websocket)
    try:
        counter = 0
        while True:
            # Update random 3-5 stocks with new ticks
            updated_quotes = []
            for item in NSE_FNO_UNIVERSE[:10]:
                q = market_data.update_tick(item['symbol'])
                updated_quotes.append(q)

            payload = {
                "type": "TICK_UPDATE",
                "timestamp": asyncio.get_event_loop().time(),
                "ticks": updated_quotes
            }

            counter += 1
            # Every 10 ticks, broadcast fresh scanner summary
            if counter % 10 == 0:
                scan = scanner_service.run_scan()
                payload["scanner_summary"] = {
                    "timestamp": scan.timestamp,
                    "bullish": scan.bullish_count,
                    "bearish": scan.bearish_count,
                    "strong_count": len(scan.strong_signals)
                }

            await websocket.send_json(payload)
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
