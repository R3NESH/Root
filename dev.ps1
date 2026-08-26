# Single command to launch both FastAPI Backend & Next.js Frontend in separate dev windows
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting Backend...'; cd backend; .venv\Scripts\python.exe -m uvicorn api.main:app --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting Frontend...'; cd frontend; npm run dev"
Write-Host "Launched backend on http://localhost:8000 and frontend on http://localhost:3000" -ForegroundColor Green
