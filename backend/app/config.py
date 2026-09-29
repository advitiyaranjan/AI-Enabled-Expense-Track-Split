import os
from dotenv import load_dotenv

load_dotenv()

# Serverless hosts (Vercel) only allow writes under /tmp, and /tmp is wiped between cold starts
IS_SERVERLESS = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))


def _database_url() -> str:
    default = "sqlite:////tmp/finance_tracker.db" if IS_SERVERLESS else "sqlite:///./data/finance_tracker.db"
    url = os.getenv("DATABASE_URL") or default
    # SQLAlchemy 1.4+ rejects the legacy "postgres://" scheme that Heroku/Render/compose often emit
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


class Settings:
    DATABASE_URL: str = _database_url()
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-prod")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

    AWS_S3_BUCKET: str = os.getenv("AWS_S3_BUCKET", "")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    TESSERACT_CMD: str = os.getenv("TESSERACT_CMD", "")

    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR") or ("/tmp/uploads" if IS_SERVERLESS else os.path.join(os.getcwd(), "uploads"))


settings = Settings()
