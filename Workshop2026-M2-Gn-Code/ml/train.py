"""
Entraînement hors-ligne du détecteur d'anomalies (Isolation Forest).

Deux sources de données possibles :
  --from-prometheus : collecte des fenêtres réelles sur le démonstrateur (recommandé
                      pour le rendu : lancez le trafic légitime puis ce script) ;
  (défaut)          : jeu simulé réaliste, utile pour développer sans la stack.

Le modèle n'est entraîné QUE sur du trafic normal (non supervisé). On évalue ensuite
sur normal + attaques rejouées, et on écrit un rapport dans tests/results/.

Variables (fenêtre de 10 s) — mêmes que le détecteur en ligne :
  [rps, p95_latency, err5xx_ratio, top_ip_share]
"""
import argparse
import json
import os
import time
from pathlib import Path

import numpy as np
from joblib import dump
from sklearn.ensemble import IsolationForest
from sklearn.metrics import precision_score, recall_score, confusion_matrix

FEATURES = ["rps", "p95_latency", "err5xx_ratio", "top_ip_share"]
ROOT = Path(__file__).resolve().parent.parent
MODEL_OUT = ROOT / "ml" / "models" / "isoforest.joblib"
REPORT_OUT = ROOT / "tests" / "results" / "ml_evaluation.json"


def simulate_normal(n: int, rng) -> np.ndarray:
    """Trafic légitime : rps modéré, latence basse, peu de 5xx, IP bien réparties."""
    rps = rng.normal(8, 2, n).clip(1, None)
    p95 = rng.normal(0.08, 0.02, n).clip(0.01, None)
    err = rng.normal(0.005, 0.004, n).clip(0, 0.05)
    share = rng.normal(0.15, 0.05, n).clip(0.02, 0.4)
    return np.column_stack([rps, p95, err, share])


def simulate_attack(n: int, rng) -> np.ndarray:
    """Flood : rps très élevé, latence qui explose, 5xx nombreux, une IP dominante."""
    rps = rng.normal(120, 30, n).clip(40, None)
    p95 = rng.normal(2.5, 0.8, n).clip(0.5, None)
    err = rng.normal(0.4, 0.15, n).clip(0.1, 1.0)
    share = rng.normal(0.9, 0.05, n).clip(0.6, 1.0)
    return np.column_stack([rps, p95, err, share])


def collect_from_prometheus(url: str, windows: int, interval: int) -> np.ndarray:
    import requests
    def q(expr, d=0.0):
        try:
            r = requests.get(f"{url}/api/v1/query", params={"query": expr}, timeout=5)
            res = r.json()["data"]["result"]
            return float(res[0]["value"][1]) if res else d
        except Exception:
            return d
    rows = []
    print(f"Collecte de {windows} fenêtres (trafic NORMAL attendu)…")
    for i in range(windows):
        total = q('sum(rate(http_requests_total[30s]))')
        err = q('sum(rate(http_requests_total{status=~"5.."}[30s]))')
        rows.append([
            q('sum(rate(http_requests_total{path="/payments"}[30s]))'),
            q('histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{path="/payments"}[30s])) by (le))'),
            (err / total) if total else 0.0,
            0.15,
        ])
        print(f"  {i+1}/{windows}: {rows[-1]}")
        time.sleep(interval)
    return np.array(rows, dtype=float)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-prometheus", metavar="URL",
                    help="collecte le trafic normal réel, ex: http://localhost:8080 n'est pas Prom ; utilisez le réseau obs")
    ap.add_argument("--windows", type=int, default=600)
    ap.add_argument("--interval", type=int, default=10)
    args = ap.parse_args()
    rng = np.random.default_rng(42)

    if args.from_prometheus:
        X_normal = collect_from_prometheus(args.from_prometheus, args.windows, args.interval)
        source = "prometheus"
    else:
        X_normal = simulate_normal(args.windows, rng)
        source = "simulé"

    model = IsolationForest(n_estimators=200, contamination=0.02, random_state=42).fit(X_normal)
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    dump(model, MODEL_OUT)
    print(f"Modèle entraîné sur {len(X_normal)} fenêtres ({source}) -> {MODEL_OUT}")

    # Évaluation sur normal (label 0) + attaque (label 1)
    X_val_normal = simulate_normal(300, rng)
    X_val_attack = simulate_attack(100, rng)
    X_val = np.vstack([X_val_normal, X_val_attack])
    y_true = np.array([0] * 300 + [1] * 100)
    y_pred = (model.predict(X_val) == -1).astype(int)   # 1 = anomalie

    report = {
        "source_entrainement": source,
        "fenetres_entrainement": int(len(X_normal)),
        "features": FEATURES,
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "rappel": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "matrice_confusion": confusion_matrix(y_true, y_pred).tolist(),
        "faux_positifs_sur_300_fenetres_normales": int(((y_pred == 1) & (y_true == 0)).sum()),
        "genere_le": time.strftime("%Y-%m-%d %H:%M:%S"),
        "note": "Sur données simulées. Pour le rendu, réentraînez avec --from-prometheus sur du vrai trafic.",
    }
    REPORT_OUT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nRapport -> {REPORT_OUT}")


if __name__ == "__main__":
    main()
