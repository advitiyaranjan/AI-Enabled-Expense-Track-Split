import base64
import json
import logging
import re
from datetime import datetime
from ..config import settings
from .categorize import EXPENSE_CATEGORIES, detect_category

try:
    from openai import AuthenticationError, BadRequestError, NotFoundError, OpenAI, PermissionDeniedError, RateLimitError
except Exception:
    OpenAI = None

logger = logging.getLogger("financeai.ai")

EMPTY_RECEIPT = {"amount": None, "date": None, "merchant": None, "category": None, "items": []}

# Two tiers, GPT-4 family only (sufficient for these tasks and inexpensive). Env overrides: OPENAI_MODEL_FAST / OPENAI_MODEL (comma-separated, best first).
#   fast  -> extraction: quick add, split fill, receipts (text + photos)
#   smart -> the finance assistant chat, which reasons over the user's whole snapshot
TIER_DEFAULTS = {
    "fast": ["gpt-4.1-mini", "gpt-4o-mini"],
    "smart": ["gpt-4.1", "gpt-4o", "gpt-4.1-mini", "gpt-4o-mini"],
}
REASONING_PREFIXES = ("gpt-5", "gpt-6", "o1", "o3", "o4")
# Only some models accept reasoning_effort "none"; others get their lowest supported level
NONE_EFFORT_MODELS = ("gpt-6-luna",)
# Reasoning tokens count against max_completion_tokens, so leave room beyond the visible answer
REASONING_HEADROOM = {"none": 500, "low": 3000, "medium": 8000, "high": 16000}

_model_state: dict = {tier: {"model": None, "checked": False} for tier in TIER_DEFAULTS}
_account: dict = {"error": None}  # account-wide problems (bad key, no credits) shared by both tiers


def ai_enabled() -> bool:
    return bool(settings.OPENAI_API_KEY) and OpenAI is not None


def get_client():
    if not ai_enabled():
        return None
    return OpenAI(api_key=settings.OPENAI_API_KEY, timeout=90, max_retries=2)


def model_chain(tier: str = "fast") -> list[str]:
    configured_value = settings.OPENAI_MODEL_FAST if tier == "fast" else settings.OPENAI_MODEL
    configured = [m.strip() for m in configured_value.split(",") if m.strip()]
    return configured + [m for m in TIER_DEFAULTS[tier] if m not in configured]


def is_reasoning_model(model: str) -> bool:
    return model.startswith(REASONING_PREFIXES)


def resolve_model(tier: str = "fast") -> str | None:
    """Pick the first model in the tier's chain that this API key can use (cached per server instance)."""
    state = _model_state[tier]
    if state["checked"]:
        return state["model"]
    client = get_client()
    if client is None:
        return None
    for model in model_chain(tier):
        try:
            client.models.retrieve(model)
            state.update(model=model, checked=True)
            logger.info("Using OpenAI model %s for %s tasks", model, tier)
            return model
        except (NotFoundError, PermissionDeniedError):
            continue
        except AuthenticationError:
            _account["error"] = "invalid_api_key"
            state.update(model=None, checked=True)
            logger.error("OpenAI rejected the API key")
            return None
        except Exception as exc:  # network hiccup: don't cache, try again on the next request
            logger.warning("Could not reach OpenAI to check model %s: %s", model, exc)
            return None
    state.update(model=None, checked=True)
    return None


def last_error() -> str | None:
    return _account["error"]


def ai_status() -> dict:
    if not ai_enabled():
        return {"enabled": False, "model": None, "models": {}, "ready": False, "error": "no_api_key"}
    models = {tier: resolve_model(tier) for tier in TIER_DEFAULTS}
    # A key with no credits resolves models fine but every request is refused
    ready = any(models.values()) and _account["error"] not in ("insufficient_quota", "invalid_api_key")
    return {"enabled": True, "model": models["smart"] or models["fast"], "models": models, "ready": ready, "error": _account["error"]}


def complete(messages: list[dict], *, tier: str = "fast", effort: str = "low", max_output: int = 800, json_mode: bool = False, temperature: float = 0) -> str | None:
    """One chat completion that works across model generations. Returns None if AI is unavailable or fails."""
    client = get_client()
    model = resolve_model(tier) if client else None
    if client is None or model is None:
        return None
    kwargs: dict = {"model": model, "messages": messages}
    if is_reasoning_model(model):
        if effort == "none" and not model.startswith(NONE_EFFORT_MODELS):
            effort = "low"
        # Reasoning models reject temperature and cap output (including hidden reasoning) with max_completion_tokens
        kwargs["reasoning_effort"] = effort
        kwargs["max_completion_tokens"] = max_output + REASONING_HEADROOM.get(effort, 3000)
    else:
        kwargs["temperature"] = temperature
        kwargs["max_tokens"] = max_output
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    for _ in range(5):
        try:
            response = client.chat.completions.create(**kwargs)
            _account["error"] = None  # e.g. credits were topped up
            choice = response.choices[0]
            content = choice.message.content or ""
            if not content and getattr(choice, "finish_reason", None) == "length" and "max_completion_tokens" in kwargs:
                # Reasoning used up the budget before any answer: retry once with more room
                kwargs["max_completion_tokens"] *= 2
                continue
            return content
        except BadRequestError as exc:
            # Adapt to parameters a particular model doesn't support, then retry
            message = str(exc)
            if "reasoning_effort" in message and kwargs.get("reasoning_effort") == "none":
                kwargs["reasoning_effort"] = "low"
            elif "reasoning_effort" in message and "reasoning_effort" in kwargs:
                kwargs.pop("reasoning_effort")
            elif "temperature" in message and "temperature" in kwargs:
                kwargs.pop("temperature")
            elif "max_tokens" in message and "max_tokens" in kwargs:
                kwargs["max_completion_tokens"] = kwargs.pop("max_tokens")
            elif "max_completion_tokens" in message and "max_completion_tokens" in kwargs:
                kwargs["max_tokens"] = kwargs.pop("max_completion_tokens")
            elif "response_format" in message and "response_format" in kwargs:
                kwargs.pop("response_format")
            else:
                logger.warning("OpenAI request failed for %s: %s", model, message[:300])
                return None
        except RateLimitError as exc:
            if "insufficient_quota" in str(exc) or "credit" in str(exc):
                _account["error"] = "insufficient_quota"
                logger.error("OpenAI refused %s for lack of credits: %s", model, str(exc)[:300])
            else:
                _account["error"] = "rate_limited"
                logger.warning("OpenAI rate limit for %s: %s", model, exc)
            return None
        except (NotFoundError, PermissionDeniedError) as exc:
            # Access to the model changed since we resolved it: re-resolve on the next request
            logger.warning("Model %s became unavailable: %s", model, exc)
            _model_state[tier].update(model=None, checked=False)
            return None
        except Exception as exc:
            _account["error"] = "unreachable"
            logger.warning("OpenAI request failed for %s: %s", model, exc)
            return None
    return None


def chat_json(messages: list[dict], max_tokens: int = 800, effort: str = "none", tier: str = "fast") -> dict | None:
    """Run a completion that must return a JSON object. Returns None on any failure."""
    content = complete(messages, tier=tier, effort=effort, max_output=max_tokens, json_mode=True)
    if not content:
        return None
    try:
        return json.loads(content)
    except Exception:
        return _extract_json_from_text(content)


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
    ], max_tokens=1500, effort="low")
    if parsed is None:
        return None
    result = normalize_receipt(parsed)
    result["raw_text"] = str(parsed.get("raw_text") or "")[:8000]
    return result
