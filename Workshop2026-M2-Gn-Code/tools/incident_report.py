"""
incident_report.py — calcule les 3 chiffres clés du dernier incident :
  1. temps de détection   (début du pic d'attaque  -> alerte reçue)
  2. temps de reprise      (alerte reçue            -> incident vérifié clos)
  3. transactions légitimes perdues (POST /payments en 5xx pendant la fenêtre)

CONÇU POUR S'EXÉCUTER À L'INTÉRIEUR DU RÉSEAU DOCKER (conteneur remediation-engine),
car Prometheus et le moteur ne sont PAS publiés sur l'hôte. Lancé par les wrappers
tools/rapport-incident.bat (Windows) et tools/rapport-incident.sh (Linux/macOS).

Aucune dépendance externe : urllib seulement.
"""
import datetime as dt
import json
import sys
import urllib.parse
import urllib.request

REMEDIATION = "http://localhost:9000"   # le moteur lui-même
PROM = "http://prometheus:9090"         # joignable via le réseau 'app'

# Marge ajoutée à la fenêtre d'intégration des 5xx, après la clôture vérifiée.
TAIL_S = 15
# Fenêtre de recherche du début d'attaque avant l'alerte.
PRE_WINDOW_S = 180


def _get(url: str):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.load(r)


def prom_range(query: str, start: float, end: float, step: int = 5):
    qs = urllib.parse.urlencode({"query": query, "start": f"{start:.0f}",
                                 "end": f"{end:.0f}", "step": str(step)})
    data = _get(f"{PROM}/api/v1/query_range?{qs}")["data"]["result"]
    return data[0]["values"] if data else []


def prom_scalar(query: str, at: float) -> float:
    qs = urllib.parse.urlencode({"query": query, "time": f"{at:.0f}"})
    res = _get(f"{PROM}/api/v1/query?{qs}")["data"]["result"]
    return float(res[0]["value"][1]) if res else 0.0


def parse_ts(iso: str) -> float:
    return dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()


def fmt(epoch: float) -> str:
    return dt.datetime.fromtimestamp(epoch, dt.timezone.utc).strftime("%H:%M:%S")


def find_incident(events):
    """events : du plus récent au plus ancien. Renvoie (alert, closure)."""
    closure = None
    for e in events:
        if e.get("kind") in ("remediation_success", "remediation_escalated"):
            closure = e
            break
    if not closure:
        return None, None
    # Première alerte reçue AVANT (en temps) la clôture.
    t_close = parse_ts(closure["ts"])
    alert = None
    for e in events:
        if e.get("kind") == "alert_received" and parse_ts(e["ts"]) <= t_close:
            alert = e
            break
    return alert, closure


def attack_start(t_alert: float) -> float | None:
    """Premier instant où le rps /payments décolle, dans la fenêtre avant l'alerte."""
    series = prom_range('sum(rate(http_requests_total{path="/payments"}[30s]))',
                        t_alert - PRE_WINDOW_S, t_alert, step=5)
    if not series:
        return None
    vals = [(float(ts), float(v)) for ts, v in series]
    peak = max(v for _, v in vals)
    if peak <= 0:
        return None
    threshold = max(peak * 0.3, 15.0)   # 15 rps = bien au-dessus du trafic légitime (~3/s)
    for ts, v in vals:
        if v >= threshold:
            return ts
    return None


def main():
    try:
        events = _get(f"{REMEDIATION}/events")
    except Exception as exc:
        print(f"[ERREUR] /events injoignable : {exc}", file=sys.stderr)
        sys.exit(1)

    alert, closure = find_incident(events)
    if not closure:
        print("Aucun incident clôturé trouvé dans /events. Lance une attaque d'abord.")
        sys.exit(0)

    t_alert = parse_ts(alert["ts"]) if alert else None
    t_close = parse_ts(closure["ts"])
    status = "VÉRIFIÉ" if closure["kind"] == "remediation_success" else "ESCALADÉ (opérateur requis)"
    atype = closure.get("type", "?")
    attempts = closure.get("attempts", "?")
    verif = closure.get("verification", {}) or {}

    t_start = attack_start(t_alert) if t_alert else None

    # Transactions légitimes perdues : POST /payments en 5xx sur la fenêtre d'incident.
    win_start = t_start if t_start else (t_alert - 60 if t_alert else t_close - 120)
    win_end = t_close + TAIL_S
    w = max(1, int(win_end - win_start))
    lost = prom_scalar(
        f'sum(increase(http_requests_total{{method="POST",path="/payments",status=~"5.."}}[{w}s]))',
        win_end)
    attempted = prom_scalar(
        f'sum(increase(http_requests_total{{method="POST",path="/payments"}}[{w}s]))',
        win_end)
    ok = max(0.0, attempted - lost)

    print("=" * 60)
    print(f"  RAPPORT D'INCIDENT — type : {atype}   statut : {status}")
    print("=" * 60)
    if t_start:
        print(f"  Début d'attaque (pic)     : {fmt(t_start)}")
    else:
        print("  Début d'attaque (pic)     : non détecté dans Prometheus")
    if t_alert:
        print(f"  Alerte reçue              : {fmt(t_alert)}")
    print(f"  Incident clôturé          : {fmt(t_close)}")
    print("-" * 60)
    if t_start and t_alert:
        print(f"  1) TEMPS DE DÉTECTION     : {t_alert - t_start:6.1f} s")
    else:
        print("  1) TEMPS DE DÉTECTION     :   n/d (pic non localisé)")
    if t_alert:
        print(f"  2) TEMPS DE REPRISE       : {t_close - t_alert:6.1f} s   "
              f"(tentatives : {attempts}, transaction de contrôle : {verif.get('duration_s', '?')} s)")
    if t_start:
        print(f"  MTTR total (attaque->clos): {t_close - t_start:6.1f} s")
    print("-" * 60)
    print(f"  3) PAIEMENTS LÉGITIMES PERDUS (POST /payments 5xx) : {lost:6.0f}")
    print(f"     sur {attempted:.0f} tentatives pendant la fenêtre dégradée "
          f"({w} s)  ->  ~{ok:.0f} aboutis")
    if attempted > 0:
        print(f"     taux d'échec pendant l'incident : {100 * lost / attempted:4.1f} %")
    print("=" * 60)


if __name__ == "__main__":
    main()
