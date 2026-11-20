from fastapi import APIRouter, HTTPException
from backend.app.services.scanner_service import scanner_service
from backend.app.services.market_data import market_data, FNO_DICT
from backend.app.models.schemas import ScannerResponse, StockQuote

router = APIRouter(prefix="/scanner", tags=["Scanner"])

@router.get("/all", response_model=ScannerResponse)
def get_all_scanner_results():
    """Returns real-time 9/15 EMA + VWAP setup status for all 28 NSE F&O stocks."""
    return scanner_service.run_scan()

@router.get("/strong-signals")
def get_strong_signals():
    """Returns only high-conviction STRONG_BUY / STRONG_SELL setups."""
    results = scanner_service.run_scan()
    return {
        "timestamp": results.timestamp,
        "count": len(results.strong_signals),
        "signals": results.strong_signals
    }

@router.get("/quote/{symbol}")
def get_symbol_quote(symbol: str):
    """Returns live quote, EMA 9/15, and VWAP for a single stock."""
    sym = symbol.upper()
    if sym not in FNO_DICT:
        raise HTTPException(status_code=404, detail=f"Symbol {sym} not found in verified universe.")
    
    quote = market_data.live_quotes.get(sym, {})
    return quote

@router.post("/trigger")
def trigger_rescan():
    """Manually forces an instant recalculation of all technical setups."""
    res = scanner_service.run_scan()
    return {"status": "SUCCESS", "timestamp": res.timestamp, "total_scanned": len(res.stocks)}
