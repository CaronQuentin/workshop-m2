@echo off
setlocal
rem Test 1 : tests unitaires API + auth (pytest) dans un conteneur jetable.
cd /d "%~dp0.."

docker version >nul 2>&1
if errorlevel 1 ( echo [ERREUR] Docker n'est pas demarre. & pause & exit /b 1 )

docker run --rm --network resilience-alpha_app -e BASE=http://waf:8080 ^
  -v "%cd%\tests:/tests:ro" -w /tests python:3.12-slim ^
  sh -c "pip install -q -r requirements-test.txt && pytest -q -p no:cacheprovider"

echo.
pause
