from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.schemas import OrderCreate, OrderClose
from backend.app.services.broker_service import broker_service

router = APIRouter(prefix="/trade", tags=["Paper Trading"])

@router.post("/order")
def place_order(order_in: OrderCreate, db: Session = Depends(get_db)):
    """Places a new paper trading buy/sell order."""
    try:
        return broker_service.place_order(db, order_in)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/close")
def close_order(close_in: OrderClose, db: Session = Depends(get_db)):
    """Closes an active paper trade and finalizes net P&L after taxes."""
    try:
        return broker_service.close_order(db, close_in.order_id, close_in.exit_price)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/positions")
def list_positions(db: Session = Depends(get_db)):
    """Returns all paper trading positions with live MTOM P&L."""
    return broker_service.get_positions(db)

@router.get("/summary")
def get_pnl_summary(db: Session = Depends(get_db)):
    """Returns cumulative P&L, win rate, and total brokerage/taxes paid."""
    positions = broker_service.get_positions(db)
    closed = [p for p in positions if p['status'] == "CLOSED"]
    open_pos = [p for p in positions if p['status'] == "OPEN"]

    realized_gross = sum(p['gross_pnl'] for p in closed)
    realized_net = sum(p['net_pnl'] for p in closed)
    total_charges = sum(p['charges'] for p in positions)
    unrealized_gross = sum(p['gross_pnl'] for p in open_pos)
    unrealized_net = sum(p['net_pnl'] for p in open_pos)

    wins = len([p for p in closed if p['net_pnl'] > 0])
    total_closed = len(closed)
    win_rate = (wins / total_closed * 100.0) if total_closed > 0 else 0.0

    return {
        "open_positions": len(open_pos),
        "closed_trades": total_closed,
        "win_rate": round(win_rate, 1),
        "realized_gross_pnl": round(realized_gross, 2),
        "realized_net_pnl": round(realized_net, 2),
        "unrealized_net_pnl": round(unrealized_net, 2),
        "total_charges_paid": round(total_charges, 2)
    }
