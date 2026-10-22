# PROJECT RESILIENCE-ALPHA — Démonstrateur de cyber-résilience à reprise autonome

Plateforme de paiement **fictive** qui se rétablit **sans intervention humaine** après
un incident de sécurité : détection par machine learning → remédiation automatique →
preuve de reprise par une transaction de contrôle.

> Workshop National Bac+5 EPSI — équipe `G<n>`. Remplacez `<n>` par votre numéro.
> Aucune donnée bancaire réelle. Toute action offensive est bornée au SI fictif du groupe.

---

## 1. Ce que fait le démonstrateur

```
PC Attaquant ──(flood HTTP)──►  WAF  ──►  payment-api ──► postgres
                                 │
          métriques + journaux ──┴──► Prometheus / Loki
                                          │
                                   anomaly-detector (Isolation Forest)
                                          │ alerte {type, score, source_ip}
                                          ▼
                                   remediation-engine ──(docker-socket-proxy)──► restart
                                          │  bloque l'IP au WAF, relance l'API
                                          ▼
                                   transaction de contrôle = PREUVE de reprise
```

Un conteneur qui redémarre **ne prouve rien** : l'incident n'est clos qu'après une
transaction de contrôle réussie (authentification + création + relecture d'un paiement).

## 2. Les cinq piliers (tous présents et interconnectés)

| Pilier | Composants dans ce dépôt |
|---|---|
| **Développement** | `payment-api`, `auth-service` (FastAPI), `front` + `dashboard` (React/Tailwind), `remediation-engine` |
| **Infrastructure** | `docker-compose.yml`, `ansible/`, `prometheus` + `loki` + `promtail` + `grafana` |
| **IA / Data** | `anomaly-detector` (Isolation Forest), `ml/train.py`, `rag-assistant` (LangChain + Ollama) |
| **Cybersécurité** | WAF ModSecurity/CRS, `attack/` (k6 + SQLi), Vault, durcissement, `docker-socket-proxy`, SOC Grafana/Loki |
| **Transformation** | EBIOS RM, PCA/PRA, NIS2/DORA → dans le dossier `Workshop2026-M2-G<n>-Dossier.pdf` |

## 3. Prérequis (PC Hôte)

Windows 10/11, Docker Desktop + WSL2, 16 Go RAM (32 recommandé), 50 Go SSD libres.
Point d'accès Windows actif (`RESILIENCE-G<n>`, hôte en `192.168.137.1`).
Pour l'assistant RAG : [Ollama](https://ollama.com) sur l'hôte avec un modèle ≤ 8 Md
(`ollama pull llama3.1:8b` et `ollama pull nomic-embed-text`). L'assistant fonctionne en
mode extractif si Ollama est absent.

## 4. Démarrage

```bash
cp .env.example .env            # puis changez les secrets
docker compose up -d --build    # construit et démarre toute la plateforme
./scripts/smoke_test.sh         # vérifie que tout répond
```

Accès (tout passe par le WAF, seul port publié) :

| Interface | URL |
|---|---|
| Front de paiement | http://localhost:8080/ |
| Dashboard de supervision | http://localhost:8080/dashboard/ |
| Grafana (SOC) | http://localhost:8080/grafana/ (admin / `GRAFANA_ADMIN_PASSWORD`) |
| Événements de remédiation | http://localhost:8080/remediation/events |

Depuis le PC Attaquant, remplacez `localhost` par `192.168.137.1`.

## 5. Dérouler la démonstration (Clip Chrono)

```bash
# (optionnel) trafic légitime de fond, pour des courbes vivantes :
docker compose --profile baseline up -d

# 1) état AVANT
./scripts/control_transaction.sh http://192.168.137.1:8080

# 2) ATTAQUE depuis le PC Attaquant (le script refuse toute cible hors périmètre)
k6 run -e TARGET=http://192.168.137.1:8080 attack/dos.js

# 3) observer : dashboard -> service DÉGRADÉ -> décision de remédiation -> REPRISE VÉRIFIÉE
# 4) état APRÈS (automatique) : la transaction de contrôle du moteur a déjà prouvé la reprise
```

Scénario secondaire (montre la différence disponibilité vs compromission) :
```bash
bash attack/sqli.sh http://192.168.137.1:8080   # attendu : 403 bloqué par le WAF, alerte SOC
```

## 6. Modèle de détection

```bash
cd ml && pip install -r requirements.txt
python train.py                       # données simulées -> ml/models/isoforest.joblib
# Pour le rendu, réentraînez sur du trafic réel :
python train.py --from-prometheus http://localhost:9090 --windows 600
```
Sans modèle fourni, `anomaly-detector` apprend une ligne de base **en ligne** sur ses
premières fenêtres (supposées normales) puis bascule en détection.

## 7. Sécurité intégrée (cf. dossier §7)

- **WAF** seul exposé ; `postgres`/`vault` sans port publié ; réseaux Docker cloisonnés.
- Conteneurs **non-root**, `cap_drop: ALL`, `no-new-privileges`, `read_only` quand possible.
- Secrets dans **Vault** ; aucun secret en clair (`.env` ignoré par Git, seul `.env.example` versionné).
- **Moteur de remédiation** : accès Docker uniquement via `docker-socket-proxy`
  (restart autorisé, pas d'`exec`), jeton obligatoire, **catalogue d'actions fermé**,
  liste blanche (ne bloque jamais l'hôte ni la passerelle).
- Scan d'images recommandé : `trivy image resilience-alpha-payment-api` (voir dossier §7).

## 8. Structure du dépôt

```
services/           payment-api, auth-service, front, dashboard,
                    anomaly-detector, remediation-engine, rag-assistant,
                    waf (ModSecurity/CRS), traffic-generator
observability/      prometheus, loki, promtail, grafana (datasources + dashboard)
ansible/            bootstrap + playbooks de remédiation (IaC)
ml/                 entraînement et évaluation du modèle
attack/             dos.js (k6), sqli.sh — bornés à 192.168.137.1
scripts/            smoke_test, control_transaction, demo, init_db
docs/               openapi.yaml, procedures/ (indexées par le RAG)
tests/results/      preuves d'essais (ML + reprises)
```

## 9. Dépannage

- **WAF ne démarre pas** : la liste de blocage doit exister → `runtime/blocklist/denied.map`
  est livrée initialisée ; ne la supprimez pas.
- **anomaly-detector n'alerte jamais** : attendez la fin de l'apprentissage de base
  (~4 min) visible dans `docker compose logs anomaly-detector`, ou fournissez un modèle.
- **Remédiation sans effet** : vérifiez `docker compose logs remediation-engine` et que
  `docker-socket-proxy` est up.
- **RAG en mode extractif** : Ollama n'est pas joignable depuis le conteneur
  (`host.docker.internal`) — normal hors PC Hôte ; l'assistant reste fonctionnel.

---
*Les détails de conception, l'analyse de risques et la gouvernance sont dans le dossier d'ingénierie.*
