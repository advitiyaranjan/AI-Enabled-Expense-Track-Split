"""Keyword categorizer shared by receipt parsing and natural-language transaction entry.

Category names match the frontend's fixed category list so budgets line up.
"""
import re

EXPENSE_CATEGORIES = ["Groceries", "Food & Dining", "Transport", "Entertainment", "Shopping", "Healthcare", "Utilities", "Other"]

CATEGORY_KEYWORDS = {
    "Groceries": ["grocery", "groceries", "supermarket", "whole foods", "trader joe", "walmart", "costco", "aldi", "kroger",
                  "bigbasket", "blinkit", "zepto", "dmart", "vegetables", "fruits", "milk", "tesco", "sainsbury"],
    "Food & Dining": ["restaurant", "cafe", "coffee", "starbucks", "pizza", "burger", "mcdonald", "kfc", "domino", "subway",
                      "swiggy", "zomato", "doordash", "ubereats", "uber eats", "lunch", "dinner", "breakfast", "food", "bar", "pub"],
    "Transport": ["uber", "ola", "lyft", "rapido", "fuel", "petrol", "diesel", "gas station", "shell", "taxi", "cab", "metro",
                  "train", "bus", "parking", "toll", "flight", "airline", "irctc"],
    "Utilities": ["electric", "electricity", "water bill", "internet", "wifi", "broadband", "power", "phone bill", "mobile recharge",
                  "recharge", "jio", "airtel", "verizon", "at&t", "comcast", "rent", "gas bill", "utility"],
    "Entertainment": ["netflix", "spotify", "prime video", "hotstar", "disney", "hbo", "youtube premium", "movie", "cinema",
                      "theatre", "theater", "concert", "pvr", "steam", "playstation", "xbox", "game"],
    "Shopping": ["amazon", "flipkart", "myntra", "target", "ikea", "mall", "store", "clothes", "shoes", "zara", "h&m", "nike",
                 "electronics", "apple store", "best buy"],
    "Healthcare": ["pharmacy", "clinic", "hospital", "doctor", "dentist", "medic", "medicine", "health", "apollo", "cvs",
                   "walgreens", "gym", "fitness", "insurance"],
}

INCOME_KEYWORDS = ["salary", "payroll", "paycheck", "income", "freelance", "bonus", "refund", "cashback", "dividend",
                   "interest", "received", "got paid", "reimburse", "stipend", "invoice paid"]


def _contains(text: str, keyword: str) -> bool:
    # Word-boundary match so "bar" doesn't match "barber" and "ola" doesn't match "cola"
    return re.search(rf"(?<![a-z]){re.escape(keyword)}(?![a-z])", text) is not None


def detect_category(text: str) -> str | None:
    lowered = (text or "").lower()
    if not lowered.strip():
        return None
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(_contains(lowered, keyword) for keyword in keywords):
            return category
    return "Other"


def looks_like_income(text: str) -> bool:
    lowered = (text or "").lower()
    return any(_contains(lowered, keyword) for keyword in INCOME_KEYWORDS)
