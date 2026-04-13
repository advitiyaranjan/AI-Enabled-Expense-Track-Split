from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from . import models
from .routes import auth as auth_routes, transactions as tx_routes, receipts as receipts_routes, groups as groups_routes, insights as insights_routes
from .middleware import SimpleRateLimiterMiddleware

app = FastAPI(title="AI Finance Tracker Backend")

app.add_middleware(SimpleRateLimiterMiddleware, max_requests=300, window_seconds=60)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(tx_routes.router)
app.include_router(receipts_routes.router)
app.include_router(groups_routes.router)
app.include_router(insights_routes.router)


@app.on_event("startup")
def on_startup():
    # create DB tables if they don't exist
    Base.metadata.create_all(bind=engine)
