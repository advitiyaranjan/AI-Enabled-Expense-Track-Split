from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["transactions"])


def normalize_amount(amount: float, tx_type: str) -> float:
    if tx_type == "expense":
        return -abs(float(amount))
    return abs(float(amount))


def serialize(t: models.Transaction) -> dict:
    """Map ORM objects to the frontend-friendly shape."""
    return {
        "id": t.id,
        "name": t.merchant_name,
        "category": t.category,
        "amount": float(t.amount),
        "date": t.date.isoformat() if t.date else None,
        "time": t.time.isoformat() if t.time else None,
        "icon": t.icon,
        "type": t.type,
    }


def build_transaction(tx: schemas.TransactionCreate, user_id: int) -> models.Transaction:
    return models.Transaction(
        user_id=user_id,
        merchant_name=tx.merchant_name,
        category=tx.category,
        amount=normalize_amount(tx.amount, tx.type),
        date=tx.date,
        time=tx.time,
        icon=tx.icon,
        type=tx.type,
    )


# Both "" and "/" are registered so clients don't pay for a 307 redirect on every call
@router.get("", response_model=List[dict], include_in_schema=False)
@router.get("/", response_model=List[dict])
def list_transactions(
    category: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id)
    if category:
        query = query.filter(models.Transaction.category == category)
    if type:
        query = query.filter(models.Transaction.type == type)
    if search:
        pattern = f"%{search}%"
        query = query.filter(or_(models.Transaction.merchant_name.ilike(pattern), models.Transaction.category.ilike(pattern)))
    items = query.order_by(models.Transaction.date.desc(), models.Transaction.created_at.desc()).offset(skip).limit(min(limit, 5000)).all()
    return [serialize(t) for t in items]


@router.post("", response_model=dict, include_in_schema=False)
@router.post("/", response_model=dict)
def create_transaction(tx: schemas.TransactionCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    t = build_transaction(tx, current_user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    return serialize(t)


@router.post("/bulk", response_model=dict)
def bulk_create_transactions(payload: schemas.TransactionBulkCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    created = [build_transaction(tx, current_user.id) for tx in payload.transactions]
    db.add_all(created)
    db.commit()
    for t in created:
        db.refresh(t)
    return {"created": len(created), "transactions": [serialize(t) for t in created]}


@router.put("/{tx_id}", response_model=dict)
def update_transaction(tx_id: int, tx: schemas.TransactionCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    t = db.query(models.Transaction).filter(models.Transaction.id == tx_id, models.Transaction.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    t.merchant_name = tx.merchant_name
    t.category = tx.category
    t.amount = normalize_amount(tx.amount, tx.type)
    t.date = tx.date
    t.time = tx.time
    t.icon = tx.icon
    t.type = tx.type
    db.commit()
    db.refresh(t)
    return serialize(t)


@router.delete("/{tx_id}")
def delete_transaction(tx_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    t = db.query(models.Transaction).filter(models.Transaction.id == tx_id, models.Transaction.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(t)
    db.commit()
    return {"detail": "deleted"}
