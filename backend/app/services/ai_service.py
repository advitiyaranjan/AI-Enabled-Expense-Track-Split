"""AI features: natural-language transaction entry and a finance assistant grounded in the user's data.

Each feature uses OpenAI when OPENAI_API_KEY is configured and degrades to a deterministic
local implementation otherwise, so the app stays useful without a key.
"""
from __future__ import annotations

import calendar
import json
import re
from datetime import date, datetime, timedelta

from . import analytics
from .categorize import EXPENSE_CATEGORIES, detect_category, looks_like_income
from .openai_service import ai_enabled, chat_json, complete, last_error
from ..config import settings

ALL_CATEGORIES = EXPENSE_CATEGORIES + ["Income"]
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_abbr) if m}


# --------------------------------------------------------------------------- quick add

def _parse_relative_date(text: str, today: date) -> tuple[date, str | None]:
    """Return (date, matched_phrase) for phrases like 'yesterday', 'last friday', '3 days ago', 'on the 5th', 'sep 3'."""
    lowered = text.lower()
    if m := re.search(r"\bday before yesterday\b", lowered):
        return today - timedelta(days=2), m.group(0)
    if m := re.search(r"\byesterday\b", lowered):
        return today - timedelta(days=1), m.group(0)
    if m := re.search(r"\btoday\b|\btonight\b|\bthis morning\b", lowered):
        return today, m.group(0)
    if m := re.search(r"\b(\d{1,2})\s+days?\s+ago\b", lowered):
        return today - timedelta(days=int(m.group(1))), m.group(0)
    if m := re.search(r"\blast week\b", lowered):
        return today - timedelta(days=7), m.group(0)
    if m := re.search(r"\b(?:last|on|this)?\s*(" + "|".join(WEEKDAYS) + r")\b", lowered):
        target = WEEKDAYS.index(m.group(1))
        delta = (today.weekday() - target) % 7 or (7 if "last" in m.group(0) else 0)
        return today - timedelta(days=delta), m.group(0)
    if m := re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", lowered):
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3))), m.group(0)
        except ValueError:
            pass
    month_names = "|".join(MONTHS)
    if m := re.search(rf"\b({month_names})[a-z]*\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?\b|\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({month_names})[a-z]*\b", lowered):
        month = MONTHS[(m.group(1) or m.group(4))[:3]]
        day = int(m.group(2) or m.group(3))
        try:
            candidate = date(today.year, month, day)
            if candidate > today:
                candidate = date(today.year - 1, month, day)
            return candidate, m.group(0)
        except ValueError:
            pass
    if m := re.search(r"\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b", lowered):
        day = int(m.group(1))
        try:
            candidate = today.replace(day=day)
            if candidate > today:
                prev = analytics._shift_month(today, -1)
                candidate = prev.replace(day=min(day, calendar.monthrange(prev.year, prev.month)[1]))
            return candidate, m.group(0)
        except ValueError:
            pass
    return today, None


_AMOUNT = re.compile(r"(?:rs\.?|inr|₹|\$|usd|€|eur|£|gbp)?\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(k|thousand|lakh)?\b\s*(?:rs|rupees|inr|dollars|bucks|usd|eur|euros|pounds)?", re.I)
_FILLER = {"spent", "spend", "paid", "pay", "bought", "buy", "got", "for", "on", "a", "an", "the", "my", "at", "from", "to", "in",
           "rs", "inr", "usd", "dollars", "bucks", "rupees", "euros", "pounds", "and", "with", "of", "i", "some", "just", "was", "received", "earned"}


