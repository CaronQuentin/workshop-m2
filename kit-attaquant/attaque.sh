#!/usr/bin/env bash
# Lanceur d'attaque via Docker (Linux / macOS). L'image k6 est telechargee depuis
# Docker Hub au premier lancement (connexion Internet requise).
#   ./attaque.sh                                   -> attaque lourde, cible par defaut
#   ./attaque.sh http://192.168.137.1:8088 dos.js  -> cible + script au choix
set -e
cd "$(dirname "$0")"

TARGET="${1:-http://192.168.137.1:8088}"
SCRIPT="${2:-dos-heavy.js}"

echo "=========================================================="
echo "  ATTAQUE ($SCRIPT) - PROJECT RESILIENCE-ALPHA"
echo "  Cible : $TARGET"
echo "=========================================================="

if ! docker version >/dev/null 2>&1; then
  echo "[ERREUR] Docker n'est pas disponible. Installez/demarrez Docker."
  exit 1
fi

# Recuperer l'image k6 depuis Docker Hub si absente (connexion Internet requise).
if ! docker image inspect grafana/k6:latest >/dev/null 2>&1; then
  echo "Telechargement de l'image k6 depuis Docker Hub (une seule fois)..."
  docker pull grafana/k6:latest
fi

echo "Test de connectivite..."
curl -s -o /dev/null -w "  Cible -> HTTP %{http_code}\n" --max-time 5 "$TARGET/api/health" || true

echo "Lancement..."
docker run --rm -v "$PWD:/scripts" grafana/k6 run -e TARGET="$TARGET" "/scripts/$SCRIPT"
echo "Attaque terminee."
