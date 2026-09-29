from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..auth import get_current_user
from .. import models, schemas
from ..services import split_service

router = APIRouter(tags=["groups"])


def require_member(db: Session, group_id: int, user_id: int) -> models.Group:
    """Return the group if it exists and the user belongs to it; 404 otherwise so group ids aren't enumerable."""
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    is_member = group is not None and db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id, models.GroupMember.user_id == user_id
    ).first() is not None
    if not is_member:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


def member_ids(db: Session, group_id: int) -> set[int]:
    return {m.user_id for m in db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()}


@router.post("/groups", response_model=dict)
def create_group(payload: schemas.GroupCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    group = models.Group(name=payload.name, created_by=current_user.id)
    db.add(group)
    db.commit()
    db.refresh(group)
    # add creator as member
    gm = models.GroupMember(group_id=group.id, user_id=current_user.id)
    db.add(gm)
    db.commit()
    return {"id": group.id, "name": group.name}


@router.post("/groups/{group_id}/add-member", response_model=dict)
def add_member(group_id: int, payload: schemas.AddMemberRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_member(db, group_id, current_user.id)
    if not db.query(models.User).filter(models.User.id == payload.user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    if payload.user_id in member_ids(db, group_id):
        return {"detail": "already a member"}
    member = models.GroupMember(group_id=group_id, user_id=payload.user_id)
    db.add(member)
    db.commit()
    return {"detail": "member added"}


@router.post("/expenses/split", response_model=dict)
def split_expense(payload: schemas.ExpenseSplitRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_member(db, payload.group_id, current_user.id)
    members = member_ids(db, payload.group_id)
    if payload.paid_by not in members:
        raise HTTPException(status_code=400, detail="Payer must be a group member")
    if payload.splits:
        if any(s.get("user_id") not in members for s in payload.splits):
            raise HTTPException(status_code=400, detail="Every split must belong to a group member")
        if abs(sum(float(s.get("amount", 0)) for s in payload.splits) - float(payload.total_amount)) > 0.01:
            raise HTTPException(status_code=400, detail="Split amounts must add up to the total")

    expense = models.Expense(group_id=payload.group_id, paid_by=payload.paid_by, total_amount=payload.total_amount, description=payload.description)
    db.add(expense)
    db.commit()
    db.refresh(expense)

    splits = []
    if payload.splits:
        for s in payload.splits:
            split = models.ExpenseSplit(expense_id=expense.id, user_id=s["user_id"], amount_owed=s["amount"], is_settled=False)
            db.add(split)
            splits.append({"user_id": s["user_id"], "amount": s["amount"]})
    else:
        members = db.query(models.GroupMember).filter(models.GroupMember.group_id == payload.group_id).order_by(models.GroupMember.id).all()
        if not members:
            raise HTTPException(status_code=400, detail="No group members to split between")
        # Work in cents and hand leftover cents to the first members so shares always sum to the total
        total_cents = round(float(payload.total_amount) * 100)
        base, remainder = divmod(total_cents, len(members))
        for index, m in enumerate(members):
            share = (base + (1 if index < remainder else 0)) / 100
            split = models.ExpenseSplit(expense_id=expense.id, user_id=m.user_id, amount_owed=share, is_settled=(m.user_id == payload.paid_by))
            db.add(split)
            splits.append({"user_id": m.user_id, "amount": share})

    db.commit()
    return {"expense_id": expense.id, "splits": splits}


@router.get("/groups/{group_id}/balances", response_model=dict)
def group_balances(group_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_member(db, group_id, current_user.id)

    members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
    user_ids = [m.user_id for m in members]

    # compute net balance per user: positive means they should receive money
    balances = {uid: 0.0 for uid in user_ids}

    # total paid per user
    expenses = db.query(models.Expense).filter(models.Expense.group_id == group_id).all()
    for e in expenses:
        balances[e.paid_by] = balances.get(e.paid_by, 0.0) + float(e.total_amount)

    # subtract owed amounts
    splits = db.query(models.ExpenseSplit).join(models.Expense, models.ExpenseSplit.expense_id == models.Expense.id).filter(models.Expense.group_id == group_id).all()
    for s in splits:
        balances[s.user_id] = balances.get(s.user_id, 0.0) - float(s.amount_owed)

    settlements = split_service.settle_balances(balances)

    # map user ids to names
    users = db.query(models.User).filter(models.User.id.in_(list(balances))).all()
    id_to_name = {u.id: u.name for u in users}

    readable = [f"{id_to_name.get(s['from_user_id'], s['from_user_id'])} pays {id_to_name.get(s['to_user_id'], s['to_user_id'])} {s['amount']:.2f}" for s in settlements]

    return {"balances": balances, "settlements": settlements, "readable": readable}
