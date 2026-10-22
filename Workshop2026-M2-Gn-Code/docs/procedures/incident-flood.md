# Procédure — Déni de service applicatif (flood) sur l'API de paiement

## Symptômes
- Hausse brutale des requêtes/s sur `/payments`.
- Latence p95 qui explose, réponses 5xx et 429, échec des paiements légitimes.
- Une IP source domine le trafic dans les journaux du WAF.

## Réponse automatique (moteur de remédiation)
1. Ajout de l'IP dominante à la liste de blocage du WAF.
2. Limitation de débit sur `/payments` (déjà active, renforcée).
3. Relance de `payment-api` si sa santé reste KO.
4. Vérification par une transaction de contrôle (création + relecture d'un paiement de 1,00 €).

## Vérification manuelle
- Dashboard : l'indicateur « Service de paiement » doit repasser OPÉRATIONNEL.
- `./scripts/control_transaction.sh` doit réussir.
- Grafana : rps, p95 et 5xx reviennent à la normale.

## Si la reprise échoue (escalade)
- Le moteur rejoue l'action au plus deux fois puis escalade avec le contexte complet.
- Vérifier la liste de blocage `runtime/blocklist/denied.map` et l'état du conteneur WAF.
- Ne jamais bloquer manuellement l'IP de l'hôte (192.168.137.1) ni la passerelle.
