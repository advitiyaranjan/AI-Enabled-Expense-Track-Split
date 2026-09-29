from datetime import date, timedelta

from app.services import analytics


def tx(id, name, amount, d, category="Other", type="expense"):
    return {"id": id, "name": name, "amount": -amount if type == "expense" else amount, "date": d, "category": category, "type": type}


TODAY = date(2026, 9, 20)


def test_detect_monthly_subscription_and_next_date():
    txs = [tx(i, "NETFLIX.COM", 15.49, date(2026, m, 3), "Entertainment") for i, m in enumerate(range(5, 10))]
    recurring = analytics.detect_recurring(txs, TODAY)
    assert len(recurring) == 1
    sub = recurring[0]
    assert sub["cadence"] == "monthly"
    assert sub["active"] is True
    assert sub["next_date"].startswith("2026-10")
    assert round(sub["annual_cost"]) == round(15.49 * 12)


def test_frequent_but_irregular_shop_is_not_recurring():
    days = [0, 1, 9, 10, 25, 26, 40]
    txs = [tx(i, "Corner Cafe", 5 + i, TODAY - timedelta(days=d)) for i, d in enumerate(days)]
    assert analytics.detect_recurring(txs, TODAY) == []


def test_anomaly_is_relative_to_category():
    txs = [tx(i, "Grocer", 50 + i, TODAY - timedelta(days=i * 3), "Groceries") for i in range(8)]
    txs += [tx(100 + i, "Rent", 1200, TODAY - timedelta(days=30 * i), "Utilities") for i in range(4)]
    txs.append(tx(999, "Grocer", 400, TODAY, "Groceries"))
    flagged = analytics.detect_anomalies(txs)
    assert 999 in [f["id"] for f in flagged]
    # Rent is large but normal for its own category
    assert not any(f["category"] == "Utilities" for f in flagged)


def test_forecast_follows_trend_and_ignores_partial_month():
    monthly = [{"month": f"2026-0{m}", "total": 1000 + (m - 3) * 100, "income": 0} for m in range(3, 9)]
    monthly.append({"month": "2026-09", "total": 50, "income": 0})  # partial current month
    preds = analytics.forecast(monthly, TODAY)
    assert len(preds) == 3
    assert preds[0]["predicted"] > 1250  # rising trend, not dragged down by the partial month
    assert preds[0]["low"] <= preds[0]["predicted"] <= preds[0]["high"]


def test_category_trends_compare_like_for_like():
    txs = [tx(1, "A", 100, date(2026, 8, 5), "Food & Dining"), tx(2, "A", 500, date(2026, 8, 28), "Food & Dining"),
           tx(3, "A", 200, date(2026, 9, 5), "Food & Dining")]
    trend = analytics.category_trends(txs, TODAY)[0]
    # Only Aug 1-20 counts toward "usual" on Sep 20
    assert trend["usual"] == 100
    assert trend["change_pct"] == 100.0
