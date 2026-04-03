# backend/app/models.py
from sqlalchemy import (
    Column, Integer, String, Text, DateTime,
    Enum, ForeignKey, UniqueConstraint, event
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


# ══════════════════════════════════════════
#  USERS
# ══════════════════════════════════════════

class FoodProvider(Base):
    __tablename__ = "food_providers"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(120), nullable=False)
    email         = Column(String(120), unique=True, nullable=True)   # one of email or phone required (enforced in schema)
    phone         = Column(String(20),  unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at    = Column(DateTime, server_default=func.now())

    # Relationships
    listings = relationship("FoodListing", back_populates="food_provider", cascade="all, delete-orphan")


class NGO(Base):
    __tablename__ = "ngos"

    id                  = Column(Integer, primary_key=True, index=True)
    ngo_name            = Column(String(120), nullable=False)
    email               = Column(String(120), unique=True, nullable=False)
    phone               = Column(String(20),  unique=True, nullable=True)
    password_hash       = Column(String(255), nullable=False)
    verification_status = Column(
        Enum("pending", "verified", "rejected", name="ngo_status"),
        nullable=False,
        default="verified"   # admin pre-registers, so default is verified
    )
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    claims = relationship("ListingClaim", back_populates="ngo")


# ══════════════════════════════════════════
#  FOOD LISTINGS + ITEMS
# ══════════════════════════════════════════

class FoodListing(Base):
    """
    One listing = one pickup event posted by a Food Provider.
    A listing can have multiple FoodItem rows (individual dishes).
    """
    __tablename__ = "food_listings"

    id               = Column(Integer, primary_key=True, index=True)
    food_provider_id = Column(Integer, ForeignKey("food_providers.id", ondelete="CASCADE"), nullable=False)
    status           = Column(
        Enum("available", "claimed", "completed", name="listing_status"),
        nullable=False,
        default="available"
    )
    location         = Column(String(255), nullable=False)
    available_from   = Column(DateTime, nullable=True)
    available_until  = Column(DateTime, nullable=False)
    notes            = Column(Text, nullable=True)
    created_at       = Column(DateTime, server_default=func.now())

    # Relationships
    food_provider = relationship("FoodProvider", back_populates="listings")
    food_items    = relationship("FoodItem",     back_populates="listing", cascade="all, delete-orphan")
    claim         = relationship("ListingClaim", back_populates="listing", uselist=False)


class FoodItem(Base):
    """
    Individual dish/item within a listing.
    SRS ERD: FoodItemID, ListingID (FK), ItemName, EstimatedWeight, EstimatedServing, Image
    """
    __tablename__ = "food_items"

    id               = Column(Integer, primary_key=True, index=True)
    listing_id       = Column(Integer, ForeignKey("food_listings.id", ondelete="CASCADE"), nullable=False)
    item_name        = Column(String(120), nullable=False)
    estimated_weight = Column(String(50),  nullable=True)   # stored as string e.g. "5 kg"
    estimated_serving = Column(Integer,    nullable=True)   # number of people
    image_url        = Column(String(500), nullable=True)   # URL to uploaded image (optional per SRS)

    # Relationships
    listing = relationship("FoodListing", back_populates="food_items")


# ══════════════════════════════════════════
#  CLAIMS
# ══════════════════════════════════════════

class ListingClaim(Base):
    """
    SRS constraint: only ONE NGO can claim a listing.
    Enforced by UNIQUE constraint on listing_id.
    DB-level lock prevents race conditions (SRS non-functional requirement).
    """
    __tablename__ = "listing_claims"

    id         = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("food_listings.id", ondelete="CASCADE"),
                        nullable=False, unique=True)     # ← UNIQUE: one claim per listing
    ngo_id     = Column(Integer, ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False)
    claimed_at = Column(DateTime, server_default=func.now())

    # Relationships
    listing = relationship("FoodListing", back_populates="claim")
    ngo     = relationship("NGO",         back_populates="claims")
    chat    = relationship("Chat",        back_populates="claim", uselist=False, cascade="all, delete-orphan")


# ══════════════════════════════════════════
#  CHAT + MESSAGES
# ══════════════════════════════════════════

class Chat(Base):
    """
    One Chat is created per ListingClaim.
    Chat is only enabled after a listing is claimed (SRS requirement).
    """
    __tablename__ = "chats"

    id         = Column(Integer, primary_key=True, index=True)
    claim_id   = Column(Integer, ForeignKey("listing_claims.id", ondelete="CASCADE"),
                        nullable=False, unique=True)     # 1-to-1 with claim
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    claim    = relationship("ListingClaim", back_populates="chat")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan",
                            order_by="Message.sent_at")


class Message(Base):
    """
    SRS: sender_type distinguishes who sent the message.
    sender_id is the FK to either food_providers.id or ngos.id
    depending on sender_type (polymorphic pattern).
    """
    __tablename__ = "messages"

    id           = Column(Integer, primary_key=True, index=True)
    chat_id      = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    sender_type  = Column(
        Enum("food_provider", "ngo", name="sender_type"),
        nullable=False
    )
    sender_id    = Column(Integer, nullable=False)   # FK to food_providers.id or ngos.id
    message_text = Column(Text, nullable=False)
    sent_at      = Column(DateTime, server_default=func.now())

    # Relationships
    chat = relationship("Chat", back_populates="messages")
