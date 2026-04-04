# backend/app/auth.py
import bcrypt
from fastapi import HTTPException, status
from jose import JWTError, jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os

load_dotenv()

def hash_password(plain: str) -> str:
    # Encode the password to bytes. 
    # bcrypt has a strict 72-byte limit, so we safely truncate to prevent crashes on extremely long inputs.
    pwd_bytes = plain.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(pwd_bytes, salt)
    # Return as a standard string to store in the database
    return hashed_bytes.decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    pwd_bytes = plain.encode('utf-8')[:72]
    hashed_bytes = hashed.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)

def create_token(data: dict) -> str:
    secret_key = os.getenv("SECRET_KEY")
    algorithm = os.getenv("ALGORITHM")
    if not secret_key or not algorithm:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication configuration is missing.",
        )

    expire_minutes_raw = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    try:
        expire_minutes = int(expire_minutes_raw)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication configuration is invalid: ACCESS_TOKEN_EXPIRE_MINUTES must be an integer.",
        )

    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(
        minutes=expire_minutes
    )
    return jwt.encode(
        payload, 
        secret_key,
        algorithm=algorithm
    )


def decode_token(token: str) -> dict:
    secret_key = os.getenv("SECRET_KEY")
    algorithm = os.getenv("ALGORITHM")

    if not secret_key or not algorithm:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication configuration is missing.",
        )

    try:
        return jwt.decode(token, secret_key, algorithms=[algorithm])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )
