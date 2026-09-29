"""Model routing and request-shape tests using a fake OpenAI client (no network, no key)."""
from datetime import date

import httpx
import pytest
from openai import BadRequestError, NotFoundError, RateLimitError

from app.services import ai_service
from app.services import openai_service as svc

EVERYTHING = {"gpt-6-astra", "gpt-6.1-sol", "gpt-6-luna", "gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"}


def _error(cls, message):
    request = httpx.Request("POST", "https://api.openai.com/v1/x")
    status = {BadRequestError: 400, NotFoundError: 404, RateLimitError: 429}[cls]
    return cls(message, response=httpx.Response(status, request=request), body=None)


class FakeClient:
    def __init__(self, available, reject_params=(), no_credits=False, empty_first=False):
        self.available = set(available)
        self.reject_params = set(reject_params)
        self.no_credits = no_credits
        self.empty_first = empty_first
        self.calls = []
        outer = self

        class Models:
            def retrieve(self, model):
                if model not in outer.available:
                    raise _error(NotFoundError, f"The model {model} does not exist")

        class Completions:
            def create(self, **kwargs):
                outer.calls.append(dict(kwargs))
                if outer.no_credits:
                    raise _error(RateLimitError, "You have no credits remaining. insufficient_quota")
                for param in outer.reject_params:
                    if param in kwargs:
                        raise _error(BadRequestError, f"Unsupported parameter: '{param}' is not supported with this model.")
                truncated = outer.empty_first and len(outer.calls) == 1

                class Msg:
                    content = "" if truncated else '{"ok": true}'

                class Choice:
                    message = Msg()
                    finish_reason = "length" if truncated else "stop"

                class Resp:
                    choices = [Choice()]

                return Resp()

        class Chat:
            completions = Completions()

        self.models = Models()
        self.chat = Chat()


@pytest.fixture
def fake(monkeypatch):
    def install(available, **options):
        gemini_key = options.get("gemini_key", "")
        client = FakeClient(available, **{k: v for k, v in options.items() if k != "gemini_key"})
        monkeypatch.setattr(svc.settings, "OPENAI_API_KEY", "sk-test")
        monkeypatch.setattr(svc.settings, "GEMINI_API_KEY", gemini_key)
        monkeypatch.setattr(svc.settings, "OPENAI_MODEL", "gpt-4.1")
        monkeypatch.setattr(svc.settings, "OPENAI_MODEL_FAST", "gpt-4.1-mini")
        monkeypatch.setattr(svc, "get_client", lambda: client)
        reset()
        return client

    def reset():
        for state in svc._model_state.values():
            state.update(model=None, checked=False)
        svc._account["error"] = None

    yield install
    reset()


def test_uses_gpt4_family_only_never_gpt6(fake):
    fake(EVERYTHING)
    assert svc.resolve_model("fast") == "gpt-4.1-mini"
    assert svc.resolve_model("smart") == "gpt-4.1"


def test_smart_tier_falls_back_within_gpt4_family(fake):
    fake({"gpt-6-astra", "gpt-6.1-sol", "gpt-4o-mini"})
    assert svc.resolve_model("smart") == "gpt-4o-mini"


def test_extraction_request_shape(fake):
    client = fake(EVERYTHING)
    assert svc.chat_json([{"role": "user", "content": "hi"}], max_tokens=400) == {"ok": True}
    call = client.calls[-1]
    assert call["model"] == "gpt-4.1-mini" and call["max_tokens"] == 400 and call["temperature"] == 0
    assert "reasoning_effort" not in call
    assert call["response_format"] == {"type": "json_object"}


def test_reasoning_model_shape_if_configured(fake, monkeypatch):
    client = fake(EVERYTHING)
    monkeypatch.setattr(svc.settings, "OPENAI_MODEL_FAST", "gpt-6-luna")
    svc.chat_json([{"role": "user", "content": "hi"}], max_tokens=400)
    call = client.calls[-1]
    assert call["reasoning_effort"] == "none" and call["max_completion_tokens"] > 400 and "temperature" not in call


def test_none_effort_becomes_low_on_models_without_it(fake, monkeypatch):
    client = fake(EVERYTHING)
    monkeypatch.setattr(svc.settings, "OPENAI_MODEL_FAST", "gpt-6.1-sol")
    svc.chat_json([{"role": "user", "content": "hi"}])
    assert client.calls[-1]["model"] == "gpt-6.1-sol" and client.calls[-1]["reasoning_effort"] == "low"


