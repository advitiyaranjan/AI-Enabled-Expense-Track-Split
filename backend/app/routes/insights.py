from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from .. import models
from ..services import analytics

router = APIRouter(prefix="/insights", tags=["insights"])


def load_user_transactions(db: Session, user_id: int) -> list[dict]:
    rows = db.query(models.Transaction).filter(models.Transaction.user_id == user_id).all()
    return [
        {
            "id": t.id,
            "name": t.merchant_name,
            "category": t.category or "Other",
            "amount": float(t.amount),
            "date": t.date or t.created_at.date(),
            "type": "expense" if (t.type == "expense" or float(t.amount) < 0) else "income",
        }
        for t in rows
    ]


@router.get("", include_in_schema=False)
@router.get("/")
def get_insights(today: date | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # `today` lets the client pass its local date so month boundaries match the user's timezone
    return analytics.build_insights(load_user_transactions(db, current_user.id), today=today)
