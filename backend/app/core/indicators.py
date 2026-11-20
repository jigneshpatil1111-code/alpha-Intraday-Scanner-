import pandas as pd
import numpy as np

def calculate_ema(series: pd.Series, period: int) -> pd.Series:
    """Calculate Exponential Moving Average (EMA)."""
    return series.ewm(span=period, adjust=False).mean()

def calculate_vwap(df: pd.DataFrame) -> pd.Series:
    """
    Calculate Intraday Volume Weighted Average Price (VWAP).
    Requires 'high', 'low', 'close', 'volume'.
    Resets daily if 'date' column or datetime index is present.
    """
    typical_price = (df['high'] + df['low'] + df['close']) / 3.0
    tp_vol = typical_price * df['volume']

    # If datetime index exists, group by date for intraday reset
    if isinstance(df.index, pd.DatetimeIndex):
        groups = df.index.normalize()
        cum_tp_vol = tp_vol.groupby(groups).cumsum()
        cum_vol = df['volume'].groupby(groups).cumsum()
    elif 'date' in df.columns:
        cum_tp_vol = tp_vol.groupby(df['date']).cumsum()
        cum_vol = df['volume'].groupby(df['date']).cumsum()
    else:
        cum_tp_vol = tp_vol.cumsum()
        cum_vol = df['volume'].cumsum()

    # Avoid zero division
    cum_vol = cum_vol.replace(0, np.nan)
    vwap = cum_tp_vol / cum_vol
    return vwap.bfill().fillna(df['close'])

def calculate_indicators(df: pd.DataFrame, fast_ema: int = 9, slow_ema: int = 15) -> pd.DataFrame:
    """
    Appends 9 EMA, 15 EMA, VWAP, ATR, and Volume SMA to the DataFrame.
    """
    df = df.copy()
    if 'close' not in df.columns or len(df) == 0:
        return df

    df['ema_fast'] = calculate_ema(df['close'], fast_ema)
    df['ema_slow'] = calculate_ema(df['close'], slow_ema)
    df['vwap'] = calculate_vwap(df)

    # 20-period Volume Moving Average for surge detection
    if 'volume' in df.columns:
        df['vol_sma20'] = df['volume'].rolling(window=20, min_periods=1).mean()
        df['vol_surge'] = df['volume'] / df['vol_sma20'].replace(0, 1)
    else:
        df['vol_surge'] = 1.0

    # ATR (14) for volatility & stop loss sizing
    high_low = df['high'] - df['low']
    high_close = (df['high'] - df['close'].shift()).abs()
    low_close = (df['low'] - df['close'].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df['atr14'] = tr.rolling(window=14, min_periods=1).mean()

    # RSI (14)
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14, min_periods=1).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14, min_periods=1).mean()
    rs = gain / loss.replace(0, 1e-9)
    df['rsi14'] = 100 - (100 / (1 + rs))

    return df
