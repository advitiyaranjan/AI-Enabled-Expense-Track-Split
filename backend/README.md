# AI Finance Tracker — Backend

This folder contains a FastAPI backend for the AI Finance Tracker frontend. Features:

- JWT auth (bcrypt)
- PostgreSQL (SQLAlchemy)
- Receipt upload pipeline (S3/local storage, Tesseract OCR fallback, OpenAI parsing)
- Transactions CRUD
- Groups + expense splitting with settlement algorithm
- Insights endpoint (aggregations, simple predictions, anomaly detection)

Quick start (Docker compose):

```bash
cd backend
docker-compose up --build
```

Local development (recommended in virtualenv):

```bash
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
# edit .env to set secrets
uvicorn app.main:app --reload
```

OpenAPI docs: http://localhost:8000/docs
