from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from ..auth import decode_token
from ..database import get_db
from ..models import Chat, ChatReadState, FoodListing, ListingClaim, Message
from ..schemas import (
    ChatDetailResponse,
    ChatThreadResponse,
    MessageCreate,
    MessageResponse,
    UnreadSummaryResponse,
)

router = APIRouter(prefix="/chats", tags=["chat"])
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token is required.",
        )

    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    role = payload.get("role")

    if user_id is None or role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is invalid.",
        )

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is invalid.",
        )

    return {"id": user_id, "role": role}


def _food_summary(listing: FoodListing) -> str:
    names = [item.item_name.strip() for item in listing.food_items if item.item_name]
    if not names:
        return f"Listing #{listing.id}"
    return ", ".join(names)


def _base_chat_query_for_user(db: Session, current_user: dict):
    query = (
        db.query(Chat)
        .join(ListingClaim, ListingClaim.id == Chat.claim_id)
        .join(FoodListing, FoodListing.id == ListingClaim.listing_id)
        .options(
            joinedload(Chat.claim).joinedload(ListingClaim.listing).joinedload(FoodListing.food_items),
            joinedload(Chat.claim).joinedload(ListingClaim.listing).joinedload(FoodListing.food_provider),
            joinedload(Chat.claim).joinedload(ListingClaim.ngo),
            joinedload(Chat.messages),
            joinedload(Chat.read_states),
        )
    )

    if current_user["role"] == "food_provider":
        return query.filter(FoodListing.food_provider_id == current_user["id"])
    if current_user["role"] == "ngo":
        return query.filter(ListingClaim.ngo_id == current_user["id"])

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="This role cannot access chat.",
    )


def _chat_with_relationships(db: Session, chat_id: int) -> Optional[Chat]:
    return (
        db.query(Chat)
        .options(
            joinedload(Chat.claim).joinedload(ListingClaim.listing).joinedload(FoodListing.food_items),
            joinedload(Chat.claim).joinedload(ListingClaim.listing).joinedload(FoodListing.food_provider),
            joinedload(Chat.claim).joinedload(ListingClaim.ngo),
            joinedload(Chat.messages),
            joinedload(Chat.read_states),
        )
        .filter(Chat.id == chat_id)
        .first()
    )


def _ensure_chat_access(chat: Chat, current_user: dict) -> None:
    claim = chat.claim
    listing = claim.listing

    if current_user["role"] == "food_provider":
        if listing.food_provider_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to access this chat.",
            )
    elif current_user["role"] == "ngo":
        if claim.ngo_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to access this chat.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This role cannot access chat.",
        )

    if listing.status == "available":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat is only available for claimed listings.",
        )


def _get_user_read_state_from_chat(chat: Chat, current_user: dict) -> Optional[ChatReadState]:
    for read_state in chat.read_states:
        if (
            read_state.user_role == current_user["role"]
            and read_state.user_id == current_user["id"]
        ):
            return read_state
    return None


def _get_or_create_user_read_state(
    db: Session,
    chat: Chat,
    current_user: dict,
) -> ChatReadState:
    existing = _get_user_read_state_from_chat(chat, current_user)
    if existing:
        return existing

    read_state = ChatReadState(
        chat_id=chat.id,
        user_role=current_user["role"],
        user_id=current_user["id"],
        last_read_message_id=None,
    )
    db.add(read_state)
    db.flush()
    return read_state


def _compute_unread_count(chat: Chat, current_user: dict) -> int:
    read_state = _get_user_read_state_from_chat(chat, current_user)
    last_read_id = read_state.last_read_message_id if read_state else None

    unread = 0
    for message in chat.messages:
        sent_by_current_user = (
            message.sender_type == current_user["role"]
            and message.sender_id == current_user["id"]
        )
        if sent_by_current_user:
            continue

        if last_read_id is None or message.id > last_read_id:
            unread += 1

    return unread


