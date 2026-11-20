import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    APP_NAME: str = "AlphaPulse IN Quant Terminal"
    VERSION: str = "2.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "alphapulse-jwt-secret-key-super-secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Database
    DATABASE_URL: str = f"sqlite:///{DATA_DIR / 'alpha_scanner.db'}"

    # Broker & Market Data
    TRADING_MODE: str = "paper"  # "paper" or "live"
    DEFAULT_DATA_FEED: str = "simulated"  # "simulated", "yfinance", "angelone", "dhan"

    # Angel One
    ANGEL_API_KEY: str = ""
    ANGEL_CLIENT_CODE: str = ""
    ANGEL_PASSWORD: str = ""
    ANGEL_TOTP_KEY: str = ""

    # DhanHQ
    DHAN_CLIENT_ID: str = ""
    DHAN_ACCESS_TOKEN: str = ""

    # Strategy Parameters
    DEFAULT_FAST_EMA: int = 9
    DEFAULT_SLOW_EMA: int = 15
    DEFAULT_TIMEFRAME: str = "5m"
    SLIPPAGE_PCT: float = 0.05
    BROKERAGE_PER_ORDER: float = 20.0

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
