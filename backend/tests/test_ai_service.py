from datetime import date

from app.services import ai_service
from app.services.openai_service import _heuristic_parse_receipt

TODAY = date(2026, 9, 30)  # a Wednesday


def parse(text, history=None):
    return ai_service.heuristic_parse_transaction(text, TODAY, history)


def test_quick_add_basic_expense():
    r = parse("Spent 450 on pizza at Dominos yesterday")
    assert r["amount"] == 450
    assert r["type"] == "expense"
    assert r["name"] == "Dominos"
    assert r["category"] == "Food & Dining"
    assert r["date"] == "2026-09-29"


def test_quick_add_income_and_k_suffix():
    r = parse("got salary 2.5k today")
    assert r["amount"] == 2500
    assert r["type"] == "income"
    assert r["category"] == "Income"


def test_quick_add_ignores_date_numbers():
    r = parse("uber 12.40 3 days ago")
    assert r["amount"] == 12.40
    assert r["date"] == "2026-09-27"
    assert r["category"] == "Transport"


def test_quick_add_last_weekday_and_learned_category():
    r = parse("$30 at Joes Barber last friday", {"joes barber": "Healthcare"})
    assert r["date"] == "2026-09-25"
    assert r["category"] == "Healthcare"


def test_receipt_total_beats_subtotal_and_year():
    text = "FRESH MART\nDate: 14/04/2026\nMilk 3.50\nBread 2.25\nSubtotal 5.75\nTax 0.46\nTotal 6.21\n"
    r = _heuristic_parse_receipt(text)
    assert r["amount"] == 6.21
    assert r["merchant"] == "FRESH MART"
    assert r["date"] == "2026-04-14"
    assert {"name": "Milk", "price": 3.5} in r["items"]


def test_receipt_without_total_does_not_use_year():
    r = _heuristic_parse_receipt("Corner Store\n2026-04-14\nChips 1.99\nSoda 2.49")
    assert r["amount"] == 2.49


def test_rules_reply_without_data_prompts_user():
    ctx = ai_service.build_context([], [], "USD", TODAY)
    assert "don't see any transactions" in ai_service.rules_reply("how am I doing", ctx)


def test_rules_reply_affordability_and_budgets():
    txs = [
        {"id": 1, "name": "Payroll", "amount": 3000, "date": date(2026, 9, 1), "category": "Income", "type": "income"},
        {"id": 2, "name": "Rent", "amount": -1000, "date": date(2026, 9, 2), "category": "Utilities", "type": "expense"},
    ]
    ctx = ai_service.build_context(txs, [{"name": "Utilities", "limit": 1200}], "USD", TODAY)
    assert ai_service.rules_reply("can I afford 200?", ctx).startswith("Yes")
    assert ai_service.rules_reply("can I afford 5000?", ctx).startswith("I'd hold off")
    assert "Utilities" in ai_service.rules_reply("am I on track with budgets", ctx)


def test_chat_falls_back_to_rules_without_key():
    ctx = ai_service.build_context([], [], "USD", TODAY)
    result = ai_service.chat("hello", [], ctx)
    assert result["source"] == "rules"
    assert result["suggestions"]
