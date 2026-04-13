from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models
from decimal import Decimal


def test_create_user_and_transaction():
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    user = models.User(name="Tester", email="tester@example.com", password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)

    tx = models.Transaction(user_id=user.id, merchant_name="Cafe", category="Food", amount=Decimal("12.50"), date=None, type="expense")
    db.add(tx)
    db.commit()
    db.refresh(tx)

    assert tx.id is not None
    assert tx.user_id == user.id