def _parse_amount(text: str) -> tuple[float | None, str | None]:
    best = None
    for m in _AMOUNT.finditer(text):
        # Skip numbers that are part of a date phrase like "3 days ago" or "5th"
        tail = text[m.end():m.end() + 6].lower()
        if re.match(r"\s*(days?|st|nd|rd|th)\b", tail) or re.match(r"(st|nd|rd|th)\b", text[m.end(1):m.end(1) + 2].lower()):
            continue
        value = float(m.group(1).replace(",", "") + (m.group(2) or ""))
        suffix = (m.group(3) or "").lower()
        if suffix in ("k", "thousand"):
            value *= 1000
        elif suffix == "lakh":
            value *= 100000
        has_currency = bool(re.search(r"rs|inr|₹|\$|usd|€|eur|£|gbp|dollars|bucks|rupees", m.group(0), re.I))
        score = (has_currency, value)
        if best is None or score > best[0]:
            best = (score, value, m.group(0))
    if best is None:
        return None, None
    return best[1], best[2]


def _extract_merchant(text: str, removed: list[str]) -> str:
    m = re.search(r"\b(?:at|from|@)\s+([A-Za-z][\w'&.\-]*(?:\s+(?!yesterday|today|for|on|last|with|and|via|using)[A-Za-z][\w'&.\-]*){0,3})", text, re.I)
    if m:
        return m.group(1).strip(" .,")
    cleaned = text
    for phrase in removed:
        if phrase:
            cleaned = cleaned.replace(phrase, " ")
    words = [w for w in re.findall(r"[A-Za-z][\w'&.\-]*", cleaned) if w.lower() not in _FILLER]
    return " ".join(words[:4])


def heuristic_parse_transaction(text: str, today: date, merchant_history: dict[str, str] | None = None) -> dict:
    amount, amount_phrase = _parse_amount(text)
    tx_date, date_phrase = _parse_relative_date(text, today)
    merchant = _extract_merchant(text, [amount_phrase or "", date_phrase or ""])
    tx_type = "income" if looks_like_income(text) else "expense"

    category = None
    confidence = 0.6
    history = merchant_history or {}
    key = analytics.normalize_merchant(merchant)
    if key and key in history:
        category = history[key]
        confidence = 0.9
    if tx_type == "income":
        category = "Income"
    elif category is None:
        category = detect_category(text) or "Other"
        confidence = 0.75 if category != "Other" else 0.4

    name = merchant.strip().title() if merchant and merchant.islower() else (merchant or "").strip()
    return {
        "name": name or ("Income" if tx_type == "income" else "Expense"),
        "amount": round(amount, 2) if amount else None,
        "type": tx_type,
        "category": category,
        "date": tx_date.isoformat(),
        "confidence": confidence if amount else 0.2,
        "source": "rules",
    }


def parse_transaction(text: str, today: date, merchant_history: dict[str, str] | None = None) -> dict:
    fallback = heuristic_parse_transaction(text, today, merchant_history)
    if not ai_enabled():
        return fallback

    known = ", ".join(f"{k} -> {v}" for k, v in list((merchant_history or {}).items())[:40])
    parsed = chat_json([
        {"role": "system", "content": (
            "You convert a short note about money into one transaction. Return only JSON with keys: "
            "name (merchant or short description, Title Case), amount (positive number), type ('expense' or 'income'), "
            f"category (one of {', '.join(ALL_CATEGORIES)}; use 'Income' for income), date (YYYY-MM-DD), confidence (0-1). "
            f"Today is {today.isoformat()} ({WEEKDAYS[today.weekday()].title()}). Resolve relative dates. "
            "Amounts like '2k' mean 2000. If no amount is present use null. "
            + (f"The user previously categorized these merchants: {known}." if known else "")
        )},
        {"role": "user", "content": text},
    ], max_tokens=200)
    if not parsed:
        return fallback

    try:
        amount = abs(float(parsed.get("amount"))) if parsed.get("amount") not in (None, "") else fallback["amount"]
    except (TypeError, ValueError):
        amount = fallback["amount"]
    tx_type = parsed.get("type") if parsed.get("type") in ("income", "expense") else fallback["type"]
    category = parsed.get("category") if parsed.get("category") in ALL_CATEGORIES else fallback["category"]
    if tx_type == "income":
        category = "Income"
    elif category == "Income":
        category = fallback["category"] if fallback["category"] != "Income" else "Other"
    try:
        tx_date = datetime.strptime(str(parsed.get("date")), "%Y-%m-%d").date()
        if tx_date > today + timedelta(days=1):
            tx_date = date.fromisoformat(fallback["date"])
    except ValueError:
        tx_date = date.fromisoformat(fallback["date"])
    try:
        confidence = max(0.0, min(1.0, float(parsed.get("confidence", 0.85))))
    except (TypeError, ValueError):
        confidence = 0.85
    return {
        "name": str(parsed.get("name") or fallback["name"])[:80],
        "amount": round(amount, 2) if amount else None,
        "type": tx_type,
        "category": category,
        "date": tx_date.isoformat(),
        "confidence": confidence,
        "source": "ai",
    }


