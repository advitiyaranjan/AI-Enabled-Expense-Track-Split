import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from jose import jwk, jwt

from app.main import app
from app.services import google_auth

client = TestClient(app)
CLIENT_ID = "test-client.apps.googleusercontent.com"

_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PRIVATE_PEM = _private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
PUBLIC_JWK = {**jwk.construct(PRIVATE_PEM, "RS256").public_key().to_dict(), "kid": "test-kid", "use": "sig"}


def google_token(email="gina@gmail.com", aud=CLIENT_ID, verified=True, iss="https://accounts.google.com", kid="test-kid"):
    now = int(time.time())
    claims = {"iss": iss, "aud": aud, "sub": "1234567890", "email": email, "email_verified": verified, "name": "Gina Gupta", "iat": now, "exp": now + 600}
    return jwt.encode(claims, PRIVATE_PEM, algorithm="RS256", headers={"kid": kid})


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(google_auth.settings, "GOOGLE_CLIENT_ID", CLIENT_ID)
    monkeypatch.setattr(google_auth, "_google_keys", lambda force=False: [PUBLIC_JWK])


def test_config_hides_google_when_not_configured(monkeypatch):
    monkeypatch.setattr(google_auth.settings, "GOOGLE_CLIENT_ID", "")
    assert client.get("/auth/config").json() == {"google_client_id": None}
    assert client.post("/auth/google", json={"credential": google_token()}).status_code == 404


def test_new_google_user_gets_account_and_id(google):
    assert client.get("/auth/config").json()["google_client_id"] == CLIENT_ID
    r = client.post("/auth/google", json={"credential": google_token("new.gina@gmail.com")})
    assert r.status_code == 200, r.text
    user = r.json()["user"]
    assert user["email"] == "new.gina@gmail.com" and user["name"] == "Gina Gupta" and user["country"] == "India"
    assert 10_000_000 <= user["public_id"] <= 99_999_999
    # Google-only accounts can't be entered with a guessed password
    assert client.post("/auth/login", json={"email": "new.gina@gmail.com", "password": "google$1234567890"}).status_code == 401


def test_existing_email_signs_into_same_account(google, outbox):
    email = "both@gmail.com"
    c = client.post("/auth/register", json={"name": "Both", "email": email, "password": "pw123456"}).json()
    original = client.post("/auth/verify-otp", json={"challenge_id": c["challenge_id"], "code": outbox.last_code(email)}).json()["user"]
    via_google = client.post("/auth/google", json={"credential": google_token(email)}).json()["user"]
    assert via_google["id"] == original["id"] and via_google["name"] == "Both"


@pytest.mark.parametrize("token_kwargs", [
    {"aud": "someone-elses-app.apps.googleusercontent.com"},
    {"verified": False},
    {"iss": "https://evil.example.com"},
    {"kid": "unknown-kid"},
])
def test_rejects_bad_tokens(google, token_kwargs):
    assert client.post("/auth/google", json={"credential": google_token(**token_kwargs)}).status_code == 401


def test_rejects_tampered_token(google):
    token = google_token()
    head, payload, sig = token.split(".")
    assert client.post("/auth/google", json={"credential": f"{head}.{payload}.{sig[:-4]}AAAA"}).status_code == 401
