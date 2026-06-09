@echo off
echo Creating admin and rider test accounts...
cd /d "%~dp0"
node seed-admin.js
node seed-rider.js
node scripts\list-users.js
echo.
echo Done. See LOGINS.md in project root for URLs.
pause
