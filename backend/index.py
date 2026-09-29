# Vercel entrypoint: the FastAPI runtime looks for an `app` object in index.py and serves every route from it.
from app.main import app  # noqa: F401