# --------------------------------------------------------------------------- assistant

def build_context(txs: list[dict], budgets: list[dict], currency: str, today: date) -> dict:
    """Condense the user's finances into a compact snapshot the assistant can reason over."""
    month_start = today.replace(day=1)
    last_month_start = analytics._shift_month(today, -1)
    days_in_month = calendar.monthrange(today.year, today.month)[1]

    def total(kind: str, start: date, end: date | None = None) -> float:
        return round(sum(abs(t["amount"]) for t in txs if t["type"] == kind and t["date"] >= start and (end is None or t["date"] < end)), 2)

    spent = total("expense", month_start)
    earned = total("income", month_start)
    last_spent = total("expense", last_month_start, month_start)
    last_earned = total("income", last_month_start, month_start)
    month_breakdown = {e["category"]: e["amount"] for e in analytics.category_breakdown(txs, since=month_start)}
    budget_status = []
    for b in budgets:
        used = month_breakdown.get(b["name"], 0.0)
        projected = used / max(today.day, 1) * days_in_month
        budget_status.append({
            "name": b["name"], "limit": b["limit"], "spent": round(used, 2),
            "used_pct": round(used / b["limit"] * 100, 1) if b["limit"] else None,
            "projected_month_end": round(projected, 2),
        })
    monthly = analytics.monthly_totals(txs)
    recurring = [r for r in analytics.detect_recurring(txs, today) if r["active"]]
    return {
        "today": today.isoformat(),
        "currency": currency,
        "day_of_month": today.day,
        "days_in_month": days_in_month,
        "this_month": {"spent": spent, "earned": earned, "net": round(earned - spent, 2),
                        "projected_spend": round(spent / max(today.day, 1) * days_in_month, 2)},
        "last_month": {"spent": last_spent, "earned": last_earned, "net": round(last_earned - last_spent, 2)},
        "monthly_history": monthly[-6:],
        "category_trends": analytics.category_trends(txs, today)[:8],
        "budgets": budget_status,
        "recurring": recurring[:10],
        "recurring_monthly_total": round(sum(r["monthly_cost"] for r in recurring), 2),
        "anomalies": analytics.detect_anomalies(txs, limit=5),
        "forecast": analytics.forecast(monthly, today),
        "top_merchants_90d": analytics.top_merchants(txs, since=analytics._shift_month(today, -2)),
        "recent": [
            {"name": t["name"], "amount": abs(t["amount"]), "type": t["type"], "category": t["category"], "date": t["date"].isoformat()}
            for t in sorted(txs, key=lambda t: t["date"], reverse=True)[:15]
        ],
        "transaction_count": len(txs),
    }


SUGGESTIONS = [
    "How am I doing this month?",
    "Where can I cut back?",
    "Which subscriptions am I paying for?",
    "Can I afford a 200 purchase this week?",
    "Am I on track with my budgets?",
    "What will I spend next month?",
]


def _money(value: float, currency: str) -> str:
    symbol = {"USD": "$", "INR": "₹", "GBP": "£", "EUR": "€", "JPY": "¥", "AUD": "A$", "CAD": "C$", "SGD": "S$"}.get(currency, "")
    return f"{symbol}{value:,.2f}" if symbol else f"{value:,.2f} {currency}"


