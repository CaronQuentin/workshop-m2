"""
remediation-engine — reçoit une alerte, décide une action corrective, l'exécute
puis la VÉRIFIE par une transaction de contrôle. Un conteneur qui redémarre ne
prouve rien : l'incident n'est clos qu'après transaction de contrôle réussie.

Garde-fous (cf. dossier §5 et §7) :
  - accès Docker uniquement via docker-socket-proxy (restart autorisé, pas exec) ;
  - jeton X-Remediation-Token obligatoire sur /alert ;
  - catalogue d'actions FERMÉ (aucune commande arbitraire n'est exécutée) ;
  - liste blanche : ne bloque jamais l'hôte ni la passerelle.
"""
import datetime as dt
import logging
import os
import re
import threading
import time
from collections import deque

import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from pythonjsonlogger import jsonlogger

logger = logging.getLogger("remediation")
_h = logging.StreamHandler()
_h.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
logger.addHandler(_h)
logger.setLevel(logging.INFO)

DOCKER = os.environ["DOCKER_HOST"].replace("tcp://", "http://")  # proxy HTTP Docker
WAF = os.getenv("WAF_CONTAINER", "waf")
API = os.getenv("API_CONTAINER", "payment-api")
WAF_URL = os.getenv("WAF_URL", "http://waf:8080")
PROM = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")
TOKEN = os.environ["REMEDIATION_TOKEN"]
CTL_USER = os.getenv("CTL_USER", "ctl-bot")
CTL_PASSWORD = os.environ["CTL_PASSWORD"]
BLOCKLIST = "/etc/nginx/blocklist/denied.map"

# Jamais bloquées : hôte du point d'accès Windows + passerelles Docker.
# IMPORTANT : tout le trafic local/externe (navigateur, PC Hôte) transite par la
# passerelle Docker (NAT). La bloquer couperait TOUT le monde. On protège donc
# l'ensemble des passerelles Docker (172.16-31.x.1) en plus de l'hôte et localhost.
WHITELIST = {"192.168.137.1", "127.0.0.1"}
_GATEWAY_RE = re.compile(r"^172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.1$")


def is_protected(ip: str) -> bool:
    return ip in WHITELIST or bool(_GATEWAY_RE.match(ip or ""))

_events = deque(maxlen=200)   # journal en mémoire pour le dashboard
_lock = threading.Lock()

# Garantit l'existence de la liste de blocage (robustesse au premier démarrage).
os.makedirs(os.path.dirname(BLOCKLIST), exist_ok=True)
if not os.path.exists(BLOCKLIST):
    with open(BLOCKLIST, "w") as _f:
        _f.write("# IP bloquées (geo nginx), ajoutées par le moteur de remédiation.\n")


def record(kind: str, **data):
    evt = {"ts": dt.datetime.now(dt.timezone.utc).isoformat(), "kind": kind, **data}
    _events.appendleft(evt)
    logger.info(kind, extra=data)
    return evt


# ----------------------------------------------------------------- actions Docker
def docker_restart(container: str, timeout: int = 10) -> bool:
    try:
        r = requests.post(f"{DOCKER}/containers/{container}/restart?t=5", timeout=timeout + 5)
        ok = r.status_code in (204, 304)
        record("docker_restart", container=container, status=r.status_code, ok=ok)
        return ok
    except Exception as exc:
        record("docker_restart_error", container=container, error=str(exc))
        return False


def container_health(container: str) -> str:
    try:
        r = requests.get(f"{DOCKER}/containers/{container}/json", timeout=5)
        state = r.json().get("State", {})
        return state.get("Health", {}).get("Status") or state.get("Status", "unknown")
    except Exception:
        return "unknown"


# ----------------------------------------------------------------- blocage IP (WAF)
def block_ip(ip: str) -> bool:
    if is_protected(ip):
        record("block_skipped_whitelist", ip=ip)
        return False
    try:
        with _lock, open(BLOCKLIST, "r+") as f:
            if any(line.strip().startswith(ip + " ") for line in f):
                record("block_already", ip=ip)
            else:
                f.write(f"{ip} 1;\n")
                record("block_added", ip=ip)
        # Recharge la conf du WAF pour prendre en compte la liste (restart autorisé).
        docker_restart(WAF)
        wait_url(WAF_URL + "/api/health", timeout=20)
        return True
    except Exception as exc:
        record("block_error", ip=ip, error=str(exc))
        return False


