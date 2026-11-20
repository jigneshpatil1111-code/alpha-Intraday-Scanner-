from typing import List, Dict, Any
import datetime
from backend.app.services.market_data import market_data, NSE_FNO_UNIVERSE
from backend.app.core.strategy_engine import StrategyEngine
from backend.app.core.kronos_engine import kronos_engine
from backend.app.services.sector_service import sector_service
from backend.app.models.schemas import StockQuote

class ScannerService:
    """
    Full NSE F&O Scanner with Kronos simulation.
    Separates recommendations into INTRADAY vs SWING categories.
    Each recommendation has full Entry / SL / Target / Chart simulation.
    """

    def __init__(self):
        self.strategy_engine = StrategyEngine(fast_ema=9, slow_ema=15)
        self.cached_results: List[StockQuote] = []
        self.last_scan_time: str = ""

    def run_scan(self) -> Dict[str, Any]:
        """Full sweep over all NSE F&O universe stocks."""
        raw_stocks: List[Dict[str, Any]] = []
        results: List[StockQuote] = []
        bullish = 0
        bearish = 0
        neutral = 0

        # 1. Evaluate Strategy Signals for all stocks
        for item in NSE_FNO_UNIVERSE:
            sym = item['symbol']
            sector = item['sector']
            lot = item['lotSize']

            df = market_data.get_5m_candles(sym, days=2)
            sig_data = self.strategy_engine.analyze_signal(df)

            ltp = sig_data['ltp']
            base_p = item['basePrice']
            chg = round(ltp - base_p, 2)
            chg_pct = round((chg / base_p) * 100.0, 2)
            signal = sig_data['signal']

            if "BUY" in signal:
                bullish += 1
            elif "SELL" in signal:
                bearish += 1
            else:
                neutral += 1

            stock_dict = {
                "symbol": sym,
                "sector": sector,
                "ltp": ltp,
                "change": chg,
                "change_pct": chg_pct,
                "high": round(df['high'].max(), 2),
                "low": round(df['low'].min(), 2),
                "volume": int(df['volume'].iloc[-1]),
                "ema9": sig_data['ema9'],
                "ema15": sig_data['ema15'],
                "vwap": sig_data['vwap'],
                "signal": signal,
                "confidence": sig_data['confidence'],
                "alpha_score": sig_data['alpha_score'],
                "is_top_pick": sig_data['is_top_pick'],
                "suggested_sl": sig_data['suggested_sl'],
                "target_1": sig_data['target_1'],
                "target_2": sig_data['target_2'],
                "risk_reward": sig_data['risk_reward'],
                "volume_surge": sig_data['volume_surge'],
                "lot_size": lot,
                "df": df
            }
            raw_stocks.append(stock_dict)

        # 2. Sector Flow Analysis
        sector_analysis = sector_service.analyze_sectors(raw_stocks)
        inflow_sectors = {s["sector"]: s for s in sector_analysis["top_inflow_sectors"]}
        outflow_sectors = {s["sector"]: s for s in sector_analysis["top_outflow_sectors"]}

        # 3. Kronos Simulation + Confluence Scoring + Intraday/Swing Classification
        intraday_picks = []
        swing_picks = []

        for s in raw_stocks:
            sym = s["symbol"]
            df = s["df"]
            recent_candles = df.tail(20).to_dict(orient="records")

            # Kronos simulation
            kronos_sim = kronos_engine.simulate_future_k_lines(sym, recent_candles, horizon=5)
            s["kronos_forecast"] = kronos_sim["direction"]
            s["kronos_delta_pct"] = kronos_sim["delta_pct"]
            s["kronos_confidence"] = kronos_sim["confidence"]
            s["kronos_projected_candles"] = kronos_sim["projected_candles"]

            # Confluence check
            is_valid_long = ("BUY" in s["signal"]) and (kronos_sim["delta_pct"] >= 0.3)
            is_valid_short = ("SELL" in s["signal"]) and (kronos_sim["delta_pct"] <= -0.3)

            sec_name = s["sector"]
            has_sector_support = (is_valid_long and sec_name in inflow_sectors) or (is_valid_short and sec_name in outflow_sectors)

            if (is_valid_long or is_valid_short) and s["volume_surge"] >= 1.1:
                confluence_score = s["alpha_score"] * 0.4 + kronos_sim["confidence"] * 0.4 + (20.0 if has_sector_support else 5.0)
                s["confluence_score"] = round(min(99.0, confluence_score), 1)
                s["has_sector_tailwind"] = has_sector_support

                # Build trade plan
                ltp = s["ltp"]
                atr_range = s["high"] - s["low"]
                atr = max(ltp * 0.005, atr_range * 0.3)

                if is_valid_long:
                    entry = ltp
                    sl = round(ltp - atr, 2)
                    t1 = round(ltp + atr * 1.5, 2)
                    t2 = round(ltp + atr * 2.5, 2)
                    side = "BUY"
                else:
                    entry = ltp
                    sl = round(ltp + atr, 2)
                    t1 = round(ltp - atr * 1.5, 2)
                    t2 = round(ltp - atr * 2.5, 2)
                    side = "SELL"

                risk = abs(entry - sl)
                reward = abs(t2 - entry)

                pick = {
                    "symbol": sym,
                    "sector": sec_name,
                    "ltp": ltp,
                    "change_pct": s["change_pct"],
                    "signal": s["signal"],
                    "side": side,
                    "entry": round(entry, 2),
                    "stop_loss": sl,
                    "target_1": t1,
                    "target_2": t2,
                    "risk_reward": f"1:{round(reward / max(0.5, risk), 1)}",
                    "alpha_score": s["alpha_score"],
                    "confluence_score": s["confluence_score"],
                    "volume_surge": s["volume_surge"],
                    "lot_size": s["lot_size"],
                    "kronos_forecast": s["kronos_forecast"],
                    "kronos_delta_pct": s["kronos_delta_pct"],
                    "kronos_confidence": kronos_sim["confidence"],
                    "has_sector_tailwind": has_sector_support,
                    "projected_candles": s["kronos_projected_candles"]
                }

                # Classify: INTRADAY (strong delta, fresh cross, high volume)
                # vs SWING (moderate delta, aligned trend, sector tailwind)
                is_strong_cross = "STRONG" in s["signal"]
                is_high_momentum = abs(kronos_sim["delta_pct"]) >= 0.9 and s["volume_surge"] >= 1.3

                if is_strong_cross or is_high_momentum:
                    if s["confluence_score"] >= 75.0:
                        intraday_picks.append(pick)
                elif has_sector_support and s["confluence_score"] >= 72.0:
                    swing_picks.append(pick)
                elif s["confluence_score"] >= 78.0:
                    intraday_picks.append(pick)

            # Build Pydantic StockQuote
            quote = StockQuote(
                symbol=sym,
                sector=s["sector"],
                ltp=s["ltp"],
                change=s["change"],
                change_pct=s["change_pct"],
                high=s["high"],
                low=s["low"],
                volume=s["volume"],
                ema9=s["ema9"],
                ema15=s["ema15"],
                vwap=s["vwap"],
                signal=s["signal"],
                confidence=s["confidence"],
                alpha_score=s["alpha_score"],
                is_top_pick=s.get("is_top_pick", False),
                suggested_sl=s["suggested_sl"],
                target_1=s["target_1"],
                target_2=s["target_2"],
                risk_reward=s["risk_reward"],
                lot_size=s["lot_size"],
                kronos_forecast=s.get("kronos_forecast", "CHOPPY"),
                kronos_delta_pct=s.get("kronos_delta_pct", 0.0)
            )
            results.append(quote)

        # Sort picks by confluence score
        intraday_picks.sort(key=lambda x: -x.get("confluence_score", 0))
        swing_picks.sort(key=lambda x: -x.get("confluence_score", 0))

        # Limit to top picks
        intraday_picks = intraday_picks[:8]
        swing_picks = swing_picks[:8]

        # Sort all stocks
        results.sort(key=lambda q: (0 if "STRONG" in q.signal else 1, -q.alpha_score))

        self.cached_results = results
        self.last_scan_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        return {
            "timestamp": self.last_scan_time,
            "total_stocks": len(results),
            "stocks": results,
            "bullish_count": bullish,
            "bearish_count": bearish,
            "neutral_count": neutral,
            "intraday_picks": intraday_picks,
            "swing_picks": swing_picks,
            "sector_analysis": sector_analysis
        }

scanner_service = ScannerService()
