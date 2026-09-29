from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_password_hash, verify_password, create_access_token, get_current_user
from ..services import otp_service
from ..services.email_service import send_email_changed_notice
import logging

logger = logging.getLogger("financeai.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


def _session(user: models.User) -> dict:
    token = create_access_token({"user_id": user.id, "sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/register", response_model=schemas.OtpChallengeOut)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """Step 1 of sign-up: validate details and email a code. The account is created only after verification."""
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    country = user_in.country or "India"
    payload = {
        "name": user_in.name,
        "password_hash": get_password_hash(user_in.password),
        "phone": user_in.phone,
        "location": user_in.location,
        "country": country,
        "currency": user_in.currency or ("INR" if country == "India" else "USD"),
    }
    challenge = otp_service.start(db, user_in.email, "register", payload=payload)
    return otp_service.describe(challenge)


@router.post("/login", response_model=schemas.OtpChallengeOut)
def login(form: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Step 1 of sign-in: check the password, then email a code. The token is issued after verification."""
    user = db.query(models.User).filter(models.User.email == form.email).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    challenge = otp_service.start(db, user.email, "login", user_id=user.id)
    return otp_service.describe(challenge)


@router.post("/verify-otp", response_model=schemas.AuthResponse)
def verify_otp(body: schemas.VerifyOtpRequest, db: Session = Depends(get_db)):
    challenge = otp_service.verify(db, body.challenge_id, body.code, purposes=("register", "login"))
    if challenge.purpose == "register":
        # Someone may have finished signing up with this email while the code was pending
        if db.query(models.User).filter(models.User.email == challenge.email).first():
            db.commit()
            raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")
        data = challenge.payload or {}
        user = models.User(
            name=data.get("name") or "New User",
            email=challenge.email,
            password_hash=data["password_hash"],
            phone=data.get("phone"),
            location=data.get("location"),
            country=data.get("country") or "India",
            currency=data.get("currency") or "INR",
        )
        db.add(user)
        challenge.payload = None  # drop the stored password hash once it's been used
    else:
        user = db.query(models.User).filter(models.User.id == challenge.user_id).first()
        if user is None:
            db.commit()
            raise HTTPException(status_code=400, detail="Account not found. Please sign up.")
    db.commit()
    db.refresh(user)
    return _session(user)


@router.post("/resend-otp", response_model=schemas.OtpChallengeOut)
def resend_otp(body: schemas.ResendOtpRequest, db: Session = Depends(get_db)):
    return otp_service.describe(otp_service.resend(db, body.challenge_id))


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UserOut)
def update_me(payload: schemas.UserUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if payload.email and payload.email != current_user.email:
        # Email changes must prove ownership of the new address via /auth/change-email
        raise HTTPException(status_code=400, detail="Email changes need verification. Use the Change email option.")
    for field in ("name", "phone", "location", "country", "currency"):
        value = getattr(payload, field)
        if value is not None:
            setattr(current_user, field, value)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-email/start", response_model=schemas.OtpChallengeOut)
def start_email_change(body: schemas.EmailChangeStart, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Re-check the password, then send a code to the NEW address to prove the user owns it."""
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    if body.new_email == current_user.email:
        raise HTTPException(status_code=400, detail="That's already your email address")
    if db.query(models.User).filter(models.User.email == body.new_email).first():
        raise HTTPException(status_code=400, detail="That email is already used by another account")
    challenge = otp_service.start(db, body.new_email, "change_email", user_id=current_user.id)
    return otp_service.describe(challenge)


@router.post("/change-email/verify", response_model=schemas.UserOut)
def verify_email_change(body: schemas.VerifyOtpRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    challenge = otp_service.verify(db, body.challenge_id, body.code, purposes=("change_email",), user_id=current_user.id)
    new_email = challenge.email
    if db.query(models.User).filter(models.User.email == new_email, models.User.id != current_user.id).first():
        db.commit()
        raise HTTPException(status_code=400, detail="That email is already used by another account")
    old_email = current_user.email
    current_user.email = new_email
    db.commit()
    db.refresh(current_user)
    try:
        send_email_changed_notice(old_email, new_email)
    except Exception:
        logger.warning("Could not send email-change notice to %s", old_email)
    return current_user
