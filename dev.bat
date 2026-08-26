@echo off
echo Starting Plot-to-Plan Development Environment...
start "Backend (FastAPI - Port 8000)" cmd /k "cd backend && .venv\Scripts\python.exe -m uvicorn api.main:app --port 8000 --reload"
start "Frontend (Next.js - Port 3000)" cmd /k "cd frontend && npm run dev"
echo Both Backend and Frontend launched!
