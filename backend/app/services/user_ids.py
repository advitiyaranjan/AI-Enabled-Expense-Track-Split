import secrets

from sqlalchemy.orm import Session

from .. import models


def new_public_id(db: Session) -> int:
    """Random 8-digit ID (not the sequential primary key, so it doesn't reveal how many users exist)."""
    for _ in range(50):
        candidate = 10_000_000 + secrets.randbelow(90_000_000)
        if not db.query(models.User.id).filter(models.User.public_id == candidate).first():
            return candidate
    raise RuntimeError("Could not allocate a unique user ID")


def backfill_public_ids(db: Session) -> int:
    missing = db.query(models.User).filter(models.User.public_id.is_(None)).all()
    for user in missing:
        user.public_id = new_public_id(db)
        db.flush()
    db.commit()
    return len(missing)
