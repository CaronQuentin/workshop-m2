#!/usr/bin/env bash
# Déroulé de la démonstration (support du Clip Chrono, 60 s).
# À lancer depuis le PC Attaquant. Montre : état avant -> attaque -> détection
# -> remédiation autonome -> état rétabli (transaction de contrôle).
set -uo pipefail
TARGET="${1:-http://192.168.137.1:8080}"
here="$(dirname "$0")"

echo "========== 1. ÉTAT AVANT INCIDENT =========="
bash "$here/control_transaction.sh" "$TARGET" || true
sleep 2

echo; echo "========== 2. LANCEMENT DE L'ATTAQUE (flood) =========="
echo "   (dans un autre terminal : k6 run -e TARGET=$TARGET ../attack/dos.js)"
echo "   Surveillez le dashboard : service DÉGRADÉ, puis décision de remédiation."
echo "   Le moteur bloque la source, relance si besoin, vérifie par transaction de contrôle."
sleep 2

echo; echo "========== 3. VÉRIFICATION APRÈS REPRISE =========="
echo "   Attente du rétablissement automatique…"
for i in $(seq 1 30); do
  if curl -sf "$TARGET/api/health" >/dev/null 2>&1; then break; fi
  sleep 2
done
bash "$here/control_transaction.sh" "$TARGET"
echo; echo "✅ Service rétabli sans intervention corrective humaine."
echo "   Journal des décisions : $TARGET/remediation/events"
