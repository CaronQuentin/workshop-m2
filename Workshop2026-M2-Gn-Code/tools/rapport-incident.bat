@echo off
setlocal
rem ====== Rapport chiffre du dernier incident (PROJECT RESILIENCE-ALPHA) ======
rem A lancer sur le PC Hote, apres une attaque. Docker Desktop doit tourner.
rem Prometheus et le moteur n'etant pas publies, on execute le script DANS le
rem conteneur remediation-engine (qui voit /events et prometheus:9090).

rem Se placer a la racine du projet (dossier parent de /tools), ou est docker-compose.yml.
cd /d "%~dp0.."

docker version >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Docker n'est pas demarre.
  pause
  exit /b 1
)

type "tools\incident_report.py" | docker compose exec -T remediation-engine python -

echo.
pause
