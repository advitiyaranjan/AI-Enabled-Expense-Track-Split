import os

import pytest

# Must run before the app is imported: isolate tests from the dev database and any real OpenAI key / mailbox
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["OPENAI_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""
os.environ["SMTP_USER"] = ""
os.environ["SMTP_PASSWORD"] = ""


class Outbox(list):
    def last_code(self, email: str) -> str:
        return next(code for to, code, _ in reversed(self) if to == email)


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    """Capture OTP emails instead of sending them."""
    from app.services import otp_service

    sent = Outbox()
    monkeypatch.setattr(otp_service, "send_otp_email", lambda to, code, purpose, ttl: sent.append((to, code, purpose)))
    return sent
