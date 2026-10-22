@echo off
setlocal
rem Test 8 : sauvegarde + restauration de la base (cycle complet, destructif puis restaure).
rem Appelle le script bash via Git Bash. Docker Desktop doit tourner.
cd /d "%~dp0.."

docker version >nul 2>&1
if errorlevel 1 ( echo [ERREUR] Docker n'est pas demarre. & pause & exit /b 1 )

where bash >nul 2>&1
if errorlevel 1 ( echo [ERREUR] Git Bash introuvable. Lancez scripts\backup_restore.sh depuis Git Bash. & pause & exit /b 1 )

set "MSYS_NO_PATHCONV=1"
bash scripts/backup_restore.sh

echo.
pause
