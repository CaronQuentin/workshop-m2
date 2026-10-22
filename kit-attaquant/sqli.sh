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

# L'injection vise le PARAMÈTRE DE CONSULTATION ?q= (ARGS), que l'OWASP CRS
# inspecte. Mettre la charge dans le CHEMIN d'URL ne déclenche pas les règles
# SQLi à PARANOIA 1 : la requête passerait le WAF et serait rejetée par l'appli
# (401), ce qui n'est PAS le blocage attendu.
echo "== Injection SQL sur le paramètre ?q= de /api/payments (attendu : 403 bloqué par le WAF) =="
PAYLOADS=(
  "1' OR '1'='1"
  "1; DROP TABLE payments;--"
  "1 UNION SELECT username,password_hash FROM users--"
)
blocked=0; total=0
for p in "${PAYLOADS[@]}"; do
  total=$((total + 1))
  enc=$(python -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$p")
  # '|| true' : ModSecurity ferme la connexion sur blocage, ce qui fait sortir curl
  # en erreur d'écriture APRÈS avoir imprimé le code. On garde le code, on ignore l'exit.
  code=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET/api/payments?q=$enc" || true)
  code=${code:-000}
  if [ "$code" = "403" ]; then mark="BLOQUÉ ✓"; blocked=$((blocked + 1)); else mark="NON bloqué"; fi
  echo "  payload=[$p] -> HTTP $code  $mark"
done
echo "  -> $blocked/$total requête(s) bloquée(s) par le WAF (403)."
echo "Vérifiez l'alerte SOC dans Grafana et les événements WAF dans Loki."
[ "$blocked" -eq "$total" ] || exit 1
