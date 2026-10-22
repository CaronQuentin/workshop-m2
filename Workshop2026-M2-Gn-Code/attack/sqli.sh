#!/usr/bin/env bash
# Scénario secondaire : tentative d'injection SQL sur un paramètre de consultation.
# Objectif pédagogique : montrer que la réponse N'EST PAS une "reprise" mais un
# BLOCAGE par le WAF (OWASP CRS) + alerte SOC. La disponibilité n'est pas touchée.
#
# Usage :  ./sqli.sh [http://192.168.137.1:8080]
set -euo pipefail

TARGET="${1:-http://192.168.137.1:8080}"
HOST="$(echo "$TARGET" | sed -E 's#https?://##; s#[:/].*##')"

case "$HOST" in
  192.168.137.1|127.0.0.1|localhost|waf) ;;
  *) echo "Cible '$HOST' hors périmètre autorisé. Abandon." >&2; exit 1 ;;
esac

echo "== Injection SQL sur /api/payments/<ref> (attendu : 403 bloqué par le WAF) =="
PAYLOADS=(
  "1' OR '1'='1"
  "1; DROP TABLE payments;--"
  "1 UNION SELECT username,password_hash FROM users--"
)
for p in "${PAYLOADS[@]}"; do
  enc=$(python -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$p")
  code=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET/api/payments/$enc")
  echo "  payload=[$p] -> HTTP $code"
done
echo "Vérifiez l'alerte SOC dans Grafana et les événements WAF dans Loki."