def rules_reply(message: str, ctx: dict) -> str:
    q = message.lower()
    cur = ctx["currency"]
    m = lambda v: _money(v, cur)  # noqa: E731
    tm, lm = ctx["this_month"], ctx["last_month"]

    if ctx["transaction_count"] == 0:
        return "I don't see any transactions yet. Add a few (or try the quick-add bar, e.g. \"coffee 4.50 at Starbucks\") and I'll start spotting patterns."

    afford = re.search(r"afford\D*(\d[\d,]*(?:\.\d+)?)\s*(k)?", q)
    if afford:
        price = float(afford.group(1).replace(",", "")) * (1000 if afford.group(2) else 1)
        days_left = ctx["days_in_month"] - ctx["day_of_month"] + 1
        base_income = tm["earned"] or lm["earned"]
        upcoming_recurring = sum(r["amount"] for r in ctx["recurring"] if r["next_date"] <= f"{ctx['today'][:8]}{ctx['days_in_month']:02d}")
        free = base_income - tm["projected_spend"] - upcoming_recurring
        if base_income <= 0:
            return f"I can't see any income logged recently, so I can't judge affordability. You've spent {m(tm['spent'])} so far this month."
        if free >= price * 1.5:
            return f"Yes, comfortably. Based on your pace you'll end the month about {m(free)} ahead, so {m(price)} leaves {m(free - price)} of cushion."
        if free >= price:
            return f"Yes, but it's tight. You're projected to end the month {m(free)} ahead; {m(price)} would leave just {m(free - price)} over the next {days_left} days."
        return f"I'd hold off. At your current pace you're projected to finish the month {m(free)} {'ahead' if free >= 0 else 'behind'}, so {m(price)} would push you into the red. Waiting until next month's income would be safer."

    if any(w in q for w in ("subscription", "recurring", "bills", "netflix", "spotify")):
        if not ctx["recurring"]:
            return "I haven't found recurring charges yet. I need at least two payments to the same merchant at a regular interval."
        lines = [f"• {r['name']}: {m(r['amount'])} {r['cadence']} (next ~{r['next_date']})" for r in ctx["recurring"][:6]]
        return f"You have {len(ctx['recurring'])} active recurring charges costing about {m(ctx['recurring_monthly_total'])}/month ({m(ctx['recurring_monthly_total'] * 12)}/year):\n" + "\n".join(lines)

    if "budget" in q:
        if not ctx["budgets"]:
            return "You haven't set any budgets yet. Add a few on the Budget page and I'll track them."
        over = [b for b in ctx["budgets"] if b["limit"] and b["projected_month_end"] > b["limit"]]
        lines = [f"• {b['name']}: {m(b['spent'])} of {m(b['limit'])} ({b['used_pct']:.0f}%)" for b in sorted(ctx["budgets"], key=lambda b: -(b["used_pct"] or 0))[:5]]
        head = (f"At your current pace {len(over)} budget{'s' if len(over) != 1 else ''} will run over: {', '.join(b['name'] for b in over)}."
                if over else "All budgets are on pace to finish the month under their limits.")
        return head + "\n" + "\n".join(lines)

    if any(w in q for w in ("cut", "save", "saving", "reduce", "spend less")):
        rising = [t for t in ctx["category_trends"] if t["category"] != "Income" and t["change_pct"] is not None and t["change_pct"] > 15]
        tips = []
        for t in rising[:3]:
            tips.append(f"• {t['category']} is up {t['change_pct']:.0f}% vs usual ({m(t['this_month'])} vs {m(t['usual'])}). Getting back to normal saves ~{m(t['this_month'] - t['usual'])}.")
        if ctx["recurring_monthly_total"]:
            tips.append(f"• Recurring charges total {m(ctx['recurring_monthly_total'])}/month. Cancelling one you rarely use is the easiest permanent saving.")
        if ctx["top_merchants_90d"]:
            top = ctx["top_merchants_90d"][0]
            tips.append(f"• Your biggest merchant lately is {top['name']} ({m(top['amount'])} over {top['count']} visits).")
        return "Here's where the money is going:\n" + "\n".join(tips) if tips else "Your spending looks steady; nothing is trending up sharply. A fixed monthly transfer to savings right after payday is the next lever."

    if any(w in q for w in ("predict", "forecast", "next month", "future", "end of month", "month end")):
        f = ctx["forecast"][0] if ctx["forecast"] else None
        base = f"This month you're on pace to spend about {m(tm['projected_spend'])} (so far {m(tm['spent'])})."
        return base + (f" Next month I expect roughly {m(f['predicted'])}, likely between {m(f['low'])} and {m(f['high'])}." if f else "")

    if any(w in q for w in ("unusual", "anomal", "weird", "spike", "strange", "suspicious")):
        if not ctx["anomalies"]:
            return "Nothing unusual stands out. Every expense is within the normal range for its category."
        lines = [f"• {a['name'] or 'Expense'} on {a['date']}: {m(a['amount'])} ({a['reason']})" for a in ctx["anomalies"]]
        return "These expenses stand out:\n" + "\n".join(lines)

    for trend in ctx["category_trends"]:
        cat = trend["category"].lower()
        if cat in q or any(part in q for part in cat.replace("&", " ").split() if len(part) > 3):
            change = f", {abs(trend['change_pct']):.0f}% {'more' if trend['change_pct'] > 0 else 'less'} than usual by this point" if trend["change_pct"] is not None else ""
            return f"You've spent {m(trend['this_month'])} on {trend['category']} this month{change}."

    if "income" in q or "earn" in q:
        return f"You've earned {m(tm['earned'])} this month (last month {m(lm['earned'])}). Net so far: {m(tm['net'])}."

    savings_rate = (tm["net"] / tm["earned"] * 100) if tm["earned"] else None
    change = ((tm["projected_spend"] - lm["spent"]) / lm["spent"] * 100) if lm["spent"] else None
    parts = [f"This month: {m(tm['spent'])} spent, {m(tm['earned'])} earned."]
    if change is not None:
        parts.append(f"You're on pace for {m(tm['projected_spend'])}, {abs(change):.0f}% {'above' if change > 0 else 'below'} last month.")
    if savings_rate is not None:
        parts.append(f"Savings rate so far: {savings_rate:.0f}%.")
    rising = next((t for t in ctx["category_trends"] if (t["change_pct"] or 0) > 20), None)
    if rising:
        parts.append(f"Watch {rising['category']}: it's up {rising['change_pct']:.0f}% vs usual.")
    return " ".join(parts)


