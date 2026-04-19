# backend/app/routes/listings.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

from ..auth import decode_token
from ..database import get_db
from ..models import Chat, FoodItem, FoodListing, ListingClaim
from ..schemas import ClaimResponse, ListingCreate, ListingResponse

router = APIRouter(prefix="/listings", tags=["listings"])
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


def require_food_provider(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "food_provider":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only food providers can perform this action.",
        )
    return current_user


def require_ngo(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "ngo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only NGOs can perform this action.",
        )
    return current_user


@router.post("", response_model=ListingResponse)
def create_listing(
    body: ListingCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_food_provider),
):
    try:
        listing = FoodListing(
            food_provider_id=current_user["id"],
            status="available",
            location=body.location,
            available_from=body.available_from,
            available_until=body.available_until,
            notes=body.notes,
        )
        db.add(listing)
        db.flush()

        for item in body.food_items:
            db.add(
                FoodItem(
                    listing_id=listing.id,
                    item_name=item.item_name,
                    estimated_weight=item.estimated_weight,
                    estimated_serving=item.estimated_serving,
                    image_url=item.image_url,
                )
            )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create listing.",
        )

    created_listing = (
        db.query(FoodListing)
        .options(joinedload(FoodListing.food_items))
        .filter(FoodListing.id == listing.id)
        .first()
    )
    if not created_listing:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Listing created but failed to load response.",
        )

    return created_listing


@router.get("", response_model=list[ListingResponse])
def get_available_listings(
    db: Session = Depends(get_db),
    _: dict = Depends(require_ngo),
):
    listings = (
        db.query(FoodListing)
        .options(joinedload(FoodListing.food_items))
        .filter(FoodListing.status == "available")
        .order_by(FoodListing.created_at.desc())
        .all()
    )
    return listings


@router.get("/my", response_model=list[ListingResponse])
def get_my_listings(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_food_provider),
):
    listings = (
        db.query(FoodListing)
        .options(joinedload(FoodListing.food_items), joinedload(FoodListing.claim).joinedload(ListingClaim.chat))
        .filter(FoodListing.food_provider_id == current_user["id"])
        .order_by(FoodListing.created_at.desc())
        .all()
    )
    result = []
    for listing in listings:
        chat_id = listing.claim.chat.id if listing.claim and listing.claim.chat else None
        d = ListingResponse.model_validate(listing)
        d.chat_id = chat_id
        result.append(d)
    return result


@router.get("/my-claims", response_model=list[ListingResponse])
def get_my_claimed_listings(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_ngo),
):
    listings = (
        db.query(FoodListing)
        .join(ListingClaim, ListingClaim.listing_id == FoodListing.id)
        .options(joinedload(FoodListing.food_items), joinedload(FoodListing.claim).joinedload(ListingClaim.chat))
        .filter(ListingClaim.ngo_id == current_user["id"])
        .order_by(ListingClaim.claimed_at.desc())
        .all()
    )
    result = []
    for listing in listings:
        chat_id = listing.claim.chat.id if listing.claim and listing.claim.chat else None
        d = ListingResponse.model_validate(listing)
        d.chat_id = chat_id
        result.append(d)
    return result


@router.post("/{listing_id}/claim", response_model=ClaimResponse)
def claim_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_ngo),
):
    try:
        listing = (
            db.query(FoodListing)
            .filter(FoodListing.id == listing_id)
            .with_for_update()
            .first()
        )

        if not listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Listing not found.",
            )

        if listing.status != "available":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This listing is no longer available for claim.",
            )

        claim = ListingClaim(listing_id=listing.id, ngo_id=current_user["id"])
        listing.status = "claimed"

        db.add(claim)
        db.flush()

        chat = Chat(claim_id=claim.id)
        db.add(chat)
        db.flush()

        db.commit()
        db.refresh(claim)

        return ClaimResponse(
            id=claim.id,
            listing_id=claim.listing_id,
            ngo_id=claim.ngo_id,
            claimed_at=claim.claimed_at,
            chat_id=chat.id,
        )
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This listing is no longer available for claim.",
        )
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to claim listing.",
        )


@router.get("/{listing_id}", response_model=ListingResponse)
def get_listing_by_id(
    listing_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    listing = (
        db.query(FoodListing)
        .options(joinedload(FoodListing.food_items), joinedload(FoodListing.claim).joinedload(ListingClaim.chat))
        .filter(FoodListing.id == listing_id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")
    
    chat_id = listing.claim.chat.id if listing.claim and listing.claim.chat else None
    d = ListingResponse.model_validate(listing)
    d.chat_id = chat_id
    return d
