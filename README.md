# AI-enabled Expense Track And Split

This repository contains the frontend (`Client/`) and backend (`backend/`) for an AI-powered finance tracker with receipt OCR, AI parsing, expense tracking, group splitting, and insights.

Structure:

- `Client/`: frontend app (React + Vite)
- `backend/`: FastAPI backend (SQLite by default or Postgres, OpenAI integration, S3 support)

## Quick start

```bash
# backend
cd backend
python -m venv .venv && .venv\Scripts\activate   # or: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # optionally set OPENAI_API_KEY
uvicorn app.main:app --reload

# frontend (new terminal)
cd Client
npm install
npm run dev                 # set VITE_API_URL if the API isn't on http://127.0.0.1:8000
```

## Email verification (OTP)

Sign-up and sign-in are two steps: after the email and password check out, a 6-digit code is emailed and must be entered to finish. Codes expire after 10 minutes, allow 5 attempts, can be resent after 30 seconds, and are capped at 10 per email per hour. They're stored only as keyed hashes. A new account is created only once its code is verified.

Configure outgoing mail on the backend (Gmail example):

```
SMTP_USER=you@gmail.com
SMTP_PASSWORD=<16-character App Password>   # Google Account → Security → 2-Step Verification → App passwords
```

Locally, if SMTP isn't configured, codes are printed to the backend console. In production (Vercel) the server refuses to sign anyone in without working email rather than skipping verification.

## AI features

Every AI feature uses OpenAI when `OPENAI_API_KEY` is set (default model `gpt-4o-mini`). Without a key it falls back to a local rules engine, so the app stays fully usable.

| Feature | Where | With a key | Without a key |
| --- | --- | --- | --- |
| Quick add ("coffee 4.50 at Starbucks yesterday") | Dashboard, Transactions | LLM parsing | Rule-based parser (amounts, `2k`, relative dates, merchants) |
| Finance assistant chat | AI Insights | LLM grounded in a snapshot of your data | Intent-based answers (affordability, budgets, subscriptions, forecasts…) |
| Receipt scanning | Scan | Vision model reads the photo directly | Tesseract OCR + heuristic parser |
| Auto-categorization | Add/edit form, CSV import, quick add | Learns from how *you* categorized each merchant, then keywords | Same |

Analytics that run on your data (no key needed):

- **Safe to spend**: a daily allowance for the rest of the month, after reserving bills that are still due.
- **Financial health score (0–100)**: savings rate, budget discipline, spending stability, and cash buffer, plus a tip for the weakest area.
- **Recurring charge detection**: subscriptions and bills with cadence, next charge date, annual cost, and price-increase alerts.
- **Anomaly detection**: flags expenses that are unusual *for their category* (robust median/MAD z-score).
- **Trend-aware forecast** with a likely range, plus month-end pace and "this month vs usual" by category.
- **What-if simulator**: see what trimming categories is worth per month, per year, and invested over 5 years.
- **Budget suggestions** from your spending history, and pace tracking against the calendar.
- **Settle up**: net balances per person across all split bills.
- **CSV import/export**: handles common bank formats (signed amounts or debit/credit columns).

Run backend tests with `cd backend && python -m pytest`.
