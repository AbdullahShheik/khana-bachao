# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routes import auth as auth_router
from .routes import listings as listings_router

Base.metadata.create_all(bind=engine)   # creates tables automatically

app = FastAPI(title="Khana Bachao API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(listings_router.router)

@app.get("/")
def root():
    return {"message": "Khana Bachao API is running"}