def wait_url(url: str, timeout: int = 30) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if requests.get(url, timeout=3).status_code < 500:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


# ----------------------------------------------------------------- transaction de contrôle
def control_transaction() -> dict:
    """Preuve de reprise : s'authentifier, créer un paiement de 1,00 €, le relire,
    le tout À TRAVERS LE WAF (chemin métier réel)."""
    try:
        t0 = time.perf_counter()
        tok = requests.post(f"{WAF_URL}/auth/login",
                            json={"username": CTL_USER, "password": CTL_PASSWORD},
                            timeout=5).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}
        created = requests.post(f"{WAF_URL}/api/payments",
                                json={"amount_cents": 100, "currency": "EUR"},
                                headers=h, timeout=5)
        created.raise_for_status()
        ref = created.json()["reference"]
        read = requests.get(f"{WAF_URL}/api/payments/{ref}", headers=h, timeout=5)
        read.raise_for_status()
        ok = read.json()["reference"] == ref
        dur = round(time.perf_counter() - t0, 3)
        return {"ok": ok, "reference": ref, "duration_s": dur}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ----------------------------------------------------------------- métriques d'incident
# Interrogation de Prometheus pour chiffrer le compte rendu. Dégrade proprement
# (renvoie None) si Prometheus est indisponible : la remédiation n'en dépend pas.
def _prom_range(query: str, start: float, end: float, step: int = 5):
    try:
        r = requests.get(f"{PROM}/api/v1/query_range",
                         params={"query": query, "start": f"{start:.0f}",
                                 "end": f"{end:.0f}", "step": str(step)}, timeout=5)
        data = r.json()["data"]["result"]
        return data[0]["values"] if data else []
    except Exception:
        return []


def _prom_scalar(query: str, at: float):
    try:
        r = requests.get(f"{PROM}/api/v1/query",
                         params={"query": query, "time": f"{at:.0f}"}, timeout=5)
        res = r.json()["data"]["result"]
        return float(res[0]["value"][1]) if res else None
    except Exception:
        return None


def _attack_start(t_alert: float):
    """Premier instant où le rps /payments décolle, dans les 3 min avant l'alerte."""
    series = _prom_range('sum(rate(http_requests_total{path="/payments"}[30s]))',
                         t_alert - 180, t_alert, 5)
    vals = [(float(ts), float(v)) for ts, v in series]
    if not vals:
        return None
    peak = max(v for _, v in vals)
    if peak <= 0:
        return None
    thr = max(peak * 0.3, 15.0)   # 15 rps = bien au-dessus du trafic légitime (~3/s)
    for ts, v in vals:
        if v >= thr:
            return ts
    return None


def build_compte_rendu(a: "Alert", t_alert: float, t_close: float,
                       verif: dict, attempts: int, actions: dict) -> dict:
    """Compte rendu chiffré de l'incident, écrit dans le journal à la clôture."""
    t_start = _attack_start(t_alert)
    detection_s = round(t_alert - t_start, 1) if t_start else None
    reprise_s = round(t_close - t_alert, 1)

    w = int(t_close - (t_start if t_start else t_alert - 60)) + 15
    # 'or vector(0)' : renvoie 0 (et non une série vide) quand il n'y a eu aucun 5xx.
    perdus = _prom_scalar(
        f'(sum(increase(http_requests_total{{method="POST",path="/payments",status=~"5.."}}[{max(1, w)}s])) or vector(0))',
        t_close)

    return {
        "type": a.type,
        "statut": "vérifié" if verif.get("ok") else "escaladé",
        "source_ip": a.source_ip,
        "temps_detection_s": detection_s,
        "temps_reprise_s": reprise_s,
        "mttr_total_s": round(t_close - t_start, 1) if t_start else None,
        "transaction_controle_s": verif.get("duration_s"),
        "tentatives": attempts,
        "paiements_perdus_5xx": round(perdus) if perdus is not None else None,
        "actions": actions,
    }


