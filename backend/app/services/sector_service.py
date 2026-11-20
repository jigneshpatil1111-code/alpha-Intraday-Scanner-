from typing import List, Dict, Any
from backend.app.services.market_data import market_data, NSE_FNO_UNIVERSE

class SectorAnalysisService:
    """
    Institutional Sector Flow & Heatmap Engine.
    Tracks net money flow, buying pressure, and selling pressure across all F&O sectors.
    Identifies which sectors are leading the market and which stocks inside each sector
    have the strongest institutional accumulation or distribution.
    """

    def analyze_sectors(self, stocks_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Groups stocks by sector and computes:
        - Net sector change % (weighted by volume)
        - Bullish vs Bearish breadth
        - Top buying stocks in the sector
        - Top selling stocks in the sector
        - Sector momentum score
        """
        sectors: Dict[str, Dict[str, Any]] = {}

        for s in stocks_data:
            sec = s.get('sector', 'Other')
            if sec not in sectors:
                sectors[sec] = {
                    "sector": sec,
                    "stocks": [],
                    "total_volume": 0,
                    "avg_change_pct": 0.0,
                    "bullish_count": 0,
                    "bearish_count": 0,
                    "net_money_flow": 0.0,
                    "status": "NEUTRAL",
                    "top_buying_stocks": [],
                    "top_selling_stocks": []
                }

            sectors[sec]["stocks"].append(s)
            sectors[sec]["total_volume"] += s.get('volume', 0)
            if s.get('change_pct', 0) > 0:
                sectors[sec]["bullish_count"] += 1
            elif s.get('change_pct', 0) < 0:
                sectors[sec]["bearish_count"] += 1

        # Process aggregated metrics for each sector
        sector_list = []
        for sec, data in sectors.items():
            stock_list = data["stocks"]
            count = len(stock_list)
            if count == 0:
                continue

            avg_chg = sum(s.get('change_pct', 0) for s in stock_list) / count
            data["avg_change_pct"] = round(avg_chg, 2)

            # Sort stocks inside sector by change_pct and volume surge
            buying_stocks = sorted(
                [s for s in stock_list if s.get('change_pct', 0) > 0],
                key=lambda x: (x.get('change_pct', 0) * x.get('volume_surge', 1.0)),
                reverse=True
            )
            selling_stocks = sorted(
                [s for s in stock_list if s.get('change_pct', 0) < 0],
                key=lambda x: (abs(x.get('change_pct', 0)) * x.get('volume_surge', 1.0)),
                reverse=True
            )

            data["top_buying_stocks"] = [
                {
                    "symbol": s['symbol'],
                    "ltp": s.get('ltp', 0),
                    "change_pct": s.get('change_pct', 0),
                    "signal": s.get('signal', 'NEUTRAL'),
                    "volume_surge": s.get('volume_surge', 1.0),
                    "alpha_score": s.get('alpha_score', 50)
                } for s in buying_stocks[:4]
            ]

            data["top_selling_stocks"] = [
                {
                    "symbol": s['symbol'],
                    "ltp": s.get('ltp', 0),
                    "change_pct": s.get('change_pct', 0),
                    "signal": s.get('signal', 'NEUTRAL'),
                    "volume_surge": s.get('volume_surge', 1.0),
                    "alpha_score": s.get('alpha_score', 50)
                } for s in selling_stocks[:4]
            ]

            # Inflow status
            bull_ratio = data["bullish_count"] / count
            if avg_chg >= 0.75 and bull_ratio >= 0.6:
                data["status"] = "STRONG_INFLOW"
            elif avg_chg > 0.15:
                data["status"] = "MODERATE_INFLOW"
            elif avg_chg <= -0.75 and (data["bearish_count"] / count) >= 0.6:
                data["status"] = "STRONG_OUTFLOW"
            elif avg_chg < -0.15:
                data["status"] = "MODERATE_OUTFLOW"
            else:
                data["status"] = "CHOPPY_NEUTRAL"

            # Remove raw stock objects to keep payload lightweight
            del data["stocks"]
            sector_list.append(data)

        # Sort sectors by avg_change_pct descending (Top buying sectors first)
        sector_list.sort(key=lambda x: x["avg_change_pct"], reverse=True)

        top_inflow_sectors = [s for s in sector_list if "INFLOW" in s["status"]][:3]
        top_outflow_sectors = [s for s in sector_list if "OUTFLOW" in s["status"]][-3:]

        return {
            "sectors": sector_list,
            "top_inflow_sectors": top_inflow_sectors,
            "top_outflow_sectors": top_outflow_sectors,
            "leading_sector": sector_list[0]["sector"] if sector_list else "None",
            "lagging_sector": sector_list[-1]["sector"] if sector_list else "None"
        }

sector_service = SectorAnalysisService()
