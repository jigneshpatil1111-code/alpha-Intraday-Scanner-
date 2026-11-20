from typing import Dict, Any, List
import pandas as pd
import numpy as np
from backend.app.core.indicators import calculate_indicators

class StrategyEngine:
    """
    Institutional 9 & 15 EMA + VWAP Trading Strategy Engine for NSE F&O
    Features the Institutional Alpha Confluence Algorithm to rank the highest-probability
    profitable stocks for intraday & swing trading.
    """

    def __init__(self, fast_ema: int = 9, slow_ema: int = 15):
        self.fast_ema = fast_ema
        self.slow_ema = slow_ema

    def analyze_signal(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyzes latest candle in df and returns signal, metrics, and Alpha Score."""
        if len(df) < 5:
            return {
                "signal": "NEUTRAL",
                "confidence": 0.0,
                "alpha_score": 0.0,
                "is_top_pick": False,
                "reason": "Insufficient data",
                "ltp": float(df['close'].iloc[-1]) if len(df) > 0 else 0.0,
                "ema9": 0.0,
                "ema15": 0.0,
                "vwap": 0.0,
                "spread_pct": 0.0,
                "volume_surge": 1.0,
                "suggested_sl": 0.0,
                "target_1": 0.0,
                "target_2": 0.0,
                "risk_reward": "1:2.0"
            }

        df = calculate_indicators(df, self.fast_ema, self.slow_ema)
        curr = df.iloc[-1]
        prev = df.iloc[-2]

        close = float(curr['close'])
        ema9 = float(curr['ema_fast'])
        ema15 = float(curr['ema_slow'])
        vwap = float(curr['vwap'])
        prev_ema9 = float(prev['ema_fast'])
        prev_ema15 = float(prev['ema_slow'])
        vol_surge = float(curr.get('vol_surge', 1.0))
        atr = float(curr.get('atr14', close * 0.006))
        rsi = float(curr.get('rsi14', 50.0))

        spread_pct = ((ema9 - ema15) / ema15) * 100.0
        vwap_dist_pct = ((close - vwap) / vwap) * 100.0

        # Bullish conditions
        is_bullish_cross = (prev_ema9 <= prev_ema15) and (ema9 > ema15)
        is_bullish_aligned = (ema9 > ema15) and (close > vwap) and (close > ema9)

        # Bearish conditions
        is_bearish_cross = (prev_ema9 >= prev_ema15) and (ema9 < ema15)
        is_bearish_aligned = (ema9 < ema15) and (close < vwap) and (close < ema9)

        signal = "NEUTRAL"
        confidence = 50.0
        alpha_score = 45.0
        reason = "Consolidation / Indecision zone"

        # Multi-factor Alpha Scoring (0 to 100)
        if is_bullish_cross and (close > vwap):
            signal = "STRONG_BUY"
            base_score = 82.0
            vol_bonus = min(12.0, (vol_surge - 1.0) * 8.0) if vol_surge > 1.0 else -5.0
            rsi_bonus = 6.0 if (55 <= rsi <= 68) else 0.0
            alpha_score = min(98.5, base_score + vol_bonus + rsi_bonus)
            confidence = alpha_score
            reason = f"Fresh 9/15 EMA Bullish Cross above VWAP (Vol: {vol_surge:.1f}x, RSI: {rsi:.0f})"
        elif is_bullish_aligned:
            signal = "BUY"
            base_score = 72.0
            vol_bonus = min(10.0, (vol_surge - 1.0) * 6.0) if vol_surge > 1.0 else 0.0
            vwap_bonus = 5.0 if (0.3 <= vwap_dist_pct <= 2.0) else -5.0
            alpha_score = min(92.0, base_score + vol_bonus + vwap_bonus)
            confidence = alpha_score
            reason = f"Bullish Trend: 9 EMA > 15 EMA & Price > VWAP (Spread: {spread_pct:+.2f}%)"
        elif is_bearish_cross and (close < vwap):
            signal = "STRONG_SELL"
            base_score = 82.0
            vol_bonus = min(12.0, (vol_surge - 1.0) * 8.0) if vol_surge > 1.0 else -5.0
            rsi_bonus = 6.0 if (32 <= rsi <= 45) else 0.0
            alpha_score = min(98.5, base_score + vol_bonus + rsi_bonus)
            confidence = alpha_score
            reason = f"Fresh 9/15 EMA Bearish Breakdown below VWAP (Vol: {vol_surge:.1f}x, RSI: {rsi:.0f})"
        elif is_bearish_aligned:
            signal = "SELL"
            base_score = 72.0
            vol_bonus = min(10.0, (vol_surge - 1.0) * 6.0) if vol_surge > 1.0 else 0.0
            vwap_bonus = 5.0 if (-2.0 <= vwap_dist_pct <= -0.3) else -5.0
            alpha_score = min(92.0, base_score + vol_bonus + vwap_bonus)
            confidence = alpha_score
            reason = f"Bearish Trend: 9 EMA < 15 EMA & Price < VWAP (Spread: {spread_pct:+.2f}%)"

        # Stop Loss & Multi-Tier Profit Targets (Strict 1:2+ Risk-Reward)
        if "BUY" in signal:
            suggested_sl = round(min(float(curr['low']), vwap - (atr * 0.4)), 2)
            risk = max(1.0, close - suggested_sl)
            target_1 = round(close + risk * 1.5, 2)
            target_2 = round(close + risk * 2.5, 2)
            rr_str = f"1:{( (target_2 - close) / risk ):.1f}"
        elif "SELL" in signal:
            suggested_sl = round(max(float(curr['high']), vwap + (atr * 0.4)), 2)
            risk = max(1.0, suggested_sl - close)
            target_1 = round(close - risk * 1.5, 2)
            target_2 = round(close - risk * 2.5, 2)
            rr_str = f"1:{( (close - target_2) / risk ):.1f}"
        else:
            suggested_sl = round(close * 0.99, 2)
            target_1 = round(close * 1.015, 2)
            target_2 = round(close * 1.025, 2)
            rr_str = "1:2.0"

        # Crown as Top Profit Pick if score >= 84 and volume surge >= 1.2
        is_top_pick = (alpha_score >= 84.0 and vol_surge >= 1.2)

        return {
            "signal": signal,
            "confidence": round(confidence, 1),
            "alpha_score": round(alpha_score, 1),
            "is_top_pick": is_top_pick,
            "reason": reason,
            "ltp": round(close, 2),
            "ema9": round(ema9, 2),
            "ema15": round(ema15, 2),
            "vwap": round(vwap, 2),
            "spread_pct": round(spread_pct, 3),
            "volume_surge": round(vol_surge, 2),
            "suggested_sl": suggested_sl,
            "target_1": target_1,
            "target_2": target_2,
            "risk_reward": rr_str
        }
