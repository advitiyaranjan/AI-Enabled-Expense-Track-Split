from app.services.split_service import settle_balances


def test_settle_balances_simple():
    balances = {1: -50.0, 2: 30.0, 3: 20.0}
    settlements = settle_balances(balances)
    # total owed 50, creditors 30 and 20; expect two settlements
    assert any(s["from_user_id"] == 1 and s["to_user_id"] == 2 and abs(s["amount"] - 30.0) < 1e-6 for s in settlements)
    assert any(s["from_user_id"] == 1 and s["to_user_id"] == 3 and abs(s["amount"] - 20.0) < 1e-6 for s in settlements)


def test_settle_balances_exact():
    balances = {10: 100.0, 11: -100.0}
    settlements = settle_balances(balances)
    assert len(settlements) == 1
    assert settlements[0]["from_user_id"] == 11 and settlements[0]["to_user_id"] == 10 and abs(settlements[0]["amount"] - 100.0) < 1e-6
