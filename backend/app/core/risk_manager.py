from typing import Dict, Any

def calculate_indian_statutory_charges(
    buy_val: float,
    sell_val: float,
    brokerage_per_order: float = 20.0
) -> Dict[str, float]:
    """
    Computes exact statutory charges according to Indian Tax Rules (SEBI / NSE / Budget 2024-2026):
    - Brokerage: flat ₹20 per order or 0.03% (whichever is lower)
    - STT (Securities Transaction Tax): 0.025% on Sell value for Equity Intraday
    - Exchange Transaction Charges: 0.00345% of total turnover (Buy + Sell)
    - SEBI Turnover Fees: ₹10 per crore (0.0001% of turnover)
    - Stamp Duty: 0.003% on Buy value
    - GST: 18% on (Brokerage + Exchange Txn + SEBI Fees)
    """
    turnover = buy_val + sell_val

    # Brokerage (Buy + Sell order)
    brokerage_buy = min(brokerage_per_order, buy_val * 0.0003)
    brokerage_sell = min(brokerage_per_order, sell_val * 0.0003)
    total_brokerage = round(brokerage_buy + brokerage_sell, 2)

    # STT on sell side only (0.025% for intraday equity)
    stt = round(sell_val * 0.00025, 2)

    # Exchange transaction charges (NSE equity: 0.00345%)
    exchange_charges = round(turnover * 0.0000345, 2)

    # SEBI turnover fee (₹10 / crore)
    sebi_fees = round(turnover * 0.000001, 2)

    # Stamp duty (0.003% on buy side only)
    stamp_duty = round(buy_val * 0.00003, 2)

    # GST 18% on (Brokerage + Exchange Charges + SEBI Charges)
    gst_taxable = total_brokerage + exchange_charges + sebi_fees
    gst = round(gst_taxable * 0.18, 2)

    total_charges = round(total_brokerage + stt + exchange_charges + sebi_fees + stamp_duty + gst, 2)

    return {
        "turnover": round(turnover, 2),
        "brokerage": total_brokerage,
        "stt": stt,
        "exchange_charges": exchange_charges,
        "sebi_fees": sebi_fees,
        "stamp_duty": stamp_duty,
        "gst": gst,
        "total_charges": total_charges
    }

class RiskManager:
    """Manages risk rules, max drawdown protection, and position sizing."""
    
    def __init__(self, account_capital: float = 100000.0, max_daily_loss_pct: float = 3.0):
        self.account_capital = account_capital
        self.max_daily_loss_pct = max_daily_loss_pct
        self.daily_pnl = 0.0
        self.is_kill_switch_active = False

    def check_trade_allowed(self) -> Dict[str, Any]:
        """Checks if trading is permitted or halted by daily loss limit."""
        max_allowed_loss = -1.0 * (self.account_capital * (self.max_daily_loss_pct / 100.0))
        if self.daily_pnl <= max_allowed_loss:
            self.is_kill_switch_active = True
            return {
                "allowed": False,
                "reason": f"Daily loss limit of ₹{abs(max_allowed_loss):.2f} reached! Kill switch active."
            }
        return {"allowed": True, "reason": "Risk parameters nominal"}

    def calculate_lot_position_size(
        self,
        capital: float,
        risk_pct: float,
        entry_price: float,
        sl_price: float,
        lot_size: int = 1
    ) -> int:
        """Calculates quantity strictly aligned with lot sizes."""
        risk_capital = capital * (risk_pct / 100.0)
        risk_per_unit = abs(entry_price - sl_price)
        if risk_per_unit <= 0.01:
            risk_per_unit = entry_price * 0.01

        raw_qty = int(risk_capital / risk_per_unit)
        if lot_size > 1:
            lots = max(1, raw_qty // lot_size)
            return lots * lot_size
        return max(1, raw_qty)