def test_classic_model_request_shape(fake):
    client = fake({"gpt-4o-mini"})
    svc.complete([{"role": "user", "content": "hi"}], tier="smart", max_output=300, temperature=0.3)
    call = client.calls[-1]
    assert call["model"] == "gpt-4o-mini" and call["max_tokens"] == 300 and call["temperature"] == 0.3
    assert "reasoning_effort" not in call


def test_adapts_to_unsupported_parameters(fake):
    client = fake(EVERYTHING, reject_params={"reasoning_effort", "response_format"})
    assert svc.chat_json([{"role": "user", "content": "hi"}]) == {"ok": True}
    assert "reasoning_effort" not in client.calls[-1] and "response_format" not in client.calls[-1]


def test_retries_when_reasoning_exhausts_the_budget(fake, monkeypatch):
    client = fake(EVERYTHING, empty_first=True)
    monkeypatch.setattr(svc.settings, "OPENAI_MODEL_FAST", "gpt-6-luna")
    assert svc.chat_json([{"role": "user", "content": "hi"}]) == {"ok": True}
    assert client.calls[1]["max_completion_tokens"] == client.calls[0]["max_completion_tokens"] * 2


def test_status_reports_both_models(fake):
    fake(EVERYTHING)
    status = svc.ai_status()
    assert status["ready"] and status["models"] == {"fast": "gpt-4.1-mini", "smart": "gpt-4.1"}


def test_no_credits_marks_ai_not_ready_until_a_request_succeeds(fake):
    client = fake(EVERYTHING, no_credits=True)
    assert svc.complete([{"role": "user", "content": "hi"}]) is None
    assert svc.ai_status()["ready"] is False and svc.ai_status()["error"] == "insufficient_quota"
    client.no_credits = False  # credits added
    assert svc.complete([{"role": "user", "content": "hi"}]) is not None
    assert svc.ai_status()["ready"] is True


def test_chat_uses_openai_when_available_and_explains_fallback_otherwise(fake):
    client = fake(EVERYTHING)
    ctx = ai_service.build_context([], [], "INR", date(2026, 9, 30))
    reply = ai_service.chat("hello", [], ctx)
    assert reply["source"] == "ai" and client.calls[-1]["model"] == "gpt-4.1"

    client.no_credits = True
    reply = ai_service.chat("hello", [], ctx)
    assert reply["source"] == "rules" and "out of credits" in reply["notice"]


def test_chat_falls_back_to_lighter_openai_model_before_rules(fake):
    client = fake(EVERYTHING)
    original = client.chat.completions.create

    def refuse_sol(**kwargs):
        if kwargs["model"] == "gpt-4.1":
            client.calls.append(dict(kwargs))
            raise _error(RateLimitError, "You have no credits remaining. insufficient_quota")
        return original(**kwargs)

    client.chat.completions.create = refuse_sol
    ctx = ai_service.build_context([], [], "INR", date(2026, 9, 30))
    reply = ai_service.chat("hello", [], ctx)
    assert reply["source"] == "ai" and client.calls[-1]["model"] == "gpt-4.1-mini"


GEMINI_MODELS = {"gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"}


def test_gemini_key_switches_provider_and_endpoint(monkeypatch):
    monkeypatch.setattr(svc.settings, "GEMINI_API_KEY", "gm-test")
    assert svc.provider() == "gemini" and svc.ai_enabled()
    assert "generativelanguage.googleapis.com" in str(svc.get_client().base_url)
    monkeypatch.setattr(svc.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(svc.settings, "OPENAI_API_KEY", "sk-test")
    assert svc.provider() == "openai" and "api.openai.com" in str(svc.get_client().base_url)


def test_gemini_free_models_per_task(fake):
    fake(GEMINI_MODELS | EVERYTHING, gemini_key="gm-test")
    assert svc.resolve_model("fast") == "gemini-3.5-flash-lite"
    assert svc.resolve_model("smart") == "gemini-3.8-flash"
    assert svc.ai_status()["provider"] == "gemini"


def test_gemini3_gets_lowest_reasoning_instead_of_none(fake):
    client = fake(GEMINI_MODELS, gemini_key="gm-test")
    svc.chat_json([{"role": "user", "content": "hi"}])
    call = client.calls[-1]
    assert call["model"] == "gemini-3.5-flash-lite" and call["reasoning_effort"] == "low" and "temperature" not in call


def test_gemini_falls_back_within_free_models(fake):
    fake({"gemini-2.5-flash"}, gemini_key="gm-test")
    assert svc.resolve_model("smart") == "gemini-2.5-flash"
