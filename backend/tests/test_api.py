from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def sign_in(outbox, email="api@example.com", password="pw123456"):
    """Register (or log in) through the email-OTP flow and return the auth response body."""
    r = client.post("/auth/register", json={"name": "Api", "email": email, "password": password, "country": "India", "currency": "INR"})
    if r.status_code == 400:
        r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    challenge = r.json()
    assert challenge["otp_required"] and "access_token" not in challenge
    r = client.post("/auth/verify-otp", json={"challenge_id": challenge["challenge_id"], "code": outbox.last_code(email)})
    assert r.status_code == 200, r.text
    return r.json()


def auth_headers(outbox, email="api@example.com"):
    return {"Authorization": f"Bearer {sign_in(outbox, email)['access_token']}"}


def test_transactions_crud_without_redirect(outbox):
    h = auth_headers(outbox)
    body = {"merchant_name": "Cafe", "category": "Food & Dining", "amount": 12.5, "date": "2026-09-10", "type": "expense"}
    r = client.post("/transactions", json=body, headers=h, follow_redirects=False)
    assert r.status_code == 200
    tx_id = r.json()["id"]
    assert r.json()["amount"] == -12.5

    r = client.put(f"/transactions/{tx_id}", json={**body, "merchant_name": "Cafe Latte", "amount": 14}, headers=h)
    assert r.json()["name"] == "Cafe Latte" and r.json()["amount"] == -14

    r = client.get("/transactions", headers=h, follow_redirects=False)
    assert r.status_code == 200 and any(t["id"] == tx_id for t in r.json())

    assert client.post("/transactions", json={**body, "type": "gift"}, headers=h).status_code == 422
    assert client.delete(f"/transactions/{tx_id}", headers=h).status_code == 200


def test_bulk_insights_and_ai_endpoints(outbox):
    h = auth_headers(outbox, "ai@example.com")
    rows = [{"merchant_name": "Netflix", "category": "Entertainment", "amount": 649, "date": f"2026-0{m}-05", "type": "expense"} for m in range(5, 10)]
    rows.append({"merchant_name": "Salary", "category": "Income", "amount": 90000, "date": "2026-09-01", "type": "income"})
    assert client.post("/transactions/bulk", json={"transactions": rows}, headers=h).json()["created"] == 6

    insights = client.get("/insights?today=2026-09-20", headers=h, follow_redirects=False).json()
    assert insights["recurring"][0]["name"] == "Netflix"
    assert len(insights["predictions"]) == 3

    parsed = client.post("/ai/parse-transaction", json={"text": "netflix 649 today", "today": "2026-09-20"}, headers=h).json()
    assert parsed["category"] == "Entertainment"
    assert parsed["amount"] == 649

    reply = client.post("/ai/chat?today=2026-09-20", json={"message": "what subscriptions do I have?", "budgets": [{"name": "Entertainment", "limit": 1000}]}, headers=h).json()
    assert "Netflix" in reply["reply"] and "₹" in reply["reply"]


def test_groups_require_membership(outbox):
    owner = auth_headers(outbox, "owner@example.com")
    outsider = auth_headers(outbox, "outsider@example.com")
    group_id = client.post("/groups", json={"name": "Trip"}, headers=owner).json()["id"]
    assert client.get(f"/groups/{group_id}/balances", headers=outsider).status_code == 404
    assert client.get(f"/groups/{group_id}/balances", headers=owner).status_code == 200


def test_bad_token_is_401_not_500():
    r = client.get("/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert r.status_code == 401


def test_registration_defaults_to_india(outbox):
    email = "default-country@example.com"
    r = client.post("/auth/register", json={"name": "Default", "email": email, "password": "pw123456"})
    r = client.post("/auth/verify-otp", json={"challenge_id": r.json()["challenge_id"], "code": outbox.last_code(email)})
    assert r.json()["user"]["country"] == "India"
    assert r.json()["user"]["currency"] == "INR"
