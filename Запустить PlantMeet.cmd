@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Для запуска нужен Node.js 24 или новее: https://nodejs.org/
 pause
 exit /b 1
)
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://localhost:4173/api/state' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 (
 start "" http://localhost:4173
 exit /b 0
)
start "" http://localhost:4173
echo PlantMeet работает. Не закрывайте это окно во время занятия.
node server.mjs
pause
