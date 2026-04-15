# backend/app/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from ..database import get_db
from ..models import FoodProvider, NGO
from ..schemas import FoodProviderRegister, LoginRequest, TokenResponse
from ..auth import hash_password, verify_password, create_token

router = APIRouter(prefix="/auth", tags=["auth"])

# --- EMAIL CONFIGURATION ---
# IMPORTANT: In a production app, use environment variables (os.getenv) for these!
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "hashirbaig526@gmail.com" # Replace with your Gmail
SENDER_PASSWORD = "vyfi dqxu ihjb axer" # Replace with your 16-character App Password

class VerifyRequest(BaseModel):
    email: str
    code: str

class ResendRequest(BaseModel):
    email: str

def generate_otp():
    """Generates a 6-digit verification code."""
    return ''.join(random.choices(string.digits, k=6))

def send_verification_email_real(receiver_email: str, code: str):
    """Sends a real email using SMTP."""
    message = MIMEMultipart("alternative")
    message["Subject"] = "Verify your Khana Bachao account"
    message["From"] = f"Khana Bachao <{SENDER_EMAIL}>"
    message["To"] = receiver_email

    # Plain text version
    text = f"Welcome to Khana Bachao!\n\nYour verification code is: {code}\n\nPlease enter this code to complete your registration."
    
    # HTML version for better formatting
    html = f"""\
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>Welcome to Khana Bachao! 🍛</h2>
        <p>Thank you for registering. To ensure your account is secure, please verify your email address.</p>
        <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; display: inline-block; margin: 10px 0;">
            <p style="margin: 0; font-size: 16px;">Your verification code is:</p>
            <h1 style="margin: 5px 0 0 0; color: #e65100; letter-spacing: 2px;">{code}</h1>
        </div>
        <p>Enter this code in the application to complete your registration.</p>
        <p><i>If you did not request this, please ignore this email.</i></p>
      </body>
    </html>
    """

    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")
    message.attach(part1)
    message.attach(part2)

    try:
        # Connect to server and send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls() # Secure the connection
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, receiver_email, message.as_string())
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification email. Please try again later.")

@router.post("/register")
def register(body: FoodProviderRegister, db: Session = Depends(get_db)):
    # Check existing email
    existing_user = db.query(FoodProvider).filter_by(email=body.email).first()
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(400, "Email already registered and verified.")
        else:
            # User exists but isn't verified. Update code and resend email.
            code = generate_otp()
            existing_user.verification_code = code
            db.commit()
            send_verification_email_real(existing_user.email, code)
            return {"message": "Verification code resent."}

    if body.phone and db.query(FoodProvider).filter_by(phone=body.phone).first():
        raise HTTPException(400, "Phone already registered")

    # Create new unverified user
    code = generate_otp()
    user = FoodProvider(
        name=body.name,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        is_verified=False,
        verification_code=code
    )
    db.add(user)
    db.commit()
    
    send_verification_email_real(user.email, code)
    
    return {"message": "Registration initiated. Please verify your email."}

@router.post("/verify", response_model=TokenResponse)
def verify_account(body: VerifyRequest, db: Session = Depends(get_db)):
    user = db.query(FoodProvider).filter_by(email=body.email).first()
    
    if not user:
        raise HTTPException(404, "User not found")
    if user.is_verified:
        raise HTTPException(400, "User is already verified")
    if user.verification_code != body.code:
        raise HTTPException(400, "Invalid verification code")
        
    # Mark as verified and clear the code
    user.is_verified = True
    user.verification_code = None
    db.commit()
    
    # Log them in automatically
    token = create_token({"sub": str(user.id), "role": "food_provider"})
    return TokenResponse(access_token=token, role="food_provider", name=user.name)

@router.post("/resend-code")
def resend_code(body: ResendRequest, db: Session = Depends(get_db)):
    user = db.query(FoodProvider).filter_by(email=body.email).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.is_verified:
        raise HTTPException(400, "User is already verified")
        
    new_code = generate_otp()
    user.verification_code = new_code
    db.commit()
    
    send_verification_email_real(user.email, new_code)
    return {"message": "Verification code resent successfully."}

# Add these schemas near the top where your other schemas are:
class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

# Add this new email function below your existing send_verification_email_real function:
def send_password_reset_email(receiver_email: str, code: str):
    """Sends a password reset email using SMTP."""
    message = MIMEMultipart("alternative")
    message["Subject"] = "Reset your Khana Bachao password"
    message["From"] = f"Khana Bachao <{SENDER_EMAIL}>"
    message["To"] = receiver_email

    text = f"Your password reset code is: {code}"
    html = f"""\
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>Password Reset Request 🔐</h2>
        <p>We received a request to reset your password for Khana Bachao.</p>
        <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; display: inline-block; margin: 10px 0;">
            <p style="margin: 0; font-size: 16px;">Your reset code is:</p>
            <h1 style="margin: 5px 0 0 0; color: #d32f2f; letter-spacing: 2px;">{code}</h1>
        </div>
        <p>Enter this code in the application along with your new password.</p>
        <p><i>If you did not request this, please ignore this email.</i></p>
      </body>
    </html>
    """

    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")
    message.attach(part1)
    message.attach(part2)

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, receiver_email, message.as_string())
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send reset email.")

# Add these two new routes:
@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(FoodProvider).filter_by(email=body.email).first()
    
    # We always return a success message to prevent "email enumeration" security risks
    if not user:
        return {"message": "If that email exists in our system, a reset code has been sent."}
        
    code = generate_otp()
    user.verification_code = code
    db.commit()
    
    send_password_reset_email(user.email, code)
    return {"message": "If that email exists in our system, a reset code has been sent."}

@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(FoodProvider).filter_by(email=body.email).first()
    
    if not user or user.verification_code != body.code:
        raise HTTPException(400, "Invalid verification code.")
        
    # Update password and clear the verification code
    user.password_hash = hash_password(body.new_password)
    user.verification_code = None
    db.commit()
    
    return {"message": "Password reset successfully. You can now log in."}
@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    if body.role == "food_provider":
        user = db.query(FoodProvider).filter_by(email=body.email).first()
        if user and not user.is_verified:
            raise HTTPException(403, "Please verify your email before logging in.")
    else:
        user = db.query(NGO).filter_by(email=body.email).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    name = user.name if hasattr(user, "name") else user.ngo_name
    token = create_token({"sub": str(user.id), "role": body.role})
    return TokenResponse(access_token=token, role=body.role, name=name)