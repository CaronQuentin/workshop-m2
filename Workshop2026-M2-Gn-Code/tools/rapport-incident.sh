#!/usr/bin/env bash
# Rapport chiffré du dernier incident (PROJECT RESILIENCE-ALPHA).
# À lancer sur le PC Hôte, après une attaque. Docker doit tourner.
# Prometheus et le moteur n'étant pas publiés, on exécute le script DANS le
# conteneur remediation-engine (qui voit /events et prometheus:9090).
set -e
cd "$(dirname "$0")/.."   # racine du projet (où est docker-compose.yml)

if ! docker version >/dev/null 2>&1; then
  echo "[ERREUR] Docker n'est pas démarré."
  exit 1
fi

docker compose exec -T remediation-engine python - < tools/incident_report.py
