# Airspace Explorer

A kawaii "spot & collect" experience built on live flight traffic. See `docs/plan.md`.

- `backend/` — Python + FastAPI (flight data API)
- `frontend/` — React + TypeScript + Vite

## Setup

```powershell
# backend (Python 3.11+)
cd backend
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"

# frontend (Node 20+)
cd frontend
npm install
```

## Run (two terminals)

```powershell
cd backend;  .venv\Scripts\uvicorn app.main:app --reload   # http://localhost:8000/health
cd frontend; npm run dev                                   # http://localhost:5173
```

## Checks

```powershell
# backend (from backend/)
.venv\Scripts\python -m pytest
.venv\Scripts\ruff check .; .venv\Scripts\ruff format --check .
.venv\Scripts\mypy app tests

# frontend (from frontend/)
npm run typecheck; npm run lint; npm test; npm run format:check; npm run build
```