# ----------------------------------------------------------------- catalogue de playbooks
def playbook_flood(source_ip: str | None) -> dict:
    steps = []
    if source_ip:
        steps.append({"block_ip": block_ip(source_ip)})
    if container_health(API) not in ("healthy", "running"):
        steps.append({"restart_api": docker_restart(API)})
        wait_url(WAF_URL + "/api/health", timeout=30)
    return {"actions": steps}


def playbook_api_down(_: str | None) -> dict:
    ok = docker_restart(API)
    wait_url(WAF_URL + "/api/health", timeout=30)
    return {"actions": [{"restart_api": ok}]}


def playbook_sqli(source_ip: str | None) -> dict:
    # Pas de relance : on bloque et on conserve les preuves (investigation).
    return {"actions": [{"block_ip": block_ip(source_ip) if source_ip else False}],
            "note": "disponibilité non affectée ; réponse = blocage + investigation"}


CATALOG = {"flood": playbook_flood, "dos": playbook_flood,
           "api_down": playbook_api_down, "sqli": playbook_sqli}

app = FastAPI(title="remediation-engine", version="1.0.0")


class Alert(BaseModel):
    type: str
    score: float = 0.0
    service: str = "payment-api"
    source_ip: str | None = None
    timestamp: str | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/services")
def services():
    """État de TOUS les conteneurs de la plateforme (via le docker-socket-proxy).
    Lecture seule : sert à la page de supervision du front."""
    try:
        # Filtre sur les seuls conteneurs de CE projet (pas les autres de la machine).
        r = requests.get(f"{DOCKER}/containers/json", timeout=5, params={
            "all": "1",
            "filters": '{"label":["com.docker.compose.project=resilience-alpha"]}',
        })
        out = []
        for c in r.json():
            name = (c.get("Names") or ["/?"])[0].lstrip("/")
            status = c.get("Status", "")
            health = ("healthy" if "(healthy)" in status else
                      "unhealthy" if "(unhealthy)" in status else
                      "starting" if "(health: starting)" in status else "")
            out.append({"name": name, "state": c.get("State", "unknown"),
                        "status": status, "health": health})
        return sorted(out, key=lambda x: x["name"])
    except Exception as exc:
        record("services_error", error=str(exc))
        return []


@app.get("/events")
def events():
    return list(_events)


@app.post("/alert")
def alert(a: Alert, x_remediation_token: str = Header(default="")):
    if x_remediation_token != TOKEN:
        raise HTTPException(401, "jeton de remédiation invalide")
    t_alert = time.time()   # instant de réception de l'alerte (base du temps de reprise)
    record("alert_received", type=a.type, score=a.score, service=a.service, source_ip=a.source_ip)

    play = CATALOG.get(a.type.lower())
    if not play:
        record("alert_ignored_unknown_type", type=a.type)
        raise HTTPException(422, f"type d'anomalie non pris en charge: {a.type}")

    result = play(a.source_ip)

    # Vérification : jusqu'à 3 tentatives (rejoue l'action max 2 fois), sinon escalade.
    verif = control_transaction()
    attempts = 1
    while not verif["ok"] and attempts < 3:
        record("verify_retry", attempt=attempts, verif=verif)
        result = play(a.source_ip)
        verif = control_transaction()
        attempts += 1

    if verif["ok"]:
        evt = record("remediation_success", type=a.type, attempts=attempts,
                     verification=verif, actions=result)
    else:
        evt = record("remediation_escalated", type=a.type, attempts=attempts,
                     verification=verif, actions=result)
        evt["escalation"] = "intervention opérateur requise — contexte joint"

    # Compte rendu chiffré de l'incident, inscrit dans le journal à la clôture.
    cr = build_compte_rendu(a, t_alert, time.time(), verif, attempts, result)
    record("compte_rendu", **cr)

    return {"status": "verified" if verif["ok"] else "escalated",
            "verification": verif, "actions": result, "attempts": attempts,
            "compte_rendu": cr}
