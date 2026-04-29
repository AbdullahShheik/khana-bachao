from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..auth import decode_token
from ..database import get_db
from ..models import Notification
from fastapi import HTTPException

router = APIRouter(prefix="/notifications", tags=["notifications"])
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


@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .filter(
            Notification.recipient_role == current_user["role"],
            Notification.recipient_id == current_user["id"],
        )
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in notifications
    ]


@router.patch("/mark-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.recipient_role == current_user["role"],
        Notification.recipient_id == current_user["id"],
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}