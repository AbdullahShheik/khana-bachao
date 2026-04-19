# backend/app/schemas.py
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

ALLOWED_QUANTITY_UNITS = {"kg", "g", "l", "ml"}


# ══════════════════════════════════════════
#  ENUMS (mirror DB enums)
# ══════════════════════════════════════════

class ListingStatus(str, Enum):
    available = "available"
    claimed   = "claimed"
    completed = "completed"

class SenderType(str, Enum):
    food_provider = "food_provider"
    ngo           = "ngo"

class NGOStatus(str, Enum):
    pending  = "pending"
    verified = "verified"
    rejected = "rejected"


# ══════════════════════════════════════════
#  AUTH
# ══════════════════════════════════════════

class FoodProviderRegister(BaseModel):
    name:     str
    email:    Optional[EmailStr] = None
    phone:    Optional[str]      = None
    password: str

    @model_validator(mode="after")
    def email_or_phone_required(self):
        """SRS: Food Provider registers with email OR WhatsApp phone number."""
        if not self.email and not self.phone:
            raise ValueError("At least one of email or phone number is required.")
        return self


class NGOCreate(BaseModel):
    """Used by admins to pre-register NGOs. NGOs do NOT self-register (SRS)."""
    ngo_name:            str
    email:               EmailStr
    phone:               Optional[str] = None
    password:            str
    verification_status: NGOStatus = NGOStatus.verified


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str
    role:     str   # "food_provider" or "ngo"

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v):
        if v not in ("food_provider", "ngo"):
            raise ValueError("role must be 'food_provider' or 'ngo'")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str
    name:         str


# ══════════════════════════════════════════
#  FOOD ITEMS  (dishes within a listing)
# ══════════════════════════════════════════

class FoodItemCreate(BaseModel):
    item_name:        str
    estimated_weight:  Optional[str] = None   # e.g. "5 kg"
    estimated_serving: Optional[int] = None   # number of people
    image_url:         Optional[str] = None

    @field_validator("estimated_weight")
    @classmethod
    def validate_estimated_weight(cls, v):
        if v is None:
            return v

        text = v.strip().lower()
        parts = text.split()
        if len(parts) != 2:
            raise ValueError(
                "estimated_weight must be a positive number followed by a unit (kg, g, l, ml)."
            )

        amount_text, unit = parts

        try:
            amount = float(amount_text)
        except ValueError as exc:
            raise ValueError(
                "estimated_weight must be a positive number followed by a unit (kg, g, l, ml)."
            ) from exc

        if amount <= 0 or unit not in ALLOWED_QUANTITY_UNITS:
            raise ValueError(
                "estimated_weight must be a positive number followed by a unit (kg, g, l, ml)."
            )

        normalized_amount = (
            str(int(amount)) if amount.is_integer() else str(amount).rstrip("0").rstrip(".")
        )
        return f"{normalized_amount} {unit}"

    @field_validator("estimated_serving")
    @classmethod
    def validate_estimated_serving(cls, v):
        if v is None:
            return v
        if v <= 0:
            raise ValueError("estimated_serving must be a positive whole number.")
        return v


class FoodItemResponse(BaseModel):
    item_name:         str
    estimated_weight:  Optional[str] = None
    estimated_serving: Optional[int] = None
    image_url:         Optional[str] = None
    id:         int
    listing_id: int

    class Config:
        from_attributes = True


# ══════════════════════════════════════════
#  FOOD LISTINGS
# ══════════════════════════════════════════

class ListingCreate(BaseModel):
    location:        str
    available_from:  Optional[datetime] = None
    available_until: datetime
    notes:           Optional[str] = None
    food_items:      List[FoodItemCreate]   # at least one dish required

    @field_validator("food_items")
    @classmethod
    def at_least_one_item(cls, v):
        if not v:
            raise ValueError("A listing must include at least one food item.")
        return v

    @model_validator(mode="after")
    def validate_time_window(self):
        available_from_has_tz = (
            self.available_from is not None
            and self.available_from.tzinfo is not None
        )
        available_until_has_tz = self.available_until.tzinfo is not None
        if available_from_has_tz or available_until_has_tz:
            raise ValueError(
                "available_from and available_until must be timezone-naive datetimes."
            )
        if self.available_from and self.available_until <= self.available_from:
            raise ValueError("available_until must be later than available_from.")
        return self


class ListingResponse(BaseModel):
    id:              int
    food_provider_id: int
    status:          ListingStatus
    location:        str
    available_from:  Optional[datetime]
    available_until: datetime
    notes:           Optional[str]
    created_at:      datetime
    food_items:      List[FoodItemResponse] = []
    chat_id:         Optional[int] = None


    class Config:
        from_attributes = True


class ListingStatusUpdate(BaseModel):
    """Food Provider can manually mark a listing as completed."""
    status: ListingStatus


# ══════════════════════════════════════════
#  CLAIMS
# ══════════════════════════════════════════

class ClaimResponse(BaseModel):
    id:         int
    listing_id: int
    ngo_id:     int
    claimed_at: datetime
    chat_id:    Optional[int] = None   # returned after chat row is auto-created

    class Config:
        from_attributes = True


# ══════════════════════════════════════════
#  CHAT + MESSAGES
# ══════════════════════════════════════════

class ChatResponse(BaseModel):
    id:         int
    claim_id:   int
    created_at: datetime

    class Config:
        from_attributes = True


class ChatThreadResponse(BaseModel):
    id:                   int
    listing_id:           int
    listing_status:       ListingStatus
    location:             str
    food_summary:         str
    counterpart_name:     str
    message_count:        int
    unread_count:         int = 0
    last_message_preview: Optional[str] = None
    last_message_at:      Optional[datetime] = None
    created_at:           datetime


class ChatDetailResponse(BaseModel):
    id:                   int
    listing_id:           int
    listing_status:       ListingStatus
    location:             str
    food_summary:         str
    food_provider_name:   str
    ngo_name:             str
    message_count:        int
    unread_count:         int = 0
    last_message_preview: Optional[str] = None
    last_message_at:      Optional[datetime] = None
    created_at:           datetime


class MessageCreate(BaseModel):
    message_text: str

    @field_validator("message_text")
    @classmethod
    def not_empty(cls, v):
        if not v.strip():
            raise ValueError("Message cannot be empty.")
        return v.strip()


class MessageResponse(BaseModel):
    id:           int
    chat_id:      int
    sender_type:  SenderType
    sender_id:    int
    message_text: str
    sent_at:      datetime

    class Config:
        from_attributes = True


class UnreadSummaryResponse(BaseModel):
    total_unread_chats:    int
    total_unread_messages: int
