from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app import models
from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.services import email_service

client = TestClient(app)


def start_register(email, password="pw123456"):
    r = client.post("/auth/register", json={"name": "Otp", "email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def verify(challenge_id, code):
    return client.post("/auth/verify-otp", json={"challenge_id": challenge_id, "code": code})


def wrong(code: str) -> str:
    return f"{(int(code) + 1) % 1_000_000:06d}"


def test_signup_creates_account_only_after_code(outbox):
    challenge = start_register("new@example.com")
    assert challenge["purpose"] == "register" and challenge["expires_in"] > 0
    # No account yet: logging in must fail until the code is verified
    assert client.post("/auth/login", json={"email": "new@example.com", "password": "pw123456"}).status_code == 401

    r = verify(challenge["challenge_id"], outbox.last_code("new@example.com"))
    assert r.status_code == 200 and r.json()["user"]["email"] == "new@example.com"
    # A code can only be used once
    assert verify(challenge["challenge_id"], outbox.last_code("new@example.com")).status_code == 400


def test_login_requires_code_and_rejects_wrong_password(outbox):
    email = "login@example.com"
    c = start_register(email)
    verify(c["challenge_id"], outbox.last_code(email))

    assert client.post("/auth/login", json={"email": email, "password": "wrong-password"}).status_code == 401
    r = client.post("/auth/login", json={"email": email, "password": "pw123456"})
    assert r.status_code == 200 and "access_token" not in r.json()
    token = verify(r.json()["challenge_id"], outbox.last_code(email)).json()["access_token"]
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["email"] == email


def test_wrong_codes_lock_the_challenge(outbox):
    email = "brute@example.com"
    c = start_register(email)
    code = outbox.last_code(email)
    for attempt in range(settings.OTP_MAX_ATTEMPTS - 1):
        r = verify(c["challenge_id"], wrong(code))
        assert r.status_code == 400 and "attempt" in r.json()["detail"]
    assert "Too many" in verify(c["challenge_id"], wrong(code)).json()["detail"]
    # Even the right code is refused once the challenge is burned
    assert verify(c["challenge_id"], code).status_code == 400


def test_expired_code_is_rejected(outbox):
    email = "late@example.com"
    c = start_register(email)
    db = SessionLocal()
    db.query(models.EmailOTP).filter(models.EmailOTP.id == c["challenge_id"]).update({models.EmailOTP.expires_at: datetime.utcnow() - timedelta(seconds=1)})
    db.commit()
    db.close()
    r = verify(c["challenge_id"], outbox.last_code(email))
    assert r.status_code == 400 and "expired" in r.json()["detail"]


def test_resend_has_cooldown_and_replaces_code(outbox):
    email = "resend@example.com"
    c = start_register(email)
    first = outbox.last_code(email)
    assert client.post("/auth/resend-otp", json={"challenge_id": c["challenge_id"]}).status_code == 429

    db = SessionLocal()
    db.query(models.EmailOTP).filter(models.EmailOTP.id == c["challenge_id"]).update({models.EmailOTP.last_sent_at: datetime.utcnow() - timedelta(minutes=1)})
    db.commit()
    db.close()
    assert client.post("/auth/resend-otp", json={"challenge_id": c["challenge_id"]}).status_code == 200
    second = outbox.last_code(email)
    if second != first:
        assert verify(c["challenge_id"], first).status_code == 400
    assert verify(c["challenge_id"], second).status_code == 200


def test_new_request_invalidates_previous_code(outbox):
    email = "twice@example.com"
    first = start_register(email)
    second = start_register(email)
    assert verify(first["challenge_id"], outbox.last_code(email)).status_code == 400
    assert verify(second["challenge_id"], outbox.last_code(email)).status_code == 200


def test_codes_are_stored_hashed(outbox):
    email = "hashed@example.com"
    c = start_register(email)
    db = SessionLocal()
    row = db.query(models.EmailOTP).filter(models.EmailOTP.id == c["challenge_id"]).first()
    db.close()
    assert outbox.last_code(email) not in row.code_hash
    assert "pw123456" not in str(row.payload)


def test_hourly_limit_per_email(outbox):
    email = "flood@example.com"
    for _ in range(settings.OTP_MAX_PER_HOUR):
        start_register(email)
    assert client.post("/auth/register", json={"name": "x", "email": email, "password": "pw123456"}).status_code == 429


def test_production_without_email_config_refuses(monkeypatch):
    monkeypatch.setattr(email_service, "IS_SERVERLESS", True)
    with pytest.raises(email_service.EmailNotConfigured):
        email_service.send_email("a@example.com", "s", "t")
