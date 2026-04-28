# backend/delete_test_user.py
from app.database import SessionLocal
from app.models import FoodProvider, NGO

def remove_user_by_email(email_to_remove: str):
    db = SessionLocal()
    try:
        deleted_something = False
        
        # Check if the user is a Food Provider
        fp = db.query(FoodProvider).filter(FoodProvider.email == email_to_remove).first()
        if fp:
            db.delete(fp)
            print(f"Found and deleted FoodProvider with email: {email_to_remove}")
            deleted_something = True

        # Check if the user is an NGO
        ngo = db.query(NGO).filter(NGO.email == email_to_remove).first()
        if ngo:
            db.delete(ngo)
            print(f"Found and deleted NGO with email: {email_to_remove}")
            deleted_something = True

        if deleted_something:
            db.commit()
            print(f"Successfully committed deletion for email: {email_to_remove}")
        else:
            print(f"No user found with the email: {email_to_remove}")

    except Exception as e:
        db.rollback()
        print(f"An error occurred while removing email: {e}")
    finally:
        db.close()

def remove_user_by_phone(phone_to_remove: str):
    db = SessionLocal()
    try:
        deleted_something = False
        
        # Check if the user is a Food Provider
        fp = db.query(FoodProvider).filter(FoodProvider.phone == phone_to_remove).first()
        if fp:
            db.delete(fp)
            print(f"Found and deleted FoodProvider with phone: {phone_to_remove}")
            deleted_something = True

        # Check if the user is an NGO
        ngo = db.query(NGO).filter(NGO.phone == phone_to_remove).first()
        if ngo:
            db.delete(ngo)
            print(f"Found and deleted NGO with phone: {phone_to_remove}")
            deleted_something = True

        if deleted_something:
            db.commit()
            print(f"Successfully committed deletion for phone: {phone_to_remove}")
        else:
            print(f"No user found with the phone: {phone_to_remove}")

    except Exception as e:
        db.rollback()
        print(f"An error occurred while removing phone: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    target_email = "mb09274@st.habib.edu.pk"
    target_phone = "03162511194"
    
    print(f"--- Attempting to remove email: {target_email} ---")
    remove_user_by_email(target_email)
    
    print(f"\n--- Attempting to remove phone: {target_phone} ---")
    remove_user_by_phone(target_phone)