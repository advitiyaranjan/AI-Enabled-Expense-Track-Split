from app.services.openai_service import parse_receipt_text


def test_parse_receipt_text_no_api_key(monkeypatch):
    # Ensure OPENAI_API_KEY is empty to trigger fallback path
    monkeypatch.setenv("OPENAI_API_KEY", "")
    result = parse_receipt_text("Total: $12.34\nStore: Example Mart\nDate: 2026-04-14")
    assert isinstance(result, dict)
    # Keys should exist even if values are None
    for k in ("amount", "date", "merchant", "category", "items"):
        assert k in result
