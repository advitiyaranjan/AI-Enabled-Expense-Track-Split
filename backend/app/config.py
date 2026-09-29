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
    # Name the driver explicitly: SQLAlchemy 2.1 changed the default Postgres driver to psycopg 3,
    # while this project ships psycopg2
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
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
    # Preferred model(s), best first; falls back through openai_service.DEFAULT_MODEL_CHAIN if unavailable
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-6-astra")

    TESSERACT_CMD: str = os.getenv("TESSERACT_CMD", "")

    # Outgoing email for OTP codes (defaults target Gmail SMTP with an App Password)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    # Google shows App Passwords with spaces ("abcd efgh ijkl mnop"); SMTP wants them without
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "").replace(" ", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "") or os.getenv("SMTP_USER", "")
    EMAIL_FROM_NAME: str = os.getenv("EMAIL_FROM_NAME", "FinanceAI")

    OTP_TTL_MINUTES: int = int(os.getenv("OTP_TTL_MINUTES", "10"))
    OTP_MAX_ATTEMPTS: int = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
    OTP_RESEND_COOLDOWN_SECONDS: int = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "30"))
    OTP_MAX_RESENDS: int = int(os.getenv("OTP_MAX_RESENDS", "5"))
    OTP_MAX_PER_HOUR: int = int(os.getenv("OTP_MAX_PER_HOUR", "10"))

    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR") or ("/tmp/uploads" if IS_SERVERLESS else os.path.join(os.getcwd(), "uploads"))


settings = Settings()
