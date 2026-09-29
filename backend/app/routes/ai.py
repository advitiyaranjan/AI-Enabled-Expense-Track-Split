from collections import Counter
from datetime import date
import hmac
import os
import time
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from .. import schemas
from ..auth import get_current_user
from ..database import get_db
from ..services import ai_service, analytics, openai_service
from ..services.openai_service import ai_status as openai_ai_status
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
    status = openai_ai_status()
    return {"ai_enabled": status["ready"], "model": status["model"], "models": status.get("models", {}), "error": status["error"], "suggestions": ai_service.SUGGESTIONS}


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


@router.post("/parse-split")
def parse_split(payload: schemas.ParseSplitRequest, current_user=Depends(get_current_user)):
    return ai_service.parse_split(payload.text, payload.friends)


@router.get("/probe", include_in_schema=False)
def ai_probe(x_probe_token: str | None = Header(default=None)):
    """Ops check: run each AI feature once. Disabled unless AI_PROBE_TOKEN is set on the server."""
    expected = os.getenv("AI_PROBE_TOKEN", "")
    if not expected or not x_probe_token or not hmac.compare_digest(expected, x_probe_token):
        raise HTTPException(status_code=404, detail="Not Found")
    today = date.today()
    results = {"model": openai_ai_status()}

    def timed(name, fn):
        start = time.perf_counter()
        try:
            value = fn()
            results[name] = {"seconds": round(time.perf_counter() - start, 1), "result": value}
        except Exception as exc:  # noqa: BLE001
            results[name] = {"seconds": round(time.perf_counter() - start, 1), "error": repr(exc)[:300]}

    timed("quick_add", lambda: ai_service.parse_transaction("coffee 4.50 at Starbucks yesterday", today, {}))
    timed("split", lambda: ai_service.parse_split("Dinner at Barbeque Nation 2400 with Sarah and Mike, Mike paid", ["Sarah Chen", "Mike Johnson"]))
    timed("receipt_text", lambda: openai_service.parse_receipt_text("FRESH MART\n14/04/2026\nMilk 3.50\nBread 2.25\nSubtotal 5.75\nTax 0.46\nTotal 6.21"))
    def receipt_photo():
        from io import BytesIO
        from PIL import Image, ImageDraw, ImageFont
        image = Image.new("RGB", (600, 700), "white")
        draw = ImageDraw.Draw(image)
        try:
            font = ImageFont.load_default(size=32)
        except TypeError:  # older Pillow
            font = ImageFont.load_default()
        for row, line in enumerate(["CAFE MOCHA", "Date: 21/09/2026", "Latte 180.00", "Croissant 120.00", "GST 15.00", "TOTAL 315.00"]):
            draw.text((40, 60 + row * 90), line, fill="black", font=font)
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=90)
        return openai_service.parse_receipt_image(buffer.getvalue(), "probe.jpg")

    timed("receipt_photo", receipt_photo)
    ctx = ai_service.build_context(
        [{"id": 1, "name": "Salary", "amount": 50000, "date": today.replace(day=1), "category": "Income", "type": "income"},
         {"id": 2, "name": "Rent", "amount": -15000, "date": today.replace(day=2), "category": "Utilities", "type": "expense"}],
        [{"name": "Utilities", "limit": 16000}], "INR", today)
    timed("chat", lambda: ai_service.chat("Can I afford a 5000 purchase this month?", [], ctx))
    return results
