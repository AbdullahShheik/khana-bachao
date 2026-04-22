import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DB_URL = (
    f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    f"?ssl_ca={os.getenv('DB_SSL_CA')}"
)

engine = create_engine(DB_URL)

def migrate():
    with engine.connect() as conn:
        print("Checking food_providers table...")
        try:
            conn.execute(text("ALTER TABLE food_providers ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE AFTER verification_code"))
            print("Successfully added email_notifications to food_providers")
        except Exception as e:
            print(f"food_providers update failed (might already exist): {e}")

        print("Checking ngos table...")
        try:
            conn.execute(text("ALTER TABLE ngos ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE AFTER verification_status"))
            print("Successfully added email_notifications to ngos")
        except Exception as e:
            print(f"ngos update failed (might already exist): {e}")
            
        conn.commit()

if __name__ == "__main__":
    migrate()
