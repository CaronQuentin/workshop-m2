#!/usr/bin/env bash
# Test 1 du plan de recette : tests unitaires API + auth (pytest).
# Exécute la suite tests/ dans un conteneur jetable rattaché au réseau 'app',
# en tapant la plateforme réelle via le WAF (http://waf:8080).
set -euo pipefail
cd "$(dirname "$0")/.."

NET="${NET:-resilience-alpha_app}"
BASE="${BASE:-http://waf:8080}"

echo "== Tests API/auth (pytest) — réseau $NET, cible $BASE =="
docker run --rm --network "$NET" -e BASE="$BASE" \
  -v "$PWD/tests:/tests:ro" -w /tests python:3.12-slim \
  sh -c "pip install -q -r requirements-test.txt && pytest -q -p no:cacheprovider"
