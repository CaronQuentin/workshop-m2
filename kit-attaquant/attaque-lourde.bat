@echo off
setlocal
rem ====== Lanceur d'attaque LOURDE (flood jusqu'a 800 VUs) via Docker ======
rem Image k6 telechargee depuis Docker Hub au premier lancement (Internet requis).
set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"

rem Cible : PC Hote. Modifiez si besoin, ou passez l'URL en parametre.
set "TARGET=http://192.168.137.1:8088"
if not "%~1"=="" set "TARGET=%~1"

echo ==========================================================
echo   ATTAQUE LOURDE (flood) - PROJECT RESILIENCE-ALPHA
echo   Cible : %TARGET%
echo ==========================================================
echo.

docker version >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Docker n'est pas demarre ou pas installe.
  echo Installez Docker Desktop, lancez-le, puis reessayez.
  echo.
  pause
  exit /b 1
)

rem Recuperer l'image k6 depuis Docker Hub si absente (connexion Internet requise).
docker image inspect grafana/k6:latest >nul 2>&1
if errorlevel 1 (
  echo Telechargement de l'image k6 depuis Docker Hub ^(une seule fois^)...
  docker pull grafana/k6:latest
  echo.
)

rem Test de connectivite avec le curl natif de Windows.
echo Test de connectivite vers la cible...
curl -s -o NUL -w "  Cible -> HTTP %%{http_code}\n" --max-time 5 %TARGET%/api/health 2>NUL
echo.

echo Lancement de l'attaque (environ 105 secondes)...
echo.
docker run --rm -v "%DIR%:/scripts" grafana/k6 run -e TARGET=%TARGET% /scripts/dos-heavy.js

echo.
echo Attaque terminee.
pause
