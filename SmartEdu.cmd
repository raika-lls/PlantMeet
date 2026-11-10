@echo off
cd /d "%~dp0SmartEdu"
set "PYEXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%PYEXE%" (
 "%PYEXE%" server.py --browser
) else (
 py -3 server.py --browser
)
if errorlevel 1 pause
