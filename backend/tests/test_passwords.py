from fastapi.testclient import TestClient

from app.main import app
from app.routes import auth as auth_routes

client = TestClient(app)


def account(outbox, email, password="pw123456"):
    c = client.post("/auth/register", json={"name": "Pw", "email": email, "password": password}).json()
    body = client.post("/auth/verify-otp", json={"challenge_id": c["challenge_id"], "code": outbox.last_code(email)}).json()
    return {"Authorization": f"Bearer {body['access_token']}"}


def can_login(email, password):
    return client.post("/auth/login", json={"email": email, "password": password}).status_code == 200


def test_forgot_password_resets_and_signs_in(outbox, monkeypatch):
    notices = []
    monkeypatch.setattr(auth_routes, "send_password_changed_notice", notices.append)
    email = "forgot@example.com"
    account(outbox, email)
    c = client.post("/auth/forgot-password/start", json={"email": "Forgot@Example.com"}).json()
    assert c["purpose"] == "reset_password" and outbox[-1][2] == "reset_password"
    r = client.post("/auth/forgot-password/verify", json={"challenge_id": c["challenge_id"], "code": outbox.last_code(email), "new_password": "brand-new-pass"})
    assert r.status_code == 200 and r.json()["access_token"]
    assert can_login(email, "brand-new-pass") and not can_login(email, "pw123456")
    assert notices == [email]


def test_forgot_password_does_not_reveal_unknown_emails(outbox):
    sent_before = len(outbox)
    r = client.post("/auth/forgot-password/start", json={"email": "nobody-here@example.com"})
    assert r.status_code == 200 and r.json()["otp_required"] and len(outbox) == sent_before
    fake = client.post("/auth/forgot-password/verify", json={"challenge_id": r.json()["challenge_id"], "code": "123456", "new_password": "whatever1"})
    assert fake.status_code == 400


def test_reset_rejects_wrong_code_and_short_password(outbox):
    email = "strict@example.com"
    account(outbox, email)
    c = client.post("/auth/forgot-password/start", json={"email": email}).json()
    code = outbox.last_code(email)
    assert client.post("/auth/forgot-password/verify", json={"challenge_id": c["challenge_id"], "code": code, "new_password": "short"}).status_code == 422
    wrong = f"{(int(code) + 1) % 1_000_000:06d}"
    assert client.post("/auth/forgot-password/verify", json={"challenge_id": c["challenge_id"], "code": wrong, "new_password": "longenough"}).status_code == 400
    assert can_login(email, "pw123456")


def test_change_password_needs_code_sent_to_account(outbox, monkeypatch):
    monkeypatch.setattr(auth_routes, "send_password_changed_notice", lambda email: None)
    email = "changer@example.com"
    h = account(outbox, email)
    assert client.post("/auth/change-password/start").status_code == 401  # must be signed in
    c = client.post("/auth/change-password/start", headers=h).json()
    assert c["email"] == email and outbox[-1] == (email, outbox.last_code(email), "change_password")
    r = client.post("/auth/change-password/verify", headers=h, json={"challenge_id": c["challenge_id"], "code": outbox.last_code(email), "new_password": "changed-pass-1"})
    assert r.status_code == 200
    assert can_login(email, "changed-pass-1")


def test_codes_are_not_interchangeable(outbox):
    email = "mixup@example.com"
    h = account(outbox, email)
    login = client.post("/auth/login", json={"email": email, "password": "pw123456"}).json()
    code = outbox.last_code(email)
    # A sign-in code can't change or reset the password
    assert client.post("/auth/change-password/verify", headers=h, json={"challenge_id": login["challenge_id"], "code": code, "new_password": "hijacked1"}).status_code == 400
    assert client.post("/auth/forgot-password/verify", json={"challenge_id": login["challenge_id"], "code": code, "new_password": "hijacked1"}).status_code == 400
    assert can_login(email, "pw123456")
