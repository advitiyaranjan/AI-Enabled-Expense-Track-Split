"""Model selection and request-shape tests using a fake OpenAI client (no network, no key)."""
import httpx
import pytest
from openai import BadRequestError, NotFoundError, RateLimitError

from app.services import openai_service as svc


def _error(cls, message):
    request = httpx.Request("POST", "https://api.openai.com/v1/x")
    status = {BadRequestError: 400, NotFoundError: 404, RateLimitError: 429}[cls]
    return cls(message, response=httpx.Response(status, request=request), body=None)


class FakeClient:
    def __init__(self, available, reject_params=(), no_credits=False):
        self.no_credits = no_credits
        self.available = set(available)
        self.reject_params = set(reject_params)
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

                class Msg:
                    content = '{"ok": true}'

                class Choice:
                    message = Msg()

                class Resp:
                    choices = [Choice()]

                return Resp()

        class Chat:
            completions = Completions()

        self.models = Models()
        self.chat = Chat()


@pytest.fixture
def fake(monkeypatch):
    def install(available, reject_params=(), no_credits=False):
        client = FakeClient(available, reject_params, no_credits)
        monkeypatch.setattr(svc.settings, "OPENAI_API_KEY", "sk-test")
        monkeypatch.setattr(svc.settings, "OPENAI_MODEL", "gpt-6-astra")
        monkeypatch.setattr(svc, "get_client", lambda: client)
        svc._model_state.update(model=None, checked=False, error=None)
        return client

    yield install
    svc._model_state.update(model=None, checked=False, error=None)


def test_prefers_the_best_model(fake):
    fake({"gpt-6-astra", "gpt-6-luna", "gpt-4o-mini"})
    assert svc.resolve_model() == "gpt-6-astra"


def test_falls_back_when_best_model_is_not_available_to_the_key(fake):
    fake({"gpt-6-luna", "gpt-4o-mini"})
    assert svc.resolve_model() == "gpt-6-luna"


def test_reasoning_model_request_shape(fake):
    client = fake({"gpt-6-astra"})
    assert svc.chat_json([{"role": "user", "content": "hi"}], max_tokens=400) == {"ok": True}
    call = client.calls[-1]
    assert call["model"] == "gpt-6-astra"
    assert call["reasoning_effort"] == "low"
    assert call["max_completion_tokens"] > 400  # room for hidden reasoning
    assert "temperature" not in call and "max_tokens" not in call
    assert call["response_format"] == {"type": "json_object"}


def test_classic_model_request_shape(fake):
    client = fake({"gpt-4o-mini"})
    svc.complete([{"role": "user", "content": "hi"}], max_output=300, temperature=0.3)
    call = client.calls[-1]
    assert call["model"] == "gpt-4o-mini" and call["max_tokens"] == 300 and call["temperature"] == 0.3
    assert "reasoning_effort" not in call


def test_adapts_to_unsupported_parameters(fake):
    client = fake({"gpt-6-astra"}, reject_params={"reasoning_effort", "response_format"})
    assert svc.chat_json([{"role": "user", "content": "hi"}]) == {"ok": True}
    assert "reasoning_effort" not in client.calls[-1] and "response_format" not in client.calls[-1]


def test_status_reports_model(fake):
    fake({"gpt-6.1-sol"})
    assert svc.ai_status() == {"enabled": True, "model": "gpt-6.1-sol", "ready": True, "error": None}


def test_no_credits_marks_ai_not_ready_until_a_request_succeeds(fake):
    client = fake({"gpt-6-astra"}, no_credits=True)
    assert svc.complete([{"role": "user", "content": "hi"}]) is None
    assert svc.ai_status()["ready"] is False and svc.ai_status()["error"] == "insufficient_quota"
    client.no_credits = False  # credits added
    assert svc.complete([{"role": "user", "content": "hi"}]) is not None
    assert svc.ai_status()["ready"] is True
