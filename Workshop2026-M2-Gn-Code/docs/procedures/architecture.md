# Procédure — Rappel d'architecture (pour l'assistant opérateur)

- Le **WAF** (Nginx + ModSecurity + OWASP CRS) est le **seul service exposé** (port 8080).
- Derrière lui : `front`, `payment-api`, `auth-service`, `dashboard`, `grafana`.
- Données : `postgres` (aucun port publié) et `vault` (secrets), réseau `data` isolé.
- Observabilité : `prometheus` (métriques), `loki` (journaux), `promtail`, `grafana` (SOC).
- Détection : `anomaly-detector` (Isolation Forest) lit Prometheus/Loki et alerte le moteur.
- Reprise : `remediation-engine` agit sur les conteneurs **via `docker-socket-proxy`**
  (restart autorisé, pas d'exec), protégé par un jeton. Catalogue d'actions fermé.
- Assistant : `rag-assistant` (LangChain + Ollama), **lecture seule**, aucune action.

Chemins exposés par le WAF : `/` (front), `/api/` (API), `/auth/` (auth),
`/dashboard/`, `/grafana/`, `/remediation/events` (lecture seule).
