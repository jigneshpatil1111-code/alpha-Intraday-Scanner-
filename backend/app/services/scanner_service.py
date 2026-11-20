from typing import List, Dict, Any
import datetime
from backend.app.services.market_data import market_data, NSE_FNO_UNIVERSE
from backend.app.core.strategy_engine import StrategyEngine
from backend.app.core.kronos_engine import KronosForecastEngine
from backend.app.models.schemas import StockQuote, ScannerResponse

class ScannerService:
    """
    Continuous Multi-Stock 9 & 15 EMA + VWAP Scanner for Full NSE F&O Universe (179+ Stocks).
    Ranks high-probability setups and crowns the Best Profit Picks.
    """

    def __init__(self):
        self.strategy_engine = StrategyEngine(fast_ema=9, slow_ema=15)
        self.kronos_engine = KronosForecastEngine()
        self.cached_results: List[StockQuote] = []
        self.last_scan_time: str = ""

    def run_scan(self) -> ScannerResponse:
        """Executes a full sweep over all NSE F&O universe stocks."""
        results: List[StockQuote] = []
        bullish = 0
        bearish = 0
        neutral = 0
        strong_signals = []
        top_profit_picks = []

        for item in NSE_FNO_UNIVERSE:
            sym = item['symbol']
            sector = item['sector']
            lot = item['lotSize']

            # Get 5m candles and compute strategy signals
            df = market_data.get_5m_candles(sym, days=2)
            sig_data = self.strategy_engine.analyze_signal(df)

            # Get Kronos AI trajectory
            recent_candles = df.tail(15).to_dict(orient="records")
            kronos_proj = self.kronos_engine.forecast_next_k_lines(sym, recent_candles, horizon=5)

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

            quote = StockQuote(
                symbol=sym,
                sector=sector,
                ltp=ltp,
                change=chg,
                change_pct=chg_pct,
                high=round(df['high'].max(), 2),
                low=round(df['low'].min(), 2),
                volume=int(df['volume'].iloc[-1]),
                ema9=sig_data['ema9'],
                ema15=sig_data['ema15'],
                vwap=sig_data['vwap'],
                signal=signal,
                confidence=sig_data['confidence'],
                alpha_score=sig_data['alpha_score'],
                is_top_pick=sig_data['is_top_pick'],
                suggested_sl=sig_data['suggested_sl'],
                target_1=sig_data['target_1'],
                target_2=sig_data['target_2'],
                risk_reward=sig_data['risk_reward'],
                lot_size=lot,
                kronos_forecast=kronos_proj['direction'],
                kronos_delta_pct=kronos_proj['delta_pct']
            )

            results.append(quote)
            if "STRONG" in signal:
                strong_signals.append(quote)
            if quote.is_top_pick:
                top_profit_picks.append(quote)

        # Sort all stocks: Top picks first, then by Alpha Score descending
        results.sort(key=lambda q: (0 if q.is_top_pick else (1 if "STRONG" in q.signal else 2), -q.alpha_score))
        
        # Sort top profit picks by alpha_score and take the best 5
        top_profit_picks.sort(key=lambda q: -q.alpha_score)
        best_5_picks = top_profit_picks[:5]
        if len(best_5_picks) == 0:
            # Fallback to top confidence strong signals
            best_5_picks = strong_signals[:5]

        self.cached_results = results
        self.last_scan_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        return ScannerResponse(
            timestamp=self.last_scan_time,
            stocks=results,
            bullish_count=bullish,
            bearish_count=bearish,
            neutral_count=neutral,
            strong_signals=strong_signals,
            top_profit_picks=best_5_picks
        )

scanner_service = ScannerService()
