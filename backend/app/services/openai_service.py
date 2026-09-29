import base64
import json
import re
from datetime import datetime
from ..config import settings
from .categorize import EXPENSE_CATEGORIES, detect_category

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

EMPTY_RECEIPT = {"amount": None, "date": None, "merchant": None, "category": None, "items": []}


def ai_enabled() -> bool:
    return bool(settings.OPENAI_API_KEY) and OpenAI is not None


def get_client():
    if not ai_enabled():
        return None
    return OpenAI(api_key=settings.OPENAI_API_KEY, timeout=30)


def chat_json(messages: list[dict], max_tokens: int = 800) -> dict | None:
    """Run a chat completion that must return a JSON object. Returns None on any failure."""
    client = get_client()
    if client is None:
        return None
    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            temperature=0,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or ""
        try:
            return json.loads(content)
        except Exception:
            return _extract_json_from_text(content)
    except Exception:
        return None


def _extract_json_from_text(text: str):
    # Try to find a JSON object in the model output
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end+1])
        except Exception:
            return None
    return None


def _parse_date(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip()
    formats = ("%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d.%m.%Y", "%d/%m/%y", "%m/%d/%y", "%d %b %Y", "%b %d, %Y")
    for pattern in formats:
        try:
            return datetime.strptime(cleaned, pattern).date().isoformat()
        except ValueError:
            continue
    return None


def _to_number(value) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    match = re.search(r"-?[0-9][0-9,]*(?:\.[0-9]+)?", str(value))
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", ""))
    except ValueError:
        return None


def normalize_receipt(parsed: dict | None) -> dict:
    """Coerce model output into the exact shape the client expects (LLMs return strings, nulls, extra keys)."""
    if not isinstance(parsed, dict):
        return dict(EMPTY_RECEIPT)
    items = []
    for item in parsed.get("items") or []:
        if not isinstance(item, dict):
            continue
        price = _to_number(item.get("price"))
        name = str(item.get("name") or "").strip()
        if name and price is not None:
            items.append({"name": name[:120], "price": round(price, 2)})
    category = parsed.get("category")
    if category not in EXPENSE_CATEGORIES:
        category = detect_category(f"{parsed.get('merchant') or ''} {category or ''}") if (parsed.get("merchant") or category) else None
    amount = _to_number(parsed.get("amount"))
    raw_date = parsed.get("date")
    return {
        "amount": round(abs(amount), 2) if amount is not None else None,
        "date": _parse_date(raw_date) if isinstance(raw_date, str) else None,
        "merchant": (str(parsed.get("merchant")).strip()[:120] or None) if parsed.get("merchant") else None,
        "category": category,
        "items": items[:30],
    }


_MONEY = re.compile(r"(?<![\d/.-])(?:rs\.?|inr|₹|\$|usd|€|£)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?![\d/-])", re.I)
_DECIMAL_MONEY = re.compile(r"(?<![\d/.-])(?:rs\.?|inr|₹|\$|usd|€|£)?\s*([0-9][0-9,]*\.[0-9]{2})(?![\d/-])", re.I)
_TOTAL_LINE = re.compile(r"\b(grand\s+total|total\s+due|amount\s+due|net\s+amount|total|amount\s+paid|balance\s+due)\b", re.I)
_SKIP_TOTAL = re.compile(r"\b(sub\s*-?\s*total|total\s+items|total\s+qty|tax|discount|savings|change|tip)\b", re.I)
_HEADER_WORDS = ("total", "invoice", "receipt", "tax", "subtotal", "gst", "vat", "tel", "phone", "date", "bill no", "cashier", "www", "thank")


def _heuristic_parse_receipt(raw_text: str) -> dict:
    text = raw_text or ""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    amount = None
    date = None
    merchant = None
    items = []

    item_pattern = re.compile(r"^(?P<name>[A-Za-z].*?)\s+(?:x?\d+\s+)?(?:rs\.?|₹|\$|€|£)?\s*(?P<price>[0-9]+(?:[.,][0-9]{2}))$", re.I)

    for line in lines:
        lower_line = line.lower()
        if merchant is None and re.search(r"[A-Za-z]{3,}", line) and not any(word in lower_line for word in _HEADER_WORDS):
            merchant = re.sub(r"^(store|merchant|shop)\s*:\s*", "", line, flags=re.I)

        if date is None:
            direct_date = _parse_date(line)
            if direct_date:
                date = direct_date
            else:
                match = re.search(r"(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})", line)
                if match:
                    date = _parse_date(match.group(1).replace(".", "/"))

        # Last qualifying "total" line wins; subtotal/tax lines are ignored and the last number on the line is the value
        if _TOTAL_LINE.search(line) and not _SKIP_TOTAL.search(line):
            values = _MONEY.findall(line)
            if values:
                amount = float(values[-1].replace(",", ""))

        item_match = item_pattern.match(line)
        if item_match and not _TOTAL_LINE.search(line) and not _SKIP_TOTAL.search(line):
            price = float(item_match.group("price").replace(",", "."))
            items.append({"name": item_match.group("name").strip(" -:"), "price": price})

    if amount is None:
        # Without a total line only trust values with cents, so dates/phone numbers aren't mistaken for totals
        values = [float(v.replace(",", "")) for v in _DECIMAL_MONEY.findall(text)]
        if values:
            amount = max(values)

    category = detect_category("\n".join(lines))
    return {"amount": amount, "date": date, "merchant": merchant, "category": category, "items": items[:20]}


RECEIPT_INSTRUCTIONS = (
    "Extract the purchase from this receipt. Return only a JSON object with keys: "
    "amount (number, the final total actually paid), date (YYYY-MM-DD or null), merchant (string or null), "
    f"category (one of {', '.join(EXPENSE_CATEGORIES)}), items (array of {{name, price}} line items)."
)


def parse_receipt_text(raw_text: str) -> dict:
    if not raw_text.strip():
        return dict(EMPTY_RECEIPT)

    if not ai_enabled():
        return _heuristic_parse_receipt(raw_text)

    parsed = chat_json([
        {"role": "system", "content": RECEIPT_INSTRUCTIONS},
        {"role": "user", "content": f"Receipt text:\n{raw_text[:6000]}"},
    ])
    if parsed is None:
        return _heuristic_parse_receipt(raw_text)
    result = normalize_receipt(parsed)
    if result["amount"] is None:
        # Model missed the total: fall back to the heuristic value rather than returning an empty draft
        result["amount"] = _heuristic_parse_receipt(raw_text)["amount"]
    return result


def parse_receipt_image(image_bytes: bytes, filename: str = "receipt.jpg") -> dict | None:
    """Read a receipt photo directly with a vision-capable model. Returns None when AI is unavailable or fails."""
    if not ai_enabled() or not image_bytes:
        return None
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpeg"
    mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp", "gif": "gif"}.get(extension, "jpeg")
    data_url = f"data:image/{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"
    parsed = chat_json([
        {"role": "system", "content": RECEIPT_INSTRUCTIONS + " Also include raw_text: the receipt text you read, line by line."},
        {"role": "user", "content": [
            {"type": "text", "text": "Here is the receipt photo."},
            {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
        ]},
    ], max_tokens=1500)
    if parsed is None:
        return None
    result = normalize_receipt(parsed)
    result["raw_text"] = str(parsed.get("raw_text") or "")[:8000]
    return result
