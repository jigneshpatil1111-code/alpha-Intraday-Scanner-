from fastapi import APIRouter, HTTPException
from backend.app.models.schemas import BacktestRequest, BacktestResponse
from backend.app.services.market_data import market_data, FNO_DICT
from backend.app.core.backtest_engine import BacktestEngine

router = APIRouter(prefix="/backtest", tags=["Backtesting"])

@router.post("/run", response_model=BacktestResponse)
def run_backtest(req: BacktestRequest):
    """
    Executes historical 5-minute backtest using 9/15 EMA + VWAP rules.
    Includes exact Indian statutory charges (STT, Stamp Duty, GST, Exchange charges).
    """
    sym = req.symbol.upper()
    if sym not in FNO_DICT:
        raise HTTPException(status_code=404, detail=f"Symbol {sym} not found in NSE F&O list.")

    lot_size = FNO_DICT[sym].get("lotSize", 1)
    df = market_data.get_5m_candles(sym, days=req.days)
    if len(df) == 0:
        raise HTTPException(status_code=400, detail="Failed to retrieve candlestick data for backtest.")

    engine = BacktestEngine(
        capital=req.capital,
        risk_per_trade_pct=req.risk_per_trade_pct,
        brokerage_per_order=req.brokerage_per_order,
        fast_ema=req.fast_ema,
        slow_ema=req.slow_ema
    )

    result = engine.run(df=df, symbol=sym, lot_size=lot_size)
    return result
