@echo off
echo Starting Starvia Express Project...

echo.
echo [1/3] Starting PostgreSQL Database via Docker...
docker-compose up -d

echo.
echo [2/3] Starting Backend Server...
start "Starvia Backend" cmd /k "cd backend && npm run dev"

echo.
echo [3/4] Starting Customer Web App...
start "Starvia Web" cmd /k "cd web && npm run dev"

echo.
echo [4/4] Starting Admin Dashboard...
start "Starvia Admin" cmd /k "cd apps\admin && npm run dev"

echo.
echo Project is starting up!
echo - Customer web:  http://localhost:5173
echo - Admin panel:   http://localhost:5174
echo - Backend API:   http://localhost:4000
echo.
echo Login URLs:
echo - Customer: http://localhost:5173/login
echo - Admin:    http://localhost:5174/login
echo.
pause
