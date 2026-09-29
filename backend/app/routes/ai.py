from collections import Counter
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import schemas
from ..auth import get_current_user
from ..database import get_db
from ..services import ai_service, analytics
from ..services.openai_service import ai_enabled
from .insights import load_user_transactions

router = APIRouter(prefix="/ai", tags=["ai"])


def merchant_category_history(txs: list[dict]) -> dict[str, str]:
    """The user's own most-used category per merchant, so quick-add learns from past corrections."""
    votes: dict[str, Counter] = {}
    for t in txs:
        key = analytics.normalize_merchant(t["name"])
        if key and t["type"] == "expense":
            votes.setdefault(key, Counter())[t["category"]] += 1
    return {key: counter.most_common(1)[0][0] for key, counter in votes.items()}


@router.get("/status")
def ai_status(current_user=Depends(get_current_user)):
    return {"ai_enabled": ai_enabled(), "suggestions": ai_service.SUGGESTIONS}


@router.post("/parse-transaction")
def parse_transaction(payload: schemas.ParseTransactionRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    txs = load_user_transactions(db, current_user.id)
    return ai_service.parse_transaction(payload.text, payload.today or date.today(), merchant_category_history(txs))


@router.post("/chat")
def chat(payload: schemas.ChatRequest, today: date | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    txs = load_user_transactions(db, current_user.id)
    budgets = [{"name": b.name, "limit": b.limit} for b in payload.budgets]
    ctx = ai_service.build_context(txs, budgets, current_user.currency or "USD", today or date.today())
    history = [{"role": turn.role, "content": turn.content} for turn in payload.history]
    return ai_service.chat(payload.message, history, ctx)
