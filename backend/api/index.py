# Vercel serverless entrypoint: every request is rewritten here (see vercel.json) and served by the FastAPI app.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: E402,F401
