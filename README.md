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

### Live flights (optional)

The backend serves mock flights by default. To use real OpenSky traffic, create an API client on
your OpenSky account, copy `backend/.env.example` to `backend/.env`, set `FLIGHT_SOURCE=opensky`
and your credentials, then start the backend with the env file:

```powershell
cd backend; .venv\Scripts\uvicorn app.main:app --env-file .env
```

Don't add `--reload` in live mode: every restart refetches and spends credits.

`/health` shows the active source and, for live data, the credit guard's state and remaining
credits. Live data is cached for 90 s, so the daily credits (4,000, 4 per global request) are
only spent while someone is using the app, and a guard pauses refreshing if spending runs high.
Presets and settings: `docs/opensky-credit-guard.md`.

## Checks

```powershell
# backend (from backend/)
.venv\Scripts\python -m pytest
.venv\Scripts\ruff check .; .venv\Scripts\ruff format --check .
.venv\Scripts\mypy app tests

# frontend (from frontend/)
npm run typecheck; npm run lint; npm test; npm run format:check; npm run build
```
