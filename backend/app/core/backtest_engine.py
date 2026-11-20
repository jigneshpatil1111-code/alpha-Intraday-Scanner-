from typing import Dict, Any, List
import pandas as pd
import numpy as np
from backend.app.core.indicators import calculate_indicators
from backend.app.core.risk_manager import calculate_indian_statutory_charges

class BacktestEngine:
    """
    High-fidelity NSE Intraday Backtesting Engine with Statutory Tax & Charge modeling.
    Simulates tick-by-tick candle execution with slippage and exact SEBI/Govt charges.
    """

    def __init__(
        self,
        capital: float = 100000.0,
        risk_per_trade_pct: float = 1.0,
        brokerage_per_order: float = 20.0,
        slippage_pct: float = 0.05,
        fast_ema: int = 9,
        slow_ema: int = 15
    ):
        self.capital = capital
        self.risk_per_trade_pct = risk_per_trade_pct
        self.brokerage_per_order = brokerage_per_order
        self.slippage_pct = slippage_pct
        self.fast_ema = fast_ema
        self.slow_ema = slow_ema

    def run(self, df: pd.DataFrame, symbol: str = "RELIANCE", lot_size: int = 1) -> Dict[str, Any]:
        """Runs the 9/15 EMA + VWAP backtest over candle data."""
        df = calculate_indicators(df, self.fast_ema, self.slow_ema)
        
        trades: List[Dict[str, Any]] = []
        equity = self.capital
        peak_equity = self.capital
        max_drawdown = 0.0
        equity_curve = [{"time": "START", "equity": round(equity, 2), "drawdown": 0.0}]

        position = None  # None or dict
        trade_id = 1

        for i in range(2, len(df)):
            curr = df.iloc[i]
            prev = df.iloc[i - 1]

            close = float(curr['close'])
            high = float(curr['high'])
            low = float(curr['low'])
            time_str = str(curr.get('time', f"Candle-{i}"))
            ema9 = float(curr['ema_fast'])
            ema15 = float(curr['ema_slow'])
            vwap = float(curr['vwap'])

            prev_ema9 = float(prev['ema_fast'])
            prev_ema15 = float(prev['ema_slow'])

            # 1. Manage Open Position
            if position is not None:
                side = position['side']
                entry_price = position['entry_price']
                sl_price = position['sl_price']
                qty = position['qty']

                should_exit = False
                exit_reason = ""
                exit_price = close

                # Check SL
                if side == "LONG":
                    if low <= sl_price:
                        should_exit = True
                        exit_price = sl_price
                        exit_reason = "Stop Loss Hit"
                    elif (prev_ema9 >= prev_ema15) and (ema9 < ema15):
                        should_exit = True
                        exit_price = close * (1.0 - self.slippage_pct / 100.0)
                        exit_reason = "EMA Bearish Cross Reversal"
                    elif close < vwap and prev['close'] >= prev['vwap']:
                        should_exit = True
                        exit_price = close * (1.0 - self.slippage_pct / 100.0)
                        exit_reason = "VWAP Breakdown Exit"
                elif side == "SHORT":
                    if high >= sl_price:
                        should_exit = True
                        exit_price = sl_price
                        exit_reason = "Stop Loss Hit"
                    elif (prev_ema9 <= prev_ema15) and (ema9 > ema15):
                        should_exit = True
                        exit_price = close * (1.0 + self.slippage_pct / 100.0)
                        exit_reason = "EMA Bullish Cross Reversal"
                    elif close > vwap and prev['close'] <= prev['vwap']:
                        should_exit = True
                        exit_price = close * (1.0 + self.slippage_pct / 100.0)
                        exit_reason = "VWAP Breakout Exit"

                # Check End-of-Day auto square-off at 15:15
                if "15:15" in time_str or "15:20" in time_str or "15:25" in time_str:
                    should_exit = True
                    exit_reason = "Intraday EOD Auto Square-Off"

                if should_exit:
                    if side == "LONG":
                        gross_pnl = (exit_price - entry_price) * qty
                    else:
                        gross_pnl = (entry_price - exit_price) * qty

                    buy_val = entry_price * qty if side == "LONG" else exit_price * qty
                    sell_val = exit_price * qty if side == "LONG" else entry_price * qty

                    charges = calculate_indian_statutory_charges(
                        buy_val=buy_val,
                        sell_val=sell_val,
                        brokerage_per_order=self.brokerage_per_order
                    )

                    net_pnl = gross_pnl - charges['total_charges']
                    equity += net_pnl
                    peak_equity = max(peak_equity, equity)
                    dd = max(0.0, (peak_equity - equity) / peak_equity * 100.0)
                    max_drawdown = max(max_drawdown, dd)

                    trades.append({
                        "id": trade_id,
                        "symbol": symbol,
                        "type": side,
                        "entry_time": position['entry_time'],
                        "exit_time": time_str,
                        "entry_price": round(entry_price, 2),
                        "exit_price": round(exit_price, 2),
                        "qty": qty,
                        "reason": exit_reason,
                        "gross_pnl": round(gross_pnl, 2),
                        "charges": round(charges['total_charges'], 2),
                        "net_pnl": round(net_pnl, 2),
                        "pnl_pct": round((net_pnl / (entry_price * qty)) * 100.0, 2)
                    })
                    trade_id += 1
                    position = None

                    equity_curve.append({
                        "time": time_str,
                        "equity": round(equity, 2),
                        "drawdown": round(dd, 2)
                    })

            # 2. Check for New Entry
            if position is None:
                bullish_entry = (prev_ema9 <= prev_ema15) and (ema9 > ema15) and (close > vwap) and (close > ema9)
                bearish_entry = (prev_ema9 >= prev_ema15) and (ema9 < ema15) and (close < vwap) and (close < ema9)

                # Avoid new entries after 14:45
                is_late = any(t in time_str for t in ["14:50", "15:00", "15:15", "15:20"])

                if not is_late:
                    risk_amount = equity * (self.risk_per_trade_pct / 100.0)

                    if bullish_entry:
                        entry_price = close * (1.0 + self.slippage_pct / 100.0)
                        sl_price = min(float(curr['low']), vwap * 0.998)
                        risk_per_share = max(1.0, entry_price - sl_price)
                        calc_qty = max(lot_size, int(risk_amount / risk_per_share))
                        # Lot size alignment
                        calc_qty = max(lot_size, (calc_qty // lot_size) * lot_size)

                        position = {
                            "side": "LONG",
                            "entry_time": time_str,
                            "entry_price": entry_price,
                            "sl_price": sl_price,
                            "qty": calc_qty
                        }
                    elif bearish_entry:
                        entry_price = close * (1.0 - self.slippage_pct / 100.0)
                        sl_price = max(float(curr['high']), vwap * 1.002)
                        risk_per_share = max(1.0, sl_price - entry_price)
                        calc_qty = max(lot_size, int(risk_amount / risk_per_share))
                        calc_qty = max(lot_size, (calc_qty // lot_size) * lot_size)

                        position = {
                            "side": "SHORT",
                            "entry_time": time_str,
                            "entry_price": entry_price,
                            "sl_price": sl_price,
                            "qty": calc_qty
                        }

        # Calculate backtest summary
        total_trades = len(trades)
        wins = [t for t in trades if t['net_pnl'] > 0]
        losses = [t for t in trades if t['net_pnl'] <= 0]
        win_count = len(wins)
        loss_count = len(losses)
        win_rate = (win_count / total_trades * 100.0) if total_trades > 0 else 0.0

        gross_wins = sum(t['gross_pnl'] for t in wins)
        gross_losses = abs(sum(t['gross_pnl'] for t in losses))
        profit_factor = (gross_wins / gross_losses) if gross_losses > 0 else (99.0 if gross_wins > 0 else 0.0)

        total_gross_pnl = sum(t['gross_pnl'] for t in trades)
        total_charges = sum(t['charges'] for t in trades)
        net_pnl = total_gross_pnl - total_charges
        roi_pct = (net_pnl / self.capital) * 100.0

        # Transform candles for frontend rendering
        candles_out = []
        for _, row in df.iterrows():
            candles_out.append({
                "time": str(row.get('time', '')),
                "open": round(float(row['open']), 2),
                "high": round(float(row['high']), 2),
                "low": round(float(row['low']), 2),
                "close": round(float(row['close']), 2),
                "volume": int(row['volume']),
                "ema9": round(float(row['ema_fast']), 2),
                "ema15": round(float(row['ema_slow']), 2),
                "vwap": round(float(row['vwap']), 2)
            })

        return {
            "symbol": symbol,
            "days": 5,
            "total_trades": total_trades,
            "wins": win_count,
            "losses": loss_count,
            "win_rate": round(win_rate, 1),
            "profit_factor": round(profit_factor, 2),
            "max_drawdown_pct": round(max_drawdown, 2),
            "gross_pnl": round(total_gross_pnl, 2),
            "total_charges": round(total_charges, 2),
            "net_pnl": round(net_pnl, 2),
            "roi_pct": round(roi_pct, 2),
            "trades": trades,
            "equity_curve": equity_curve,
            "candles": candles_out
        }