def _to_thread(chat: Chat, current_user: dict) -> ChatThreadResponse:
    listing = chat.claim.listing
    last_message = chat.messages[-1] if chat.messages else None

    counterpart_name = (
        chat.claim.ngo.ngo_name
        if current_user["role"] == "food_provider"
        else listing.food_provider.name
    )

    return ChatThreadResponse(
        id=chat.id,
        listing_id=listing.id,
        listing_status=listing.status,
        location=listing.location,
        food_summary=_food_summary(listing),
        counterpart_name=counterpart_name,
        message_count=len(chat.messages),
        unread_count=_compute_unread_count(chat, current_user),
        last_message_preview=last_message.message_text if last_message else None,
        last_message_at=last_message.sent_at if last_message else None,
        created_at=chat.created_at,
    )


@router.get("", response_model=list[ChatThreadResponse])
def list_my_chats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    chats = _base_chat_query_for_user(db, current_user).order_by(Chat.created_at.desc()).all()

    threads = [_to_thread(chat, current_user) for chat in chats]
    threads.sort(
        key=lambda thread: thread.last_message_at or thread.created_at,
        reverse=True,
    )
    return threads


@router.get("/unread-summary", response_model=UnreadSummaryResponse)
def unread_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    chats = _base_chat_query_for_user(db, current_user).all()

    unread_counts = [_compute_unread_count(chat, current_user) for chat in chats]

    return UnreadSummaryResponse(
        total_unread_chats=sum(1 for count in unread_counts if count > 0),
        total_unread_messages=sum(unread_counts),
    )


@router.get("/{chat_id}", response_model=ChatDetailResponse)
def get_chat_detail(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    chat = _chat_with_relationships(db, chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")

    _ensure_chat_access(chat, current_user)

    listing = chat.claim.listing
    last_message = chat.messages[-1] if chat.messages else None

    return ChatDetailResponse(
        id=chat.id,
        listing_id=listing.id,
        listing_status=listing.status,
        location=listing.location,
        food_summary=_food_summary(listing),
        food_provider_name=listing.food_provider.name,
        ngo_name=chat.claim.ngo.ngo_name,
        message_count=len(chat.messages),
        unread_count=_compute_unread_count(chat, current_user),
        last_message_preview=last_message.message_text if last_message else None,
        last_message_at=last_message.sent_at if last_message else None,
        created_at=chat.created_at,
    )


@router.get("/{chat_id}/messages", response_model=list[MessageResponse])
def get_chat_messages(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    chat = _chat_with_relationships(db, chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")

    _ensure_chat_access(chat, current_user)

    messages = (
        db.query(Message)
        .filter(Message.chat_id == chat.id)
        .order_by(Message.sent_at.asc(), Message.id.asc())
        .all()
    )
    return messages


@router.post("/{chat_id}/read")
def mark_chat_as_read(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    chat = _chat_with_relationships(db, chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")

    _ensure_chat_access(chat, current_user)

    latest_message_id = chat.messages[-1].id if chat.messages else None

    try:
        read_state = _get_or_create_user_read_state(db, chat, current_user)
        read_state.last_read_message_id = latest_message_id
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update read status.",
        )

    return {
        "chat_id": chat.id,
        "last_read_message_id": latest_message_id,
        "unread_count": 0,
    }


@router.post("/{chat_id}/messages", response_model=MessageResponse)
def send_message(
    chat_id: int,
    body: MessageCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    chat = _chat_with_relationships(db, chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")

    _ensure_chat_access(chat, current_user)

    if chat.claim.listing.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This chat is closed. The listing has been completed.",
        )

    try:
        message = Message(
            chat_id=chat.id,
            sender_type=current_user["role"],
            sender_id=current_user["id"],
            message_text=body.message_text,
        )
        db.add(message)
        db.flush()

        read_state = _get_or_create_user_read_state(db, chat, current_user)
        read_state.last_read_message_id = message.id

        db.commit()
        db.refresh(message)
        return message
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message.",
        )
