from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from .database import engine, Base
from . import models
from .routes import auth as auth_routes, transactions as tx_routes, receipts as receipts_routes, groups as groups_routes, insights as insights_routes, ai as ai_routes, splits as splits_routes, users as users_routes
from .middleware import SimpleRateLimiterMiddleware

app = FastAPI(title="AI Finance Tracker Backend")
Base.metadata.create_all(bind=engine)


def ensure_runtime_columns():
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("users")}
    statements = []
    if "phone" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN phone VARCHAR")
    if "location" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN location VARCHAR")
    if "country" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN country VARCHAR DEFAULT 'United States' NOT NULL")
    if "currency" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN currency VARCHAR DEFAULT 'INR' NOT NULL")
    if "public_id" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN public_id INTEGER")
        statements.append("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_public_id ON users (public_id)")
    if "upi_id" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN upi_id VARCHAR")
    for statement in statements:
        # One transaction per change: if another cold-starting instance already applied it, skip it
        try:
            with engine.begin() as connection:
                connection.execute(text(statement))
        except Exception as exc:  # noqa: BLE001
            if "exist" not in str(exc).lower() and "duplicate" not in str(exc).lower():
                raise
    # Give every existing account a FinanceAI ID
    from .database import SessionLocal
    from .services.user_ids import backfill_public_ids
    db = SessionLocal()
    try:
        backfill_public_ids(db)
    finally:
        db.close()


ensure_runtime_columns()

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
app.include_router(ai_routes.router)
app.include_router(splits_routes.router)
app.include_router(users_routes.router)


@app.get("/health")
def healthcheck(details: bool = False):
    if not details:
        return {"status": "ok"}
    # Reports which AI model is active without exposing any secret
    from .services.openai_service import ai_status
    return {"status": "ok", "ai": ai_status()}


@app.on_event("startup")
def on_startup():
    # create DB tables if they don't exist
    Base.metadata.create_all(bind=engine)
    ensure_runtime_columns()
