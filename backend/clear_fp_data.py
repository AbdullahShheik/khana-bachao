# backend/clear_fp_data.py
from app.database import SessionLocal
from app.models import FoodProvider
from sqlalchemy.orm import Session

def clear_food_providers():
    db: Session = SessionLocal()
    try:
        # Check how many users exist before deleting
        count = db.query(FoodProvider).count()
        print(f"Found {count} food provider(s). Deleting...")

        if count > 0:
            # Delete all records in the FoodProvider table
            db.query(FoodProvider).delete()
            db.commit()
            print("✅ Successfully deleted all food provider data.")
        else:
            print("⚠️ No food providers found. The table is already empty.")

    except Exception as e:
        db.rollback()
        print(f"❌ An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # Added a safety prompt so you don't accidentally wipe data later
    confirm = input("Are you sure you want to delete ALL Food Provider accounts? (y/n): ")
    if confirm.lower() == 'y':
        clear_food_providers()
    else:
        print("Operation cancelled.")