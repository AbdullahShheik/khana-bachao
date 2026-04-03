# backend/app/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import FoodProvider, NGO
from ..schemas import FoodProviderRegister, LoginRequest, TokenResponse
from ..auth import hash_password, verify_password, create_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
def register(body: FoodProviderRegister, db: Session = Depends(get_db)):
    # Check duplicate email or phone
    if body.email and db.query(FoodProvider).filter_by(email=body.email).first():
        raise HTTPException(400, "Email already registered")
    if body.phone and db.query(FoodProvider).filter_by(phone=body.phone).first():
        raise HTTPException(400, "Phone already registered")

    user = FoodProvider(
        name=body.name,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token({"sub": str(user.id), "role": "food_provider"})
    return TokenResponse(access_token=token, role="food_provider", name=user.name)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    if body.role == "food_provider":
        user = db.query(FoodProvider).filter_by(email=body.email).first()
    else:
        user = db.query(NGO).filter_by(email=body.email).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    name = user.name if hasattr(user, "name") else user.ngo_name
    token = create_token({"sub": str(user.id), "role": body.role})
    return TokenResponse(access_token=token, role=body.role, name=name)