from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/", response_model=List[dict])
def list_transactions(
    category: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id)
    if category:
        query = query.filter(models.Transaction.category == category)
    if type:
        query = query.filter(models.Transaction.type == type)
    if search:
        query = query.filter(models.Transaction.merchant_name.ilike(f"%{search}%"))
    items = query.order_by(models.Transaction.date.desc(), models.Transaction.created_at.desc()).offset(skip).limit(limit).all()

    # Map ORM objects to the frontend-friendly shape
    results = []
    for t in items:
        results.append({
            "id": t.id,
            "name": t.merchant_name,
            "category": t.category,
            "amount": float(t.amount),
            "date": t.date.isoformat() if t.date else None,
            "time": t.time.isoformat() if t.time else None,
            "icon": t.icon,
            "type": t.type,
        })
    return results


@router.post("/", response_model=dict)
def create_transaction(tx: schemas.TransactionCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    t = models.Transaction(
        user_id=current_user.id,
        merchant_name=tx.merchant_name,
        category=tx.category,
        amount=tx.amount,
        date=tx.date,
        time=tx.time,
        icon=tx.icon,
        type=tx.type,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.merchant_name, "category": t.category, "amount": float(t.amount), "date": t.date.isoformat() if t.date else None, "time": t.time.isoformat() if t.time else None, "icon": t.icon, "type": t.type}


@router.delete("/{tx_id}")
def delete_transaction(tx_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    t = db.query(models.Transaction).filter(models.Transaction.id == tx_id, models.Transaction.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(t)
    db.commit()
    return {"detail": "deleted"}
