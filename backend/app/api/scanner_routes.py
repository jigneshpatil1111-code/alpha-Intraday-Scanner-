from fastapi import APIRouter, HTTPException, Body
from backend.app.services.scanner_service import scanner_service
from backend.app.services.market_data import market_data, FNO_DICT
from backend.app.core.kronos_engine import kronos_engine
from backend.app.services.angel_service import angel_service

router = APIRouter(prefix="/scanner", tags=["Scanner"])

@router.get("/all")
def get_all_scanner_results():
    """
    Returns real-time 9/15 EMA + VWAP setups, Kronos AI projections,
    Top Profit Picks, and Sector Money Flow Heatmap for all 179+ F&O stocks.
    """
    return scanner_service.run_scan()

@router.get("/sectors")
def get_sector_flows():
    """Returns net money flow, buying sectors, selling sectors, and top stocks per sector."""
    scan_data = scanner_service.run_scan()
    return scan_data.get("sector_analysis", {})

@router.get("/kronos/{symbol}")
def get_kronos_simulation(symbol: str):
    """Returns 5-candle forward K-Line simulation for the specified stock."""
    sym = symbol.upper()
    if sym not in FNO_DICT:
        raise HTTPException(status_code=404, detail=f"Symbol {sym} not found in F&O universe.")

    df = market_data.get_5m_candles(sym, days=2)
    recent = df.tail(15).to_dict(orient="records")
    sim = kronos_engine.simulate_future_k_lines(sym, recent, horizon=5)
    return sim

@router.post("/angel/connect")
def connect_angel_one(payload: dict = Body(...)):
    """
    Connects to Angel One SmartAPI for 0-delay live market tick streaming.
    Credentials are stored strictly in volatile RAM.
    """
    client_code = payload.get("client_code", "")
    password = payload.get("password", "")
    totp_key = payload.get("totp_key", "")
    api_key = payload.get("api_key", "")

    if not client_code or not password:
        raise HTTPException(status_code=400, detail="Client Code and Password are required.")

    res = angel_service.connect(client_code, password, totp_key, api_key)
    return res

@router.get("/angel/status")
def get_angel_status():
    """Returns connection state of Angel One SmartAPI."""
    return {
        "is_connected": angel_service.is_connected,
        "client_code": angel_service.client_code,
        "last_sync": angel_service.last_sync_time
    }
