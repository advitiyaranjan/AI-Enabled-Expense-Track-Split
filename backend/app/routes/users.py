from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/lookup/{public_id}")
def lookup_user(public_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Find someone by their FinanceAI ID to add them to a split. Only returns what a split needs."""
    user = db.query(models.User).filter(models.User.public_id == public_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="No user with that FinanceAI ID")
    return {"public_id": user.public_id, "name": user.name, "upi_id": user.upi_id, "is_you": user.id == current_user.id}
