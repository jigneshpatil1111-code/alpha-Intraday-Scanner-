from typing import List, Optional, Dict, Any
from pydantic import BaseModel

# Auth Schemas
class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# Market Data & Candle Schemas
class Candle(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    ema9: Optional[float] = None
    ema15: Optional[float] = None
    vwap: Optional[float] = None

class StockQuote(BaseModel):
    symbol: str
    sector: str
    ltp: float
    change: float
    change_pct: float
    high: float
    low: float
    volume: int
    ema9: float
    ema15: float
    vwap: float
    signal: str  # STRONG_BUY, BUY, NEUTRAL, SELL, STRONG_SELL
    confidence: float
    alpha_score: Optional[float] = 50.0
    is_top_pick: Optional[bool] = False
    suggested_sl: Optional[float] = 0.0
    target_1: Optional[float] = 0.0
    target_2: Optional[float] = 0.0
    risk_reward: Optional[str] = "1:2.0"
    lot_size: int
    kronos_forecast: Optional[str] = "NEUTRAL"
    kronos_delta_pct: Optional[float] = 0.0

# Backtest Schemas
class BacktestRequest(BaseModel):
    symbol: str
    capital: float = 100000.0
    risk_per_trade_pct: float = 1.0
    days: int = 5
    brokerage_per_order: float = 20.0
    fast_ema: int = 9
    slow_ema: int = 15

class TradeRecord(BaseModel):
    id: int
    symbol: str
    entry_time: str
    exit_time: str
    type: str  # LONG / SHORT
    entry_price: float
    exit_price: float
    qty: int
    reason: str
    gross_pnl: float
    charges: float
    net_pnl: float
    pnl_pct: float

class BacktestResponse(BaseModel):
    symbol: str
    days: int
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    profit_factor: float
    max_drawdown_pct: float
    gross_pnl: float
    total_charges: float
    net_pnl: float
    roi_pct: float
    trades: List[TradeRecord]
    equity_curve: List[Dict[str, Any]]
    candles: List[Candle]

# Paper Trading Schemas
class OrderCreate(BaseModel):
    symbol: str
    side: str  # BUY or SELL
    qty: int
    price: Optional[float] = None  # None for Market
    sl_price: Optional[float] = None
    tp_price: Optional[float] = None
    strategy: Optional[str] = "9_15_EMA_VWAP"

class OrderClose(BaseModel):
    order_id: int
    exit_price: Optional[float] = None

# Scanner Schemas
class ScannerResponse(BaseModel):
    timestamp: str
    stocks: List[StockQuote]
    bullish_count: int
    bearish_count: int
    neutral_count: int
    strong_signals: List[StockQuote]
    top_profit_picks: List[StockQuote] = []
