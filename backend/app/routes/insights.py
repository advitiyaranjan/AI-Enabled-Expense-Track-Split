from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from .. import models
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/")
def get_insights(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # gather transactions for user
    txs = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id).all()

    # Monthly aggregation (last 6 months)
    now = datetime.utcnow()
    monthly = defaultdict(float)
    category = defaultdict(float)
    expenses = []
    for t in txs:
        amt = float(t.amount)
        if amt < 0:
            expenses.append(abs(amt))
            # categorize negative amounts as spending
            category[t.category or "Other"] += abs(amt)
        month = t.date.strftime("%Y-%m") if t.date else t.created_at.strftime("%Y-%m")
        monthly[month] += abs(amt) if amt < 0 else 0

    # Prepare monthly totals sorted
    months = sorted(monthly.items())
    monthly_totals = [{"month": m, "total": v} for m, v in months]

    # Predictions: simple moving average of last 3 months
    last3 = [v for _, v in months[-3:]]
    avg = float(statistics.mean(last3)) if last3 else 0.0
    predictions = []
    for i in range(1, 4):
        predictions.append({"month_offset": i, "predicted": round(avg, 2)})

    # Category breakdown
    category_breakdown = [{"category": k, "amount": v} for k, v in category.items()]

    # Unusual spending detection: transactions with amount > mean + 2*std
    unusual = []
    if expenses:
        mean = statistics.mean(expenses)
        std = statistics.pstdev(expenses) if len(expenses) > 1 else 0
        cutoff = mean + 2 * std
        for t in txs:
            if float(t.amount) < 0 and abs(float(t.amount)) > cutoff:
                unusual.append({"id": t.id, "name": t.merchant_name, "amount": abs(float(t.amount)), "date": t.date.isoformat() if t.date else None})

    return {"monthly_totals": monthly_totals, "category_breakdown": category_breakdown, "predictions": predictions, "unusual_spending": unusual}
