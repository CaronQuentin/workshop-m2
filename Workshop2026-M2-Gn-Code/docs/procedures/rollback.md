# Procédure — Retour arrière et restauration

## Débloquer une IP (faux positif)
1. Éditer `runtime/blocklist/denied.map` et retirer la ligne `<ip> 1;`.
2. Recharger le WAF : `docker compose restart waf`.
3. Confirmer avec une requête légitime depuis cette source.

## Restaurer la base (décision HUMAINE)
La restauration de données n'est jamais automatique : elle pourrait écraser des
transactions légitimes ou des preuves. Elle est déclenchée par le responsable exploitation.

1. Sauvegarde : `docker compose exec postgres pg_dump -U payuser payments > backup.sql`
2. Restauration : recréer le volume puis `psql < backup.sql`.
3. Contrôle d'intégrité : nombre et somme des transactions identiques à l'attendu.

## Redéploiement complet (perte du PC Hôte)
1. Cloner le dépôt sur la machine de secours.
2. `cp .env.example .env` puis renseigner les secrets (ou `ansible-playbook bootstrap.yml`).
3. `docker compose up -d --build`.
4. `./scripts/smoke_test.sh` doit passer en moins de 15 minutes.
