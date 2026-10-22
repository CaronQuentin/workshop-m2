#!/usr/bin/env bash
# Transaction de contrôle : preuve que le service métier est utilisable.
# S'authentifie, crée un paiement, le relit — à travers le WAF (chemin réel).
# Usage : ./control_transaction.sh [http://localhost:8080] [user] [pass]
set -euo pipefail
BASE="${1:-http://localhost:8080}"
USER="${2:-demo}"
PASS="${3:-demo1234}"

echo "→ Authentification ($USER)…"
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

echo "→ Création d'un paiement de 1,00 €…"
REF=$(curl -s -X POST "$BASE/api/payments" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"amount_cents":100,"currency":"EUR"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['reference'])")
echo "   référence = $REF"

echo "→ Relecture du paiement…"
curl -s "$BASE/api/payments/$REF" -H "Authorization: Bearer $TOKEN"
echo
echo "✅ Transaction de contrôle réussie."