SYSTEM_PROMPT = (
    "You are FinanceAI, a friendly personal-finance assistant inside a budgeting app. "
    "Answer using ONLY the JSON snapshot of the user's finances below; never invent transactions or numbers. "
    "Be concise (under 120 words), specific, and use the user's currency ({currency}). "
    "Use short bullet points for lists. If the data can't answer the question, say what's missing. "
    "Give practical, non-judgmental suggestions; you are not a licensed financial advisor, so avoid specific investment picks.\n\n"
    "Snapshot:\n{context}"
)


def chat(message: str, history: list[dict], ctx: dict) -> dict:
    if ai_enabled():
        messages = [{"role": "system", "content": SYSTEM_PROMPT.format(currency=ctx["currency"], context=json.dumps(ctx, default=str))}]
        for turn in history[-10:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": str(turn["content"])[:2000]})
        messages.append({"role": "user", "content": message})
        reply = (complete(messages, tier="smart", effort="low", max_output=700, temperature=0.3) or "").strip()
        if not reply:
            # Sol refused or failed: a lighter OpenAI model still beats the rules engine
            reply = (complete(messages, tier="fast", effort="low", max_output=700, temperature=0.3) or "").strip()
        if reply:
            return {"reply": reply, "source": "ai", "suggestions": SUGGESTIONS}
        # OpenAI is configured but couldn't answer: say why rather than silently switching engines
        reason = {
            "insufficient_quota": "the OpenAI account is out of credits",
            "invalid_api_key": "the OpenAI API key was rejected",
            "rate_limited": "OpenAI is rate-limiting requests right now",
        }.get(last_error() or "", "OpenAI didn't respond in time")
        return {"reply": rules_reply(message, ctx), "source": "rules", "suggestions": SUGGESTIONS,
                "notice": f"AI unavailable ({reason}). This answer came from the built-in rules."}
    return {"reply": rules_reply(message, ctx), "source": "rules", "suggestions": SUGGESTIONS}


# --------------------------------------------------------------------------- split bills

_SELF_WORDS = {"i", "me", "myself", "you", "we", "us"}
_NAME_STOP = {"and", "with", "for", "at", "the", "a", "an", "paid", "split", "equally", "between", "among", "dinner", "lunch",
              "trip", "bill", "total", "each", "by", "on", "to", "from", "of", "in", "rs", "inr", "rupees", "percent", "owes", "pays",
              "yesterday", "today", "tonight", "custom", "equal", "percentage", "was", "is"}


def _match_friend(token: str, friends: list[str]) -> str | None:
    """Resolve 'sarah' or 'Sarah Chen' to a known friend's full name."""
    t = token.strip().lower()
    for friend in friends:
        f = friend.lower()
        if t == f or t == f.split()[0]:
            return friend
    return None


def heuristic_parse_split(text: str, friends: list[str]) -> dict:
    lowered = text.lower()
    people: list[str] = []

    def add_person(raw: str) -> str | None:
        raw = raw.strip(" .,:;")
        if not raw or raw.lower() in _SELF_WORDS or raw.lower() in _NAME_STOP:
            return None
        name = _match_friend(raw, friends) or raw.title()
        if name not in people:
            people.append(name)
        return name

    # Known friends mentioned anywhere (first name or full name)
    for friend in friends:
        first = re.escape(friend.split()[0].lower())
        if re.search(rf"\b({re.escape(friend.lower())}|{first})\b", lowered):
            add_person(friend)

    # "with Sarah, Mike and Emily" / "between A and B"
    for m in re.finditer(r"\b(?:with|between|among)\s+((?:[A-Za-z][a-z]+)(?:\s*(?:,|\band\b|&)\s*[A-Za-z][a-z]+)*)", text):
        for part in re.split(r"\s*(?:,|\band\b|&)\s*", m.group(1)):
            if part and part[0].isupper():
                add_person(part)

    # Per-person shares: "Sarah 500", "Mike: 40%", "Emily owes 300", "me 400".
    # Unknown capitalized words only count as people in list position (after with/,/:/and), so
    # "Barbeque Nation 2400" or "Groceries 1200" aren't mistaken for people.
    shares: dict[str, float] = {}
    percents: dict[str, float] = {}
    assigned_spans = []
    share_re = r"\b([A-Za-z][a-z]*)\s*(?:owes|pays|:|-|=)?\s*(?:rs\.?|₹|\$)?\s*(\d+(?:\.\d+)?)\s*(%|percent)?"
    for m in re.finditer(share_re, text):
        who = m.group(1)
        if who.lower() in _NAME_STOP:
            continue
        before = text[:m.start()].rstrip()
        in_list = bool(re.search(r"(?:[,:;&]|\band|\bwith|\bbetween|\bamong)$", before, re.I))
        if who.lower() in _SELF_WORDS:
            target = "you"
        elif _match_friend(who, friends) or who in people or (who[0].isupper() and in_list):
            target = add_person(who)
        else:
            target = None
        if target is None:
            continue
        (percents if m.group(3) else shares)[target] = float(m.group(2))
        assigned_spans.append(m.span())

    # Payer: "Rahul paid", "paid by Rahul", "I paid"
    payer = "you"
    m = re.search(r"\bpaid by ([A-Za-z]+)|\b([A-Za-z]+) paid\b|\b([A-Za-z]+) (?:covered|picked up|got) the (?:bill|tab|check)", text, re.I)
    if m:
        who = next(g for g in m.groups() if g)
        if who.lower() not in _SELF_WORDS:
            payer = add_person(who) or "you"

    # Total: the first amount not attributed to a person (usually "Dinner 2400 ..."), else the sum of shares
    total = None
    for m in re.finditer(r"(?:rs\.?|₹|\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b(?!\s*(?:%|percent))", text, re.I):
        if any(start <= m.start(1) < end for start, end in assigned_spans):
            continue
        total = float(m.group(1).replace(",", "")) * (1000 if m.group(2) else 1)
        break
    if total is None and shares:
        total = round(sum(shares.values()), 2)

    mode = "percentage" if percents else "custom" if shares else "equal"
    if mode == "custom" and total and "you" not in shares:
        shares["you"] = max(0.0, round(total - sum(shares.values()), 2))
    if mode == "percentage" and "you" not in percents:
        percents["you"] = max(0.0, round(100 - sum(percents.values()), 2))
    participants = [{"name": p, "amount": shares.get(p), "percentage": percents.get(p)} for p in people]

    title_match = re.match(r"\s*(.+?)(?=\s+(?:with|between|among|split|paid)\b|\s*:|\s*(?:rs\.?|₹|\$)?\s*\d|,|$)", text, re.I)
    title = title_match.group(1).strip(" .,-") if title_match else ""
    if not title or title.lower() in _SELF_WORDS or len(title) < 2:
        title = "Shared bill"
    return {
        "title": title[:1].upper() + title[1:80],
        "total": round(total, 2) if total else None,
        "payer": payer,
        "mode": mode,
        "participants": participants,
        "your_amount": shares.get("you") if mode == "custom" else None,
        "your_percentage": percents.get("you") if mode == "percentage" else None,
        "source": "rules",
    }


def parse_split(text: str, friends: list[str]) -> dict:
    fallback = heuristic_parse_split(text, friends)
    if not ai_enabled():
        return fallback
    parsed = chat_json([
        {"role": "system", "content": (
            "Turn a short note about a shared bill into JSON with keys: title (short, Title Case), total (number or null), "
            "payer ('you' if the user paid, otherwise the other person's name), mode ('equal', 'custom' or 'percentage'), "
            "participants (people OTHER than the user: [{name, amount (number|null), percentage (number|null)}]), "
            "your_amount (the user's own share for custom mode, else null), your_percentage (for percentage mode, else null). "
            "'I', 'me' and 'we' refer to the user. Amounts like '2k' mean 2000. "
            f"Known friends (use these exact names when they match a first name): {', '.join(friends[:100]) or 'none'}."
        )},
        {"role": "user", "content": text},
    ], max_tokens=400)
    if not parsed or not isinstance(parsed.get("participants"), list):
        return fallback

    def num(value):
        try:
            return round(float(value), 2) if value not in (None, "") else None
        except (TypeError, ValueError):
            return None

    participants = []
    for p in parsed["participants"][:20]:
        name = str((p or {}).get("name") or "").strip()
        if not name or name.lower() in _SELF_WORDS:
            continue
        participants.append({"name": _match_friend(name, friends) or name[:60], "amount": num(p.get("amount")), "percentage": num(p.get("percentage"))})
    mode = parsed.get("mode") if parsed.get("mode") in ("equal", "custom", "percentage") else fallback["mode"]
    payer = str(parsed.get("payer") or "you")
    payer = "you" if payer.lower() in _SELF_WORDS else (_match_friend(payer, friends) or payer)
    return {
        "title": str(parsed.get("title") or fallback["title"])[:80],
        "total": num(parsed.get("total")) or fallback["total"],
        "payer": payer,
        "mode": mode,
        "participants": participants or fallback["participants"],
        "your_amount": num(parsed.get("your_amount")),
        "your_percentage": num(parsed.get("your_percentage")),
        "source": "ai",
    }
