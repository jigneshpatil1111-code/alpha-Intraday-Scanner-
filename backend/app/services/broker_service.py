from typing import List, Dict, Any, Optional
import datetime
from sqlalchemy.orm import Session
from backend.app.models.db_models import PaperOrder
from backend.app.models.schemas import OrderCreate
from backend.app.services.market_data import market_data, FNO_DICT
from backend.app.core.risk_manager import calculate_indian_statutory_charges

class BrokerPaperService:
    """
    Paper Trading & Order Management System (OMS)
    Features real-time P&L tracking, trailing SL, and Indian tax deductions.
    """

    def place_order(self, db: Session, order_in: OrderCreate) -> Dict[str, Any]:
        """Places a new paper trade order."""
        sym = order_in.symbol.upper()
        if sym not in FNO_DICT:
            raise ValueError(f"Symbol {sym} is not in the verified NSE F&O universe.")

        current_quote = market_data.live_quotes.get(sym, {"ltp": FNO_DICT[sym]['basePrice']})
        exec_price = order_in.price if order_in.price and order_in.price > 0 else current_quote['ltp']

        # Estimate initial charges for entry order
        charges = calculate_indian_statutory_charges(
            buy_val=exec_price * order_in.qty if order_in.side.upper() == "BUY" else 0,
            sell_val=exec_price * order_in.qty if order_in.side.upper() == "SELL" else 0,
            brokerage_per_order=20.0
        )

        db_order = PaperOrder(
            symbol=sym,
            side=order_in.side.upper(),
            qty=order_in.qty,
            entry_price=round(exec_price, 2),
            sl_price=round(order_in.sl_price, 2) if order_in.sl_price else None,
            tp_price=round(order_in.tp_price, 2) if order_in.tp_price else None,
            status="OPEN",
            gross_pnl=0.0,
            net_pnl=-charges['total_charges'],
            charges=charges['total_charges'],
            strategy=order_in.strategy or "9_15_EMA_VWAP",
            created_at=datetime.datetime.utcnow()
        )
        db.add(db_order)
        db.commit()
        db.refresh(db_order)

        return {
            "status": "SUCCESS",
            "message": f"Order #{db_order.id} executed for {order_in.side} {order_in.qty} {sym} @ ₹{exec_price:.2f}",
            "order_id": db_order.id,
            "order": {
                "id": db_order.id,
                "symbol": db_order.symbol,
                "side": db_order.side,
                "qty": db_order.qty,
                "entry_price": db_order.entry_price,
                "sl_price": db_order.sl_price,
                "tp_price": db_order.tp_price,
                "status": db_order.status,
                "created_at": db_order.created_at.isoformat()
            }
        }

    def close_order(self, db: Session, order_id: int, exit_price: Optional[float] = None) -> Dict[str, Any]:
        """Closes an open position and reconciles P&L and statutory taxes."""
        order = db.query(PaperOrder).filter(PaperOrder.id == order_id).first()
        if not order:
            raise ValueError(f"Order #{order_id} not found.")
        if order.status != "OPEN":
            return {"status": "FAILED", "message": f"Order #{order_id} is already {order.status}"}

        sym = order.symbol
        if exit_price is None or exit_price <= 0:
            quote = market_data.live_quotes.get(sym, {"ltp": order.entry_price})
            exit_price = quote['ltp']

        if order.side == "BUY":
            gross_pnl = (exit_price - order.entry_price) * order.qty
            buy_val = order.entry_price * order.qty
            sell_val = exit_price * order.qty
        else:
            gross_pnl = (order.entry_price - exit_price) * order.qty
            buy_val = exit_price * order.qty
            sell_val = order.entry_price * order.qty

        charges = calculate_indian_statutory_charges(buy_val, sell_val, brokerage_per_order=20.0)
        net_pnl = gross_pnl - charges['total_charges']

        order.exit_price = round(exit_price, 2)
        order.gross_pnl = round(gross_pnl, 2)
        order.charges = round(charges['total_charges'], 2)
        order.net_pnl = round(net_pnl, 2)
        order.status = "CLOSED"
        order.closed_at = datetime.datetime.utcnow()

        db.commit()
        db.refresh(order)

        return {
            "status": "SUCCESS",
            "message": f"Order #{order_id} closed @ ₹{exit_price:.2f}. Net P&L: ₹{net_pnl:+.2f}",
            "gross_pnl": order.gross_pnl,
            "charges": order.charges,
            "net_pnl": order.net_pnl
        }

    def get_positions(self, db: Session) -> List[Dict[str, Any]]:
        """Lists active and closed paper orders with live MTOM P&L."""
        orders = db.query(PaperOrder).order_by(PaperOrder.id.desc()).all()
        out = []
        for o in orders:
            current_p = market_data.live_quotes.get(o.symbol, {}).get("ltp", o.entry_price)
            if o.status == "OPEN":
                if o.side == "BUY":
                    cur_gross = (current_p - o.entry_price) * o.qty
                else:
                    cur_gross = (o.entry_price - current_p) * o.qty
                cur_net = cur_gross - o.charges
            else:
                cur_gross = o.gross_pnl
                cur_net = o.net_pnl

            out.append({
                "id": o.id,
                "symbol": o.symbol,
                "side": o.side,
                "qty": o.qty,
                "entry_price": o.entry_price,
                "exit_price": o.exit_price,
                "current_price": current_p,
                "sl_price": o.sl_price,
                "tp_price": o.tp_price,
                "status": o.status,
                "gross_pnl": round(cur_gross, 2),
                "net_pnl": round(cur_net, 2),
                "charges": o.charges,
                "created_at": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else ""
            })
        return out

broker_service = BrokerPaperService()
