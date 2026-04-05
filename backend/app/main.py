# backend/app/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import engine, Base
from .routes import auth as auth_router
from .routes import listings as listings_router
from .routes import upload as upload_router

Base.metadata.create_all(bind=engine)   # creates tables automatically

app = FastAPI(title="Khana Bachao API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images at /uploads
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth_router.router)
app.include_router(listings_router.router)
app.include_router(upload_router.router)

@app.get("/")
def root():
    return {"message": "Khana Bachao API is running"}

