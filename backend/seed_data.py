import sys
import os
import argparse

# Add the parent directory to path so we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app.models import FoodProvider, NGO, FoodListing, FoodItem
from app.auth import hash_password
from datetime import datetime, timedelta

def get_db():
    return SessionLocal()

def seed_food_providers(db):
    """Adds a sample Food Provider to the database."""
    print("👤 Checking for sample Food Provider...")
    fp = db.query(FoodProvider).filter_by(email="provider@test.com").first()
    if not fp:
        fp = FoodProvider(
            name="Al-Karim Wedding Hall",
            email="provider@test.com",
            phone="03001234567",
            password_hash=hash_password("password123")
        )
        db.add(fp)
        db.commit()
        db.refresh(fp)
        print(f"✅ Added Food Provider: {fp.name}")
    else:
        print("ℹ️ Food Provider already exists.")
    return fp

def seed_ngos(db):
    """Adds a sample NGO to the database."""
    print("🤝 Checking for sample NGO...")
    ngo = db.query(NGO).filter_by(email="tz09220@st.habib.edu.pk").first()
    if not ngo:
        ngo = NGO(
            ngo_name="JDC Welfare",
            email="tz09220@st.habib.edu.pk",
            phone="03212141483",
            password_hash=hash_password("password123"),
            verification_status="verified"
        )
        db.add(ngo)
        db.commit()
        db.refresh(ngo)
        print(f"✅ Added NGO: {ngo.ngo_name}")
    else:
        print("ℹ️ NGO already exists.")
    return ngo

def seed_listings(db, fp):
    """Adds sample food listings for a specific provider."""
    print("🍱 Creating sample food listings...")
    listing = FoodListing(
        food_provider_id=fp.id,
        status="available",
        location="DHA Phase 5, Karachi",
        available_from=datetime.now(),
        available_until=datetime.now() + timedelta(hours=5),
        notes="Fresh Biryani from lunch event. Please bring your own containers."
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)

    item = FoodItem(
        listing_id=listing.id,
        item_name="Chicken Biryani",
        estimated_weight="15 kg",
        estimated_serving=60
    )
    db.add(item)
    db.commit()
    print("✅ Added sample listing and items.")

def main():
    # Setup command-line arguments so YOU have control
    parser = argparse.ArgumentParser(description="Seed Khana Bachao database.")
    parser.add_argument("--ngo", action="store_true", help="Only seed NGO data")
    parser.add_argument("--fp", action="store_true", help="Only seed Food Provider data")
    parser.add_argument("--all", action="store_true", help="Seed everything")
    
    args = parser.parse_args()
    
    # If no arguments are provided, show help
    if not any([args.ngo, args.fp, args.all]):
        parser.print_help()
        return

    print("🌱 Starting seeding process...")
    db = get_db()
    try:
        # Create tables first
        Base.metadata.create_all(bind=engine)

        if args.all or args.fp:
            fp = seed_food_providers(db)
            if args.all: # Only add listings if we are doing everything
                seed_listings(db, fp)
        
        if args.all or args.ngo:
            seed_ngos(db)

        print("\n✨ Done!")
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
