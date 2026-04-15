# backend/update_db.py
from app.database import engine
from sqlalchemy import text

def update_database():
    with engine.connect() as conn:
        try:
            # Add the new columns to the MySQL database
            conn.execute(text("ALTER TABLE food_providers ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE food_providers ADD COLUMN verification_code VARCHAR(6);"))
            conn.commit()
            print("✅ Successfully added new columns to the database!")
        except Exception as e:
            print(f"⚠️ Could not update database (columns might already exist). Error: {e}")

if __name__ == "__main__":
    update_database()