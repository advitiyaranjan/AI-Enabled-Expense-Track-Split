import openai
import json
from ..config import settings

openai.api_key = settings.OPENAI_API_KEY


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


def parse_receipt_text(raw_text: str) -> dict:
    if not settings.OPENAI_API_KEY:
        # best-effort heuristic parser
        return {"amount": None, "date": None, "merchant": None, "category": None, "items": []}

    prompt = (
        "Extract amount, date, merchant, category, and item line-items (name + price) from this receipt. "
        "Return only valid JSON. Keys: amount (number), date (YYYY-MM-DD or null), merchant (string|null), category (string|null), items (array of {name, price}).\n\n"
        f"Receipt Text:\n" + raw_text
    )

    try:
        response = openai.ChatCompletion.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=600,
        )
        content = response.choices[0].message.content
        parsed = None
        # First try direct JSON parse
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = _extract_json_from_text(content)
        if parsed is None:
            # Last resort: return an empty structure
            return {"amount": None, "date": None, "merchant": None, "category": None, "items": []}
        return parsed
    except Exception:
        return {"amount": None, "date": None, "merchant": None, "category": None, "items": []}
