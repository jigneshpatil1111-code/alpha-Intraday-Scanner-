import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from backend.app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(512), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PaperOrder(Base):
    __tablename__ = "paper_orders"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), index=True, nullable=False)
    side = Column(String(10), nullable=False)  # BUY or SELL
    qty = Column(Integer, nullable=False)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    sl_price = Column(Float, nullable=True)
    tp_price = Column(Float, nullable=True)
    status = Column(String(20), default="OPEN")  # OPEN, CLOSED, CANCELLED
    gross_pnl = Column(Float, default=0.0)
    net_pnl = Column(Float, default=0.0)
    charges = Column(Float, default=0.0)
    strategy = Column(String(100), default="9_15_EMA_VWAP")
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)

class ScannerAlert(Base):
    __tablename__ = "scanner_alerts"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    symbol = Column(String(50), index=True, nullable=False)
    timeframe = Column(String(20), default="5m")
    signal = Column(String(20), nullable=False)  # STRONG_BUY, BUY, NEUTRAL, SELL, STRONG_SELL
    ltp = Column(Float, nullable=False)
    ema9 = Column(Float, nullable=False)
    ema15 = Column(Float, nullable=False)
    vwap = Column(Float, nullable=False)
    spread_pct = Column(Float, default=0.0)
    volume_surge = Column(Float, default=1.0)
    confidence = Column(Float, default=0.0)
    kronos_direction = Column(String(20), default="FLAT")

class BacktestLog(Base):
    __tablename__ = "backtest_logs"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), nullable=False)
    timeframe = Column(String(20), default="5m")
    days_tested = Column(Integer, default=5)
    total_trades = Column(Integer, default=0)
    win_rate = Column(Float, default=0.0)
    profit_factor = Column(Float, default=0.0)
    max_drawdown = Column(Float, default=0.0)
    gross_pnl = Column(Float, default=0.0)
    total_charges = Column(Float, default=0.0)
    net_pnl = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
