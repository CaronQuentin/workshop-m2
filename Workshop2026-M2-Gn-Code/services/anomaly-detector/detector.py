"""
anomaly-detector — détection non supervisée par Isolation Forest.

Boucle toutes les SCRAPE_INTERVAL s :
  1. construit un vecteur de variables depuis Prometheus (+ Loki pour l'IP dominante) ;
  2. score avec un Isolation Forest entraîné UNIQUEMENT sur du trafic normal ;
  3. après 2 fenêtres anormales consécutives, émet une alerte à la remédiation.

Si aucun modèle pré-entraîné n'est fourni (ml/models/isoforest.joblib), le service
apprend une ligne de base en ligne sur les premières fenêtres (supposées normales),
puis bascule en détection. Le vrai entraînement hors-ligne est dans ml/train.py.
"""
import logging
import os
import re
import time
from collections import Counter

import numpy as np
import requests
from pythonjsonlogger import jsonlogger
from sklearn.ensemble import IsolationForest

log = logging.getLogger("anomaly-detector")
_h = logging.StreamHandler()
_h.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
log.addHandler(_h)
log.setLevel(logging.INFO)

PROM = os.environ["PROMETHEUS_URL"]
LOKI = os.getenv("LOKI_URL", "http://loki:3100")
REMEDIATION = os.environ["REMEDIATION_URL"]
TOKEN = os.environ["REMEDIATION_TOKEN"]
INTERVAL = int(os.getenv("SCRAPE_INTERVAL", "10"))
MODEL_PATH = os.getenv("MODEL_PATH", "/models/isoforest.joblib")
BASELINE_WINDOWS = int(os.getenv("BASELINE_WINDOWS", "24"))   # ~4 min d'apprentissage en ligne
CONSEC = 2                                                    # fenêtres anormales consécutives
COOLDOWN = int(os.getenv("ALERT_COOLDOWN", "60"))

FEATURES = ["rps", "p95_latency", "err5xx_ratio", "top_ip_share"]


def prom(query: str, default=0.0) -> float:
    try:
        r = requests.get(f"{PROM}/api/v1/query", params={"query": query}, timeout=5)
        res = r.json()["data"]["result"]
        return float(res[0]["value"][1]) if res else default
    except Exception:
        return default


def collect_features() -> tuple[np.ndarray, str | None]:
    rps = prom('sum(rate(http_requests_total{path="/payments"}[30s]))')
    p95 = prom('histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{path="/payments"}[30s])) by (le))')
    total = prom('sum(rate(http_requests_total[30s]))')
    err = prom('sum(rate(http_requests_total{status=~"5.."}[30s]))')
    err_ratio = (err / total) if total > 0 else 0.0
    top_ip, top_share = dominant_ip()
    vec = np.array([rps, p95 if np.isfinite(p95) else 0.0, err_ratio, top_share], dtype=float)
    return vec, top_ip


def dominant_ip() -> tuple[str | None, float]:
    """Interroge Loki (logs WAF) pour l'IP source dominante sur 30 s.
    Dégrade proprement si Loki/labels indisponibles."""
    try:
        end = int(time.time() * 1e9)
        start = end - int(30 * 1e9)
        r = requests.get(f"{LOKI}/loki/api/v1/query_range",
                         params={"query": '{container=~".*waf.*"}', "start": start, "end": end, "limit": 2000},
                         timeout=5)
        ips = Counter()
        for stream in r.json().get("data", {}).get("result", []):
            for _, line in stream.get("values", []):
                m = re.search(r"(\d{1,3}(?:\.\d{1,3}){3})", line)
                if m:
                    ips[m.group(1)] += 1
        if not ips:
            return None, 0.0
        top, cnt = ips.most_common(1)[0]
        return top, cnt / sum(ips.values())
    except Exception:
        return None, 0.0


def load_or_bootstrap():
    try:
        import joblib
        model = joblib.load(MODEL_PATH)
        log.info("model_loaded", extra={"path": MODEL_PATH})
        return model, True
    except Exception:
        log.info("model_bootstrap", extra={"windows": BASELINE_WINDOWS,
                 "detail": "pas de modèle pré-entraîné, apprentissage en ligne de la ligne de base"})
        return None, False


def main():
    model, ready = load_or_bootstrap()
    baseline: list[np.ndarray] = []
    consec = 0
    last_alert = 0.0

    while True:
        time.sleep(INTERVAL)
        vec, top_ip = collect_features()

        if not ready:
            baseline.append(vec)
            log.info("baseline_collect", extra={"n": len(baseline), **dict(zip(FEATURES, vec.tolist()))})
            if len(baseline) >= BASELINE_WINDOWS:
                X = np.vstack(baseline)
                model = IsolationForest(n_estimators=200, contamination=0.02, random_state=42).fit(X)
                ready = True
                log.info("model_trained_online", extra={"samples": len(baseline)})
            continue

        pred = int(model.predict(vec.reshape(1, -1))[0])   # -1 = anomalie
        score = float(model.score_samples(vec.reshape(1, -1))[0])
        anomalous = pred == -1
        consec = consec + 1 if anomalous else 0
        log.info("window", extra={**dict(zip(FEATURES, vec.tolist())),
                 "anomalous": anomalous, "score": round(score, 4), "consec": consec})

        if consec >= CONSEC and (time.time() - last_alert) > COOLDOWN:
            # Type estimé : un pic de rps + 5xx concentré sur une IP = flood.
            atype = "flood" if vec[0] > 0 or vec[2] > 0 else "api_down"
            alert = {"type": atype, "score": round(score, 4), "service": "payment-api",
                     "source_ip": top_ip, "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            try:
                r = requests.post(f"{REMEDIATION}/alert", json=alert,
                                  headers={"X-Remediation-Token": TOKEN}, timeout=60)
                log.info("alert_sent", extra={"alert": alert, "response": r.json()})
                last_alert = time.time()
                consec = 0
            except Exception as exc:
                log.error("alert_failed", extra={"error": str(exc)})


if __name__ == "__main__":
    main()
