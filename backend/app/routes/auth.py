from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_password_hash, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.AuthResponse)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        phone=user_in.phone,
        location=user_in.location,
        country=user_in.country or "United States",
        currency=user_in.currency or "USD",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"user_id": user.id, "sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/login", response_model=schemas.AuthResponse)
def login(form: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.email).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"user_id": user.id, "sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UserOut)
def update_me(payload: schemas.UserUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if payload.email and payload.email != current_user.email:
        existing = db.query(models.User).filter(models.User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    for field in ("name", "phone", "location", "country", "currency"):
        value = getattr(payload, field)
        if value is not None:
            setattr(current_user, field, value)
    if payload.email is not None:
        current_user.email = payload.email
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
