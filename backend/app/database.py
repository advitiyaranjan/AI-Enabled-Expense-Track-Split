from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from .config import settings

engine_options = {"pool_pre_ping": True}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
    if ":memory:" in settings.DATABASE_URL:
        engine_options["poolclass"] = StaticPool
    else:
        sqlite_path = settings.DATABASE_URL.replace("sqlite:///", "", 1).replace("sqlite+pysqlite:///", "", 1)
        Path(sqlite_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
