"""One-time email codes for sign-up and sign-in.

Codes are 6 digits, stored only as an HMAC (keyed with JWT_SECRET), expire after OTP_TTL_MINUTES,
and a challenge is burned after OTP_MAX_ATTEMPTS wrong guesses.
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..config import settings
from .email_service import EmailDeliveryError, EmailNotConfigured, send_otp_email


def _hash(challenge_id: str, code: str) -> str:
    return hmac.new(settings.JWT_SECRET.encode(), f"{challenge_id}:{code}".encode(), hashlib.sha256).hexdigest()


def _new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _deliver(challenge: models.EmailOTP, code: str) -> None:
    try:
        send_otp_email(challenge.email, code, challenge.purpose, settings.OTP_TTL_MINUTES)
    except EmailNotConfigured:
        raise HTTPException(status_code=503, detail="Email verification isn't set up on the server yet. Please try again later.")
    except EmailDeliveryError:
        raise HTTPException(status_code=502, detail="We couldn't send the verification email. Please try again.")


def describe(challenge: models.EmailOTP) -> dict:
    now = datetime.utcnow()
    cooldown = (challenge.last_sent_at + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS) - now).total_seconds()
    return {
        "otp_required": True,
        "challenge_id": challenge.id,
        "email": challenge.email,
        "purpose": challenge.purpose,
        "expires_in": max(0, int((challenge.expires_at - now).total_seconds())),
        "resend_in": max(0, int(cooldown)),
        "attempts_left": max(0, settings.OTP_MAX_ATTEMPTS - challenge.attempts),
    }


def start(db: Session, email: str, purpose: str, payload: dict | None = None, user_id: int | None = None) -> models.EmailOTP:
    now = datetime.utcnow()
    # Stop the endpoint being used to flood someone's inbox
    recent = db.query(models.EmailOTP).filter(models.EmailOTP.email == email, models.EmailOTP.created_at > now - timedelta(hours=1)).count()
    if recent >= settings.OTP_MAX_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many verification codes requested. Please wait a while and try again.")

    # Only the newest code for an email + purpose is valid
    db.query(models.EmailOTP).filter(
        models.EmailOTP.email == email, models.EmailOTP.purpose == purpose, models.EmailOTP.consumed_at.is_(None)
    ).update({models.EmailOTP.consumed_at: now}, synchronize_session=False)

    code = _new_code()
    challenge = models.EmailOTP(
        id=secrets.token_urlsafe(24),
        email=email,
        purpose=purpose,
        payload=payload,
        user_id=user_id,
        attempts=0,
        resends=0,
        expires_at=now + timedelta(minutes=settings.OTP_TTL_MINUTES),
        last_sent_at=now,
        created_at=now,
    )
    challenge.code_hash = _hash(challenge.id, code)
    db.add(challenge)
    db.flush()
    _deliver(challenge, code)  # raises before commit, so a failed send leaves no dangling challenge
    db.commit()
    return challenge


def _active(db: Session, challenge_id: str) -> models.EmailOTP:
    challenge = db.query(models.EmailOTP).filter(models.EmailOTP.id == challenge_id).first()
    if challenge is None or challenge.consumed_at is not None:
        raise HTTPException(status_code=400, detail="This code is no longer valid. Please start again.")
    if datetime.utcnow() > challenge.expires_at:
        raise HTTPException(status_code=400, detail="This code has expired. Request a new one.")
    return challenge


def resend(db: Session, challenge_id: str) -> models.EmailOTP:
    challenge = _active(db, challenge_id)
    now = datetime.utcnow()
    wait = (challenge.last_sent_at + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS) - now).total_seconds()
    if wait > 0:
        raise HTTPException(status_code=429, detail=f"Please wait {int(wait) + 1} seconds before requesting another code.")
    if challenge.resends >= settings.OTP_MAX_RESENDS:
        raise HTTPException(status_code=429, detail="Too many resends. Please start again.")

    code = _new_code()
    challenge.code_hash = _hash(challenge.id, code)
    challenge.resends += 1
    challenge.attempts = 0
    challenge.last_sent_at = now
    challenge.expires_at = now + timedelta(minutes=settings.OTP_TTL_MINUTES)
    _deliver(challenge, code)
    db.commit()
    return challenge


def verify(db: Session, challenge_id: str, code: str) -> models.EmailOTP:
    challenge = _active(db, challenge_id)
    if not hmac.compare_digest(challenge.code_hash, _hash(challenge.id, code.strip())):
        challenge.attempts += 1
        left = settings.OTP_MAX_ATTEMPTS - challenge.attempts
        if left <= 0:
            challenge.consumed_at = datetime.utcnow()
            db.commit()
            raise HTTPException(status_code=400, detail="Too many incorrect attempts. Please start again.")
        db.commit()
        raise HTTPException(status_code=400, detail=f"Incorrect code. {left} attempt{'s' if left != 1 else ''} left.")
    challenge.consumed_at = datetime.utcnow()
    return challenge  # caller commits together with the user/session it creates
