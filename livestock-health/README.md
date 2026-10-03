# Herd Watch - Livestock Health Early Detection & Management System
React + Vite + Tailwind | FastAPI | PostgreSQL (SQLite locally) | explainable rule engine (no ML, no hardware).
Scoring thresholds are prototype rules, not veterinary diagnostics (see app/rules.py).

## Run locally (two terminals, both from the project root)
Terminal 1 - backend:
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload        # http://localhost:8000/docs

Terminal 2 - frontend:
    cd frontend && npm install && npm run dev   # http://localhost:5173

Then register, open Overview and click "Load demo data". Tests: `pip install pytest && pytest`.

## Deploy to Vercel
1. Create a free Postgres (Neon / Supabase), copy its connection string.
2. Push this folder to GitHub and import the repo in Vercel (root directory = repo root).
3. Add env vars DATABASE_URL and JWT_SECRET (long random string). Deploy.
