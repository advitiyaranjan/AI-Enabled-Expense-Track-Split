import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/splits", tags=["splits"])


def public_view(split: models.SharedSplit, owner: models.User) -> dict:
    return {
        "token": split.token,
        "title": split.title,
        "total": float(split.total),
        "currency": split.currency,
        "payee": {"name": owner.name, "upi_id": owner.upi_id, "public_id": owner.public_id},
        "participants": [
            {"key": p["key"], "name": p["name"], "amount": p["amount"], "settled": p.get("settled", False), "claimed": bool(p.get("claimed_at"))}
            for p in split.participants
        ],
        "created_at": split.created_at.isoformat() if split.created_at else None,
    }


@router.post("/share")
def share_split(body: schemas.SplitShareRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Publish (or update) a bill the current user paid, so friends can open a link and pay their share."""
    if not current_user.upi_id:
        raise HTTPException(status_code=400, detail="Add your UPI ID in Profile first so friends can pay you.")
    split = db.query(models.SharedSplit).filter(models.SharedSplit.owner_id == current_user.id, models.SharedSplit.client_id == body.client_id).first()
    previous = {p["key"]: p for p in (split.participants if split else [])}
    participants = []
    for p in body.participants:
        old = previous.get(p.key, {})
        participants.append({
            "key": p.key,
            "name": p.name,
            "amount": round(p.amount, 2),
            "settled": p.settled,
            # Keep "I've paid" taps across re-shares unless the owner has now settled it
            "claimed_at": None if p.settled else old.get("claimed_at"),
        })
    now = datetime.utcnow()
    if split is None:
        split = models.SharedSplit(token=secrets.token_urlsafe(12), owner_id=current_user.id, client_id=body.client_id, created_at=now)
        db.add(split)
    split.title = body.title
    split.total = body.total
    split.currency = current_user.currency or "INR"
    split.participants = participants  # reassign so SQLAlchemy sees the JSON change
    split.updated_at = now
    db.commit()
    db.refresh(split)
    return public_view(split, current_user)


@router.get("/mine")
def my_shared_splits(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    splits = db.query(models.SharedSplit).filter(models.SharedSplit.owner_id == current_user.id).all()
    return [{"client_id": s.client_id, **public_view(s, current_user)} for s in splits]


@router.delete("/{token}")
def unshare_split(token: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    split = db.query(models.SharedSplit).filter(models.SharedSplit.token == token, models.SharedSplit.owner_id == current_user.id).first()
    if split:
        db.delete(split)
        db.commit()
    return {"detail": "deleted"}


@router.get("/public/{token}")
def get_public_split(token: str, db: Session = Depends(get_db)):
    """No login: anyone with the link can see the bill and pay their share."""
    split = db.query(models.SharedSplit).filter(models.SharedSplit.token == token).first()
    if split is None:
        raise HTTPException(status_code=404, detail="This payment link doesn't exist or was removed.")
    owner = db.query(models.User).filter(models.User.id == split.owner_id).first()
    return public_view(split, owner)


@router.post("/public/{token}/claim")
def claim_paid(token: str, body: schemas.SplitClaimRequest, db: Session = Depends(get_db)):
    """A friend taps "I've paid". The owner still confirms (marks settled) in their app."""
    split = db.query(models.SharedSplit).filter(models.SharedSplit.token == token).first()
    if split is None:
        raise HTTPException(status_code=404, detail="This payment link doesn't exist or was removed.")
    participants = [dict(p) for p in split.participants]
    target = next((p for p in participants if p["key"] == body.key), None)
    if target is None:
        raise HTTPException(status_code=404, detail="That person isn't on this bill.")
    if not target.get("settled") and not target.get("claimed_at"):
        target["claimed_at"] = datetime.utcnow().isoformat()
        split.participants = participants
        db.commit()
    owner = db.query(models.User).filter(models.User.id == split.owner_id).first()
    return public_view(split, owner)
