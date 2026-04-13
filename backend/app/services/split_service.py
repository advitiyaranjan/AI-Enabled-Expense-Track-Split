from typing import Dict, List


def settle_balances(balances: Dict[int, float]) -> List[Dict]:
    """Given balances {user_id: net_balance}, positive means user should receive money, negative means user owes.
    Returns list of settlements: {from_user_id, to_user_id, amount}
    """
    # Create creditor and debtor lists
    creditors = []
    debtors = []
    for uid, bal in balances.items():
        amt = round(float(bal), 2)
        if amt > 0:
            creditors.append([uid, amt])
        elif amt < 0:
            debtors.append([uid, -amt])  # store positive owed amount

    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)

    settlements = []
    i = 0
    j = 0
    while i < len(debtors) and j < len(creditors):
        debtor_id, debtor_amt = debtors[i]
        creditor_id, creditor_amt = creditors[j]
        pay = min(debtor_amt, creditor_amt)
        settlements.append({"from_user_id": debtor_id, "to_user_id": creditor_id, "amount": round(pay, 2)})
        debtor_amt -= pay
        creditor_amt -= pay
        if debtor_amt == 0:
            i += 1
        else:
            debtors[i][1] = debtor_amt
        if creditor_amt == 0:
            j += 1
        else:
            creditors[j][1] = creditor_amt

    return settlements
