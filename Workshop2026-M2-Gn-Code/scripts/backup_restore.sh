#!/usr/bin/env bash
# Test 8 du plan de recette : sauvegarde et restauration de la base.
#   1. sauvegarde logique de la base (pg_dump, format custom) ;
#   2. relève le nombre et la somme des transactions (empreinte d'intégrité) ;
#   3. simule une perte de données (TRUNCATE de la table payments) ;
#   4. restaure la table depuis la sauvegarde (pg_restore) ;
#   5. recompte : nombre ET somme doivent être identiques -> PASS, sinon FAIL.
#
# La sauvegarde est copiée sur l'hôte dans ./backups/. Les identifiants viennent
# de l'environnement du conteneur postgres (aucun secret en dur).
#
# Variante "suppression du volume" (perte totale) : voir docs/procedures/rollback.md.
set -euo pipefail
cd "$(dirname "$0")/.."

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
DUMP_CONT="/tmp/payments-$TS.dump"
DUMP_HOST="$BACKUP_DIR/payments-$TS.dump"

ex() { docker compose exec -T postgres sh -lc "$1"; }
fingerprint() { ex 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*), coalesce(sum(amount_cents),0) from payments;"' | tr -d '[:space:]'; }

echo "== Sauvegarde / restauration — PROJECT RESILIENCE-ALPHA ($TS) =="

echo "→ 1. Sauvegarde (pg_dump, format custom)…"
ex "pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc -f \"$DUMP_CONT\""
docker compose cp "postgres:$DUMP_CONT" "$DUMP_HOST"
echo "   sauvegarde -> $DUMP_HOST"

BEFORE="$(fingerprint)"
echo "→ 2. Empreinte AVANT (count|sum) : $BEFORE"

echo "→ 3. Simulation de perte : TRUNCATE payments…"
ex 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "TRUNCATE payments RESTART IDENTITY;"' >/dev/null
AFTER_LOSS="$(fingerprint)"
echo "   après perte (count|sum) : $AFTER_LOSS"

echo "→ 4. Restauration depuis la sauvegarde (pg_restore)…"
ex "pg_restore -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -a -t payments \"$DUMP_CONT\"" >/dev/null
AFTER="$(fingerprint)"
echo "→ 5. Empreinte APRÈS restauration (count|sum) : $AFTER"

ex "rm -f \"$DUMP_CONT\"" || true

echo "--------------------------------------------------------"
if [ "$AFTER" = "$BEFORE" ]; then
  echo "✅ PASS — nombre et somme des transactions identiques après restauration."
  exit 0
else
  echo "❌ FAIL — divergence : avant=$BEFORE  après=$AFTER"
  echo "   La sauvegarde reste disponible : $DUMP_HOST"
  exit 1
fi
