#!/usr/bin/env bash
# Vérifie que la plateforme est debout et que la boucle métier fonctionne.
set -uo pipefail
BASE="${1:-http://localhost:8080}"
fail=0
check() { printf "  %-40s" "$1"; if eval "$2" >/dev/null 2>&1; then echo "OK"; else echo "ÉCHEC"; fail=1; fi; }

echo "== Smoke test RESILIENCE-ALPHA ($BASE) =="
check "WAF -> API /health"        "curl -sf $BASE/api/health"
check "WAF -> front"              "curl -sf $BASE/ "
check "WAF -> dashboard"          "curl -sf $BASE/dashboard/"
check "WAF -> grafana"            "curl -sf $BASE/grafana/api/health"
check "auth login"                "curl -sf -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"demo\",\"password\":\"demo1234\"}'"
check "transaction de contrôle"   "bash $(dirname "$0")/control_transaction.sh $BASE"
echo
[ $fail -eq 0 ] && echo "✅ Tous les contrôles passent." || { echo "❌ Au moins un contrôle a échoué."; exit 1; }
