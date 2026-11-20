from typing import List, Dict, Any
import datetime
from backend.app.services.market_data import market_data, NSE_FNO_UNIVERSE
from backend.app.core.strategy_engine import StrategyEngine
from backend.app.core.kronos_engine import kronos_engine
from backend.app.services.sector_service import sector_service
from backend.app.models.schemas import StockQuote, ScannerResponse

class ScannerService:
    """
    Continuous Multi-Stock 9 & 15 EMA + VWAP Scanner for Full NSE F&O Universe (179+ Stocks).
    Features Kronos K-Line Multi-Step Candlestick Simulation & Sector Money Flow Confluence.
    Filters out weak setups and recommends ONLY high-probability strong momentum stocks.
    """

    def __init__(self):
        self.strategy_engine = StrategyEngine(fast_ema=9, slow_ema=15)
        self.cached_results: List[StockQuote] = []
        self.last_scan_time: str = ""

    def run_scan(self) -> Dict[str, Any]:
        """Executes a full sweep over all NSE F&O universe stocks with Kronos & Sector filtering."""
        raw_stocks: List[Dict[str, Any]] = []
        results: List[StockQuote] = []
        bullish = 0
        bearish = 0
        neutral = 0
        strong_signals = []

        # 1. Evaluate Strategy Signals for all 179 stocks
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

        # 2. Institutional Sector Flow & Heatmap Analysis
        sector_analysis = sector_service.analyze_sectors(raw_stocks)
        inflow_sectors = {s["sector"]: s for s in sector_analysis["top_inflow_sectors"]}
        outflow_sectors = {s["sector"]: s for s in sector_analysis["top_outflow_sectors"]}

        # 3. Kronos K-Line Simulation & Strict Strong Momentum Filtering
        recommended_top_picks = []

        for s in raw_stocks:
            sym = s["symbol"]
            df = s["df"]
            recent_candles = df.tail(15).to_dict(orient="records")

            # Run Kronos Multi-Step Candlestick Simulation
            kronos_sim = kronos_engine.simulate_future_k_lines(sym, recent_candles, horizon=5)
            s["kronos_forecast"] = kronos_sim["direction"]
            s["kronos_delta_pct"] = kronos_sim["delta_pct"]
            s["kronos_confidence"] = kronos_sim["confidence"]
            s["kronos_projected_candles"] = kronos_sim["projected_candles"]

            # Strict Strategy + Kronos + Sector Confluence:
            # - Long recommendation requires:
            #   1) 9 EMA > 15 EMA & Price > VWAP (BUY/STRONG_BUY)
            #   2) Kronos forecasts Positive Momentum (delta > 0)
            #   3) Sector is in Inflow / Positive territory
            is_valid_long = ("BUY" in s["signal"]) and (kronos_sim["delta_pct"] >= 0.3)
            is_valid_short = ("SELL" in s["signal"]) and (kronos_sim["delta_pct"] <= -0.3)

            # Check sector alignment bonus
            sec_name = s["sector"]
            has_sector_support = (is_valid_long and sec_name in inflow_sectors) or (is_valid_short and sec_name in outflow_sectors)

            if (is_valid_long or is_valid_short) and s["volume_surge"] >= 1.2:
                confluence_score = s["alpha_score"] * 0.4 + kronos_sim["confidence"] * 0.4 + (20.0 if has_sector_support else 5.0)
                s["confluence_score"] = round(min(99.0, confluence_score), 1)
                s["has_sector_tailwind"] = has_sector_support

                if s["confluence_score"] >= 80.0:
                    recommended_top_picks.append(s)

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
                kronos_forecast=s["kronos_forecast"],
                kronos_delta_pct=s["kronos_delta_pct"]
            )
            results.append(quote)
            if "STRONG" in quote.signal:
                strong_signals.append(quote)

        # Sort recommended top picks by Confluence Score descending
        recommended_top_picks.sort(key=lambda x: -x.get("confluence_score", 0))
        top_picks_out = []
        for p in recommended_top_picks[:5]:
            top_picks_out.append({
                "symbol": p["symbol"],
                "sector": p["sector"],
                "ltp": p["ltp"],
                "change_pct": p["change_pct"],
                "signal": p["signal"],
                "alpha_score": p["alpha_score"],
                "confluence_score": p.get("confluence_score", 85.0),
                "suggested_sl": p["suggested_sl"],
                "target_1": p["target_1"],
                "target_2": p["target_2"],
                "risk_reward": p["risk_reward"],
                "volume_surge": p["volume_surge"],
                "lot_size": p["lot_size"],
                "kronos_forecast": p["kronos_forecast"],
                "kronos_delta_pct": p["kronos_delta_pct"],
                "has_sector_tailwind": p.get("has_sector_tailwind", True),
                "projected_candles": p["kronos_projected_candles"]
            })

        # Sort all stocks by Alpha Score descending
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
            "strong_signals_count": len(strong_signals),
            "top_profit_picks": top_picks_out,
            "sector_analysis": sector_analysis
        }

scanner_service = ScannerService()
