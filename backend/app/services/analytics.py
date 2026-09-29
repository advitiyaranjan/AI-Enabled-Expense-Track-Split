"""Pure spending analytics shared by the insights endpoint and the AI assistant.

Every function takes plain transaction dicts ({name, category, amount, date, type}) so it is
easy to test without a database.
"""
from __future__ import annotations

import calendar
import re
import statistics
from collections import defaultdict
from datetime import date, timedelta
from typing import Iterable


def _month_key(d: date) -> str:
    return d.strftime("%Y-%m")


def _shift_month(d: date, offset: int) -> date:
    month_index = d.year * 12 + (d.month - 1) + offset
    return date(month_index // 12, month_index % 12 + 1, 1)


def _expenses(txs: Iterable[dict]) -> list[dict]:
    return [t for t in txs if t["type"] == "expense"]


def normalize_merchant(name: str | None) -> str:
    """Collapse 'NETFLIX.COM 8472', 'Netflix' and 'netflix inc' into one key."""
    if not name:
        return ""
    cleaned = re.sub(r"[^a-z ]+", " ", name.lower())
    cleaned = re.sub(r"\b(inc|llc|ltd|com|www|pvt|co|the)\b", " ", cleaned)
    return " ".join(cleaned.split())


def monthly_totals(txs: list[dict], months: int = 12) -> list[dict]:
    expense = defaultdict(float)
    income = defaultdict(float)
    for t in txs:
        key = _month_key(t["date"])
        if t["type"] == "expense":
            expense[key] += abs(t["amount"])
        else:
            income[key] += abs(t["amount"])
    keys = sorted(set(expense) | set(income))[-months:]
    return [{"month": k, "total": round(expense[k], 2), "income": round(income[k], 2)} for k in keys]


def forecast(monthly: list[dict], today: date, horizon: int = 3) -> list[dict]:
    """Forecast monthly expense with a least-squares trend over complete months, damped toward the mean.

    The current (incomplete) month is excluded from the fit so a half-finished month doesn't
    drag the trend down.
    """
    current = _month_key(today)
    history = [m["total"] for m in monthly if m["month"] < current][-6:]
    if not history:
        # Only the current month exists: extrapolate its run-rate
        running = next((m["total"] for m in monthly if m["month"] == current), 0.0)
        days_in_month = calendar.monthrange(today.year, today.month)[1]
        base = running / max(today.day, 1) * days_in_month
        return [{"month_offset": i, "predicted": round(base, 2), "low": round(base * 0.8, 2), "high": round(base * 1.2, 2)} for i in range(1, horizon + 1)]

    mean = statistics.mean(history)
    n = len(history)
    if n >= 3:
        xs = list(range(n))
        x_mean = statistics.mean(xs)
        slope = sum((x - x_mean) * (y - mean) for x, y in zip(xs, history)) / sum((x - x_mean) ** 2 for x in xs)
        intercept = mean - slope * x_mean
        spread = statistics.pstdev(history)
    else:
        slope, intercept, spread = 0.0, mean, mean * 0.15

    predictions = []
    for i in range(1, horizon + 1):
        trend_value = intercept + slope * (n - 1 + i)
        # Damp the trend 50/50 with the mean: short personal-finance series are noisy
        value = max(0.0, 0.5 * trend_value + 0.5 * mean)
        band = spread * (1 + 0.25 * (i - 1))
        predictions.append({
            "month_offset": i,
            "predicted": round(value, 2),
            "low": round(max(0.0, value - band), 2),
            "high": round(value + band, 2),
        })
    return predictions


def category_breakdown(txs: list[dict], since: date | None = None) -> list[dict]:
    totals = defaultdict(float)
    for t in _expenses(txs):
        if since is None or t["date"] >= since:
            totals[t["category"] or "Other"] += abs(t["amount"])
    return sorted(({"category": k, "amount": round(v, 2)} for k, v in totals.items()), key=lambda e: -e["amount"])


def category_trends(txs: list[dict], today: date) -> list[dict]:
    """Compare month-to-date spend per category with the same point in the previous 3 months."""
    this_month_start = today.replace(day=1)
    day_cutoff = today.day
    current = defaultdict(float)
    previous = defaultdict(float)
    months_seen = set()
    window_start = _shift_month(today, -3)
    for t in _expenses(txs):
        d = t["date"]
        cat = t["category"] or "Other"
        if d >= this_month_start:
            current[cat] += abs(t["amount"])
        elif window_start <= d < this_month_start:
            months_seen.add(_month_key(d))
            # Only count the same slice of the month so comparisons are like-for-like
            if d.day <= day_cutoff:
                previous[cat] += abs(t["amount"])
    divisor = max(len(months_seen), 1)
    trends = []
    for cat in set(current) | set(previous):
        baseline = previous[cat] / divisor
        now = current[cat]
        change = ((now - baseline) / baseline * 100) if baseline > 0 else None
        trends.append({"category": cat, "this_month": round(now, 2), "usual": round(baseline, 2), "change_pct": round(change, 1) if change is not None else None})
    return sorted(trends, key=lambda e: -abs(e["this_month"] - e["usual"]))


def detect_anomalies(txs: list[dict], limit: int = 8) -> list[dict]:
    """Flag expenses that are unusual *for their own category* using a robust z-score (median/MAD).

    Categories with too little history fall back to the user's overall spending distribution.
    """
    expenses = _expenses(txs)
    if len(expenses) < 4:
        return []
    by_category = defaultdict(list)
    for t in expenses:
        by_category[t["category"] or "Other"].append(abs(t["amount"]))
    all_amounts = [abs(t["amount"]) for t in expenses]

    def robust_stats(values: list[float]) -> tuple[float, float]:
        med = statistics.median(values)
        mad = statistics.median([abs(v - med) for v in values]) or (statistics.pstdev(values) / 1.4826 if len(values) > 1 else 0)
        return med, mad * 1.4826

    global_med, global_scale = robust_stats(all_amounts)
    flagged = []
    for t in expenses:
        amount = abs(t["amount"])
        values = by_category[t["category"] or "Other"]
        if len(values) >= 4:
            med, scale = robust_stats(values)
            scope = t["category"] or "Other"
        else:
            med, scale = global_med, global_scale
            scope = "your spending"
        if scale <= 0 or amount <= med:
            continue
        score = (amount - med) / scale
        if score >= 3.5 and amount >= med * 1.8:
            flagged.append({
                "id": t["id"],
                "name": t["name"],
                "amount": round(amount, 2),
                "date": t["date"].isoformat(),
                "category": t["category"],
                "typical": round(med, 2),
                "score": round(score, 1),
                "reason": f"{amount / med:.1f}x your typical {scope} expense",
            })
    flagged.sort(key=lambda e: -e["score"])
    return flagged[:limit]


def detect_recurring(txs: list[dict], today: date) -> list[dict]:
    """Find merchants charged at a steady cadence with a stable amount (subscriptions, rent, bills)."""
    groups = defaultdict(list)
    for t in _expenses(txs):
        key = normalize_merchant(t["name"])
        if key:
            groups[key].append(t)

    cadences = (("weekly", 7, 2), ("monthly", 30.4, 4), ("quarterly", 91, 8), ("yearly", 365, 20))
    results = []
    for key, items in groups.items():
        if len(items) < 2:
            continue
        items.sort(key=lambda t: t["date"])
        dates = [t["date"] for t in items]
        gaps = [(b - a).days for a, b in zip(dates, dates[1:]) if (b - a).days > 0]
        if not gaps:
            continue
        median_gap = statistics.median(gaps)
        match = next((c for c in cadences if abs(median_gap - c[1]) <= c[2] + c[1] * 0.1), None)
        if not match:
            continue
        # Most gaps must agree with the cadence, otherwise it's just a frequently-visited shop
        consistent = sum(1 for g in gaps if abs(g - match[1]) <= match[2] + match[1] * 0.15)
        if consistent / len(gaps) < 0.6:
            continue
        amounts = [abs(t["amount"]) for t in items]
        avg_amount = statistics.mean(amounts)
        if avg_amount == 0 or (max(amounts) - min(amounts)) / avg_amount > 0.35:
            continue
        last = items[-1]
        next_date = dates[-1] + timedelta(days=round(match[1]))
        monthly_cost = avg_amount * (30.4 / match[1])
        latest_amount = abs(last["amount"])
        results.append({
            "name": last["name"],
            "category": last["category"],
            "cadence": match[0],
            "amount": round(latest_amount, 2),
            "average": round(avg_amount, 2),
            "monthly_cost": round(monthly_cost, 2),
            "annual_cost": round(monthly_cost * 12, 2),
            "occurrences": len(items),
            "last_date": dates[-1].isoformat(),
            "next_date": next_date.isoformat(),
            "active": (today - dates[-1]).days <= match[1] * 1.6,
            "price_change": round(latest_amount - abs(items[-2]["amount"]), 2),
        })
    return sorted(results, key=lambda r: -r["monthly_cost"])


def top_merchants(txs: list[dict], since: date | None = None, limit: int = 5) -> list[dict]:
    totals = defaultdict(lambda: {"amount": 0.0, "count": 0, "name": ""})
    for t in _expenses(txs):
        if since and t["date"] < since:
            continue
        key = normalize_merchant(t["name"]) or "unknown"
        entry = totals[key]
        entry["amount"] += abs(t["amount"])
        entry["count"] += 1
        entry["name"] = t["name"] or "Unknown"
    ranked = sorted(totals.values(), key=lambda e: -e["amount"])[:limit]
    return [{"name": e["name"], "amount": round(e["amount"], 2), "count": e["count"]} for e in ranked]


def build_insights(txs: list[dict], today: date | None = None) -> dict:
    today = today or date.today()
    monthly = monthly_totals(txs)
    return {
        "monthly_totals": monthly,
        "category_breakdown": category_breakdown(txs),
        "category_breakdown_month": category_breakdown(txs, since=today.replace(day=1)),
        "category_trends": category_trends(txs, today),
        "predictions": forecast(monthly, today),
        "unusual_spending": detect_anomalies(txs),
        "recurring": detect_recurring(txs, today),
        "top_merchants": top_merchants(txs, since=_shift_month(today, -2)),
    }
