# Plan de recette — PROJECT RESILIENCE-ALPHA

Résultats des tests du dossier (§6). Légende : ✅ exécuté et conforme · 🟡 outillé, à rejouer en conditions officielles · ⏳ à exécuter.

| # | Test | Méthode | Critère de succès | Résultat |
|---|------|---------|-------------------|----------|
| 1 | Tests unitaires API et auth | `./scripts/run_tests.sh` (pytest, `tests/`) | 100 % des tests passent | ✅ **13/13 passent** |
| 2 | Parcours de paiement de bout en bout | `./scripts/smoke_test.sh` + `control_transaction.sh` | Paiement créé, relu, présent en base | ✅ **Tous les contrôles OK** |
| 3 | Faux positifs du modèle | 1 h de trafic légitime sans attaque | 0 alerte transmise à la remédiation | 🟡 **À rejouer 1 h** (voir ci-dessous) |
| 4 | Reprise après flood (essai répété) | `attaque-lourde.bat` depuis le PC attaquant, 10× | Reprise sans intervention, RTO < 2 min | 🟡 **MTTR mesuré 93,3 s < 2 min** sur 1 essai réel ; rejouer ×10 |
| 5 | Arrêt brutal de `payment-api` | `docker kill payment-api` en cours de trafic | Relance + transaction de contrôle OK | ⏳ **À exécuter** (playbook `api_down` prêt) |
| 6 | Injection SQL | `kit-attaquant/sqli.sh` (paramètre `?q=`) | Blocage WAF, alerte SOC, données inchangées | ✅ **3/3 bloquées (HTTP 403)** |
| 7 | Redéploiement à neuf | Clone + `docker compose up` + `smoke_test.sh` | Plateforme opérationnelle en < 15 min | 🟡 **Smoke OK** ; rejouer sur machine neuve |
| 8 | Sauvegarde et restauration | `./scripts/backup_restore.sh` | Nombre et somme des transactions identiques | 🟡 **Sauvegarde OK** ; cycle complet à lancer (décision humaine) |

## Détails et preuves

### 1 — Tests unitaires API et auth ✅
`./scripts/run_tests.sh` lance la suite `tests/` (pytest) dans un conteneur jetable, contre la plateforme réelle via le WAF (`http://waf:8080`).
Couverture : santé API, login valide/invalide, endpoint protégé sans/avec jeton invalide (401), création + relecture d'un paiement (201), rejet montant négatif/nul et devise invalide (422), liste, paiement inexistant (404).
**Résultat : `13 passed`.**

### 2 — Parcours de paiement bout en bout ✅
`./scripts/smoke_test.sh http://localhost:8088` : WAF→API /health, front, dashboard, Grafana, login, et transaction de contrôle (login → paiement 1,00 € → relecture). **Tous les contrôles passent.**

### 3 — Faux positifs du modèle 🟡
Démarrer uniquement le trafic légitime (`docker compose --profile baseline up -d traffic-generator`), laisser tourner 1 h **sans attaque**, puis vérifier qu'aucun `alert_received` n'apparaît :
`curl http://localhost:8088/remediation/events | grep alert_received` → doit être vide.
(Le détecteur n'alerte qu'après 2 fenêtres anormales consécutives ; le trafic légitime `RATE=5` reste sous le seuil.)

### 4 — Reprise après flood 🟡 (RTO conforme mesuré)
Lancer `attaque-lourde.bat http://<IP-Hote>:8088` depuis le PC attaquant, 10 fois. Chaque incident est **horodaté par le moteur** : le `compte_rendu` dans `/events` donne détection, reprise et MTTR.
**Essai réel enregistré** : détection 74,6 s · reprise 18,7 s · **MTTR 93,3 s (< 2 min ✅)** · 0 paiement légitime perdu.
Exporter les 10 essais dans `tests/results/recovery_runs.csv`.

### 5 — Arrêt brutal de `payment-api` ⏳
Pendant le trafic : `docker kill payment-api`. Le détecteur émet `api_down`, le playbook redémarre le conteneur et **vérifie par transaction de contrôle**. Vérifier le `remediation_success` + `compte_rendu` dans `/events`.

### 6 — Injection SQL ✅
`kit-attaquant/sqli.sh http://localhost:8088`. Les charges SQLi sont envoyées sur le **paramètre de consultation `?q=`** (inspecté par l'OWASP CRS).
**Résultat : 3/3 requêtes bloquées (HTTP 403).** Disponibilité non affectée. Alerte visible dans Grafana/Loki.
> Note : viser le *chemin* d'URL (`/api/payments/<ref>`) ne déclenche pas les règles SQLi à PARANOIA 1 (réponse 401 de l'appli, pas un blocage WAF) — d'où l'usage du paramètre de requête.

### 7 — Redéploiement à neuf 🟡
Sur une machine neuve : cloner le dépôt, `cp .env.example .env` (renseigner les secrets) ou `ansible-playbook bootstrap.yml`, puis `docker compose up -d --build` et `./scripts/smoke_test.sh`. **Le smoke doit passer en < 15 min.** Smoke validé sur l'hôte courant.

### 8 — Sauvegarde et restauration 🟡
`./scripts/backup_restore.sh` : sauvegarde `pg_dump` → empreinte (nombre|somme) → `TRUNCATE` (simulation de perte) → `pg_restore` → re-contrôle. PASS si nombre **et** somme identiques.
**Sauvegarde validée** : dump dans `backups/`, empreinte `132931|251320512`. Le cycle complet (destructif) est une **décision humaine** (cf. `docs/procedures/rollback.md`) — à lancer manuellement.
