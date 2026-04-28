# backend/app/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import email.utils
from ..database import get_db
from ..models import FoodProvider, NGO
from ..schemas import FoodProviderRegister, LoginRequest, TokenResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from ..auth import hash_password, verify_password, create_token, decode_token
from ..whatsapp_service import send_whatsapp_verification
import os
router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Authorization token is required.")
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    role = payload.get("role")
    if user_id is None or role is None:
        raise HTTPException(status_code=401, detail="Token payload is invalid.")
    return {"id": int(user_id), "role": role}

class NotificationUpdate(BaseModel):
    enabled: bool

# --- EMAIL CONFIGURATION ---
# IMPORTANT: In a production app, use environment variables (os.getenv) for these!
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

class VerifyRequest(BaseModel):
    identifier: str
    code: str

class ResendRequest(BaseModel):
    identifier: str

def generate_otp():
    """Generates a 6-digit verification code."""
    return ''.join(random.choices(string.digits, k=6))

def send_verification_email_real(receiver_email: str, code: str):
    """Sends a real email using SMTP."""
    """Sends a real email using SMTP."""
    message = MIMEMultipart("alternative")
    message["Subject"] = "Verify your Khana Bachao account"
    message["From"] = f"Khana Bachao <{SENDER_EMAIL}>"
    message["To"] = receiver_email
    
    # --- ADD THESE TWO LINES ---
    message["Message-ID"] = email.utils.make_msgid()
    message["Date"] = email.utils.formatdate(localtime=True)

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

# Temporary in-memory storage for pending registrations
pending_registrations = {}

class CancelRegistrationRequest(BaseModel):
    identifier: str

# --- Replace your existing endpoints with these ---

@router.post("/register")
def register(body: FoodProviderRegister, db: Session = Depends(get_db)):
    # 1. Check if email is already fully registered in the database
    if body.email:
        existing_user = db.query(FoodProvider).filter_by(email=body.email).first()
        if existing_user:
            raise HTTPException(400, "Email already registered.")

    # 2. Check existing phone
    if body.phone:
        if db.query(FoodProvider).filter_by(phone=body.phone).first():
            raise HTTPException(400, "Phone already registered.")

    # Determine identifier to use as key for pending_registrations
    identifier = body.email if body.email else body.phone

    # 3. Create code and store user details in MEMORY (not the database yet)
    code = generate_otp()
    pending_registrations[identifier] = {
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "password_hash": hash_password(body.password),
        "code": code,
        "preferred_verification_method": body.preferred_verification_method
    }
    
    # 4. Decide where to send the code
    try:
        if body.email and body.phone:
            if body.preferred_verification_method == "whatsapp":
                send_whatsapp_verification(body.phone, code)
            else:
                send_verification_email_real(body.email, code)
        elif body.phone:
            send_whatsapp_verification(body.phone, code)
        else:
            send_verification_email_real(body.email, code)
    except Exception as e:
        if identifier in pending_registrations:
            del pending_registrations[identifier]
        raise e

    return {"message": "Verification code sent. Complete verification to finish registration."}


@router.post("/verify", response_model=TokenResponse)
def verify_account(body: VerifyRequest, db: Session = Depends(get_db)):
    # 1. Look for the user in our temporary memory
    if body.identifier in pending_registrations:
        pending_user = pending_registrations[body.identifier]
        
        if pending_user["code"] != body.code:
            raise HTTPException(400, "Invalid verification code")
            
        # 2. Code is correct! NOW we save them to the database
        new_user = FoodProvider(
            name=pending_user["name"],
            email=pending_user["email"],
            phone=pending_user["phone"],
            password_hash=pending_user["password_hash"],
            is_verified=True,
            verification_code=None
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # 3. Clear them from pending memory
        del pending_registrations[body.identifier]
        
        # 4. Log them in
        token = create_token({"sub": str(new_user.id), "role": "food_provider"})
        return TokenResponse(access_token=token, role="food_provider", name=new_user.name)
        
    else:
        raise HTTPException(404, "No pending registration found for this identifier. Please register again.")


@router.post("/resend-code")
def resend_code(body: ResendRequest, db: Session = Depends(get_db)):
    # Check memory instead of database for resending codes
    if body.identifier in pending_registrations:
        new_code = generate_otp()
        pending_user = pending_registrations[body.identifier]
        pending_user["code"] = new_code
        
        try:
            if pending_user["email"] and pending_user["phone"]:
                if pending_user["preferred_verification_method"] == "whatsapp":
                    send_whatsapp_verification(pending_user["phone"], new_code)
                else:
                    send_verification_email_real(pending_user["email"], new_code)
            elif pending_user["phone"]:
                send_whatsapp_verification(pending_user["phone"], new_code)
            else:
                send_verification_email_real(pending_user["email"], new_code)
        except Exception as e:
            # Revert the code if it failed to send
            pending_user["code"] = pending_registrations[body.identifier]["code"] 
            raise e

        return {"message": "Verification code resent successfully."}
    else:
        raise HTTPException(404, "No pending registration found.")


@router.post("/cancel-registration")
def cancel_registration(body: CancelRegistrationRequest):
    # If the user cancels, we simply delete their temporary data
    if body.identifier in pending_registrations:
        del pending_registrations[body.identifier]
    return {"message": "Registration cancelled successfully."}

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

def authenticate_user(identifier: str, password: str, role: str, db: Session):
    if role == "food_provider":
        user = db.query(FoodProvider).filter(
            or_(FoodProvider.email == identifier, FoodProvider.phone == identifier)
        ).first()
    else:
        user = db.query(NGO).filter(
            or_(NGO.email == identifier, NGO.phone == identifier)
        ).first()

    if not user or not verify_password(password, user.password_hash):
        return None
    return user

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(body.identifier, body.password, body.role, db)
    
    if not user:
        raise HTTPException(401, "Invalid credentials")
        
    if body.role == "food_provider" and not user.is_verified:
        raise HTTPException(403, "Please verify your account before logging in.")

    name = user.name if hasattr(user, "name") else user.ngo_name
    token = create_token({"sub": str(user.id), "role": body.role})
    return TokenResponse(access_token=token, role=body.role, name=name)

@router.get("/me")
def get_me(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "food_provider":
        user = db.query(FoodProvider).filter_by(id=current_user["id"]).first()
    else:
        user = db.query(NGO).filter_by(id=current_user["id"]).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    name = user.name if hasattr(user, "name") else user.ngo_name
    return {
        "id": user.id,
        "name": name,
        "email": user.email,
        "role": current_user["role"],
        "email_notifications": user.email_notifications
    }

@router.patch("/notifications")
def update_notifications(
    body: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "food_provider":
        user = db.query(FoodProvider).filter_by(id=current_user["id"]).first()
    else:
        user = db.query(NGO).filter_by(id=current_user["id"]).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.email_notifications = body.enabled
    db.commit()
    return {"message": "Notification preferences updated", "enabled": user.email_notifications}