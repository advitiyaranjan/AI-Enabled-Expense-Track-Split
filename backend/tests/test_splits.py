from fastapi.testclient import TestClient

from app.main import app
from app.services import ai_service

client = TestClient(app)


def account(outbox, email, name="Owner"):
    c = client.post("/auth/register", json={"name": name, "email": email, "password": "pw123456"}).json()
    body = client.post("/auth/verify-otp", json={"challenge_id": c["challenge_id"], "code": outbox.last_code(email)}).json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]


def test_every_user_gets_a_unique_8_digit_id(outbox):
    ids = {account(outbox, f"id{i}@example.com")[1]["public_id"] for i in range(5)}
    assert len(ids) == 5
    assert all(10_000_000 <= i <= 99_999_999 for i in ids)


def test_upi_id_validation_and_clearing(outbox):
    h, _ = account(outbox, "upi@example.com")
    assert client.put("/auth/me", json={"upi_id": "not a upi"}, headers=h).status_code == 422
    assert client.put("/auth/me", json={"upi_id": "Advitiya.R@OKAXIS"}, headers=h).json()["upi_id"] == "advitiya.r@okaxis"
    assert client.put("/auth/me", json={"upi_id": ""}, headers=h).json()["upi_id"] is None


def test_lookup_by_public_id(outbox):
    h, _ = account(outbox, "finder@example.com")
    _, friend = account(outbox, "friend@example.com", name="Priya")
    r = client.get(f"/users/lookup/{friend['public_id']}", headers=h).json()
    assert r["name"] == "Priya" and "email" not in r
    assert client.get("/users/lookup/12345678", headers=h).status_code in (200, 404)
    assert client.get(f"/users/lookup/{friend['public_id']}").status_code == 401  # login required


def test_share_link_public_view_and_claim(outbox):
    h, me = account(outbox, "payee@example.com", name="Advitiya")
    body = {"client_id": "bill-1", "title": "Dinner", "total": 2400, "participants": [
        {"key": "sarah", "name": "Sarah", "amount": 800},
        {"key": "mike", "name": "Mike", "amount": 800},
    ]}
    # Needs a UPI ID to collect money
    assert client.post("/splits/share", json=body, headers=h).status_code == 400
    client.put("/auth/me", json={"upi_id": "advitiya@okaxis"}, headers=h)
    shared = client.post("/splits/share", json=body, headers=h).json()
    token = shared["token"]

    public = client.get(f"/splits/public/{token}").json()  # no auth
    assert public["payee"] == {"name": "Advitiya", "upi_id": "advitiya@okaxis", "public_id": me["public_id"]}
    assert [p["amount"] for p in public["participants"]] == [800, 800]
    assert "email" not in str(public)

    claimed = client.post(f"/splits/public/{token}/claim", json={"key": "sarah"}).json()
    assert next(p for p in claimed["participants"] if p["key"] == "sarah")["claimed"] is True
    assert client.post(f"/splits/public/{token}/claim", json={"key": "nobody"}).status_code == 404

    # Re-sharing the same bill keeps the link and the claim; settling clears the claim
    again = client.post("/splits/share", json=body, headers=h).json()
    assert again["token"] == token and next(p for p in again["participants"] if p["key"] == "sarah")["claimed"]
    body["participants"][0]["settled"] = True
    settled = client.post("/splits/share", json=body, headers=h).json()
    sarah = next(p for p in settled["participants"] if p["key"] == "sarah")
    assert sarah["settled"] and not sarah["claimed"]

    mine = client.get("/splits/mine", headers=h).json()
    assert mine[0]["client_id"] == "bill-1"
    assert client.delete(f"/splits/{token}", headers=h).status_code == 200
    assert client.get(f"/splits/public/{token}").status_code == 404


def test_only_owner_can_unshare(outbox):
    owner, _ = account(outbox, "own@example.com")
    other, _ = account(outbox, "other@example.com")
    client.put("/auth/me", json={"upi_id": "own@ybl"}, headers=owner)
    token = client.post("/splits/share", json={"client_id": "b", "title": "T", "total": 10, "participants": [{"key": "a", "name": "A", "amount": 5}]}, headers=owner).json()["token"]
    client.delete(f"/splits/{token}", headers=other)
    assert client.get(f"/splits/public/{token}").status_code == 200


FRIENDS = ["Sarah Chen", "Mike Johnson", "Emily Rodriguez", "David Kim"]


def test_parse_split_equal_with_known_friends():
    r = ai_service.heuristic_parse_split("Dinner at Barbeque Nation 2400 with Sarah and Mike, I paid", FRIENDS)
    assert r["title"] == "Dinner at Barbeque Nation" and r["total"] == 2400 and r["payer"] == "you" and r["mode"] == "equal"
    assert [p["name"] for p in r["participants"]] == ["Sarah Chen", "Mike Johnson"]


def test_parse_split_new_people_and_other_payer():
    r = ai_service.heuristic_parse_split("Goa trip 18000 split between Rahul, Priya and me, Rahul paid", FRIENDS)
    assert r["payer"] == "Rahul" and [p["name"] for p in r["participants"]] == ["Rahul", "Priya"]


def test_parse_split_custom_and_percentage():
    r = ai_service.heuristic_parse_split("Groceries 1200: Sarah 500, Mike 300, me 400", FRIENDS)
    assert r["mode"] == "custom" and r["total"] == 1200 and r["your_amount"] == 400
    assert {p["name"]: p["amount"] for p in r["participants"]} == {"Sarah Chen": 500, "Mike Johnson": 300}
    r = ai_service.heuristic_parse_split("Movie tickets 900 with Emily 40% David 30%", FRIENDS)
    assert r["mode"] == "percentage" and r["your_percentage"] == 30


def test_parse_split_endpoint(outbox):
    h, _ = account(outbox, "splitter@example.com")
    r = client.post("/ai/parse-split", json={"text": "Pizza night 1.5k with Mike and Emily, Mike paid", "friends": FRIENDS}, headers=h).json()
    assert r["total"] == 1500 and r["payer"] == "Mike Johnson" and r["source"] == "rules"
