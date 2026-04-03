# backend/app/auth.py
import bcrypt
from jose import jwt
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
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(
        minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
    )
    return jwt.encode(
        payload, 
        os.getenv("SECRET_KEY"),
        algorithm=os.getenv("ALGORITHM")
    )