# Journaux des essais de reprise

Ce dossier reçoit les preuves de fonctionnement à joindre au dossier (§6) :

- `ml_evaluation.json` — généré par `ml/train.py` (précision, rappel, faux positifs).
- `recovery_runs.csv` — une ligne par essai de reprise, à exporter depuis les journaux
  du moteur (`curl http://localhost:8080/remediation/events`). Colonnes suggérées :
  `essai, debut_attaque, alerte, fin_reprise, delai_detection_s, rto_s, resultat`.

Chaque essai de reprise est **horodaté par le moteur**, pas chronométré à la main
(cf. dossier §6). Exportez les événements `alert_received` et `remediation_success`
pour reconstituer les délais.
