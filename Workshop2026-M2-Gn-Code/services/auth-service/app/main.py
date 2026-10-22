"""
auth-service — authentifie les comptes fictifs et émet des JWT courts.

Comptes semés (fictifs) :
  - demo / demo1234          : utilisateur de démonstration
  - ctl-bot / <mdp aléatoire>: compte technique de la transaction de contrôle
Les mots de passe sont hachés en bcrypt ; le secret JWT vient de Vault/.env.
"""
import datetime as dt
import logging
import os
import threading
import time

import paho.mqtt.client as mqtt
import requests
from fastapi import Depends, FastAPI, Header, HTTPException
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from pythonjsonlogger import jsonlogger
from sqlalchemy import String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("auth-service")
_h = logging.StreamHandler()
_h.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
logger.addHandler(_h)
logger.setLevel(logging.INFO)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_TTL = int(os.getenv("JWT_TTL_SECONDS", "900"))
CTL_PASSWORD = os.getenv("CTL_PASSWORD", "ctl-" + os.urandom(6).hex())

engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
Session = sessionmaker(bind=engine)
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Consigne additionnelle 1 : 2FA back-office (visage + mot de passe) ---
FACE_AUTH_URL = os.getenv("FACE_AUTH_URL", "http://face-auth:8080")
MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_PUB_USER = os.getenv("MQTT_PUB_USER", "")
MQTT_PUB_PASS = os.getenv("MQTT_PUB_PASS", "")
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "swap/backoffice/led")
BO_MAX = int(os.getenv("BACKOFFICE_MAX_ATTEMPTS", "3"))
BO_BLOCK = int(os.getenv("BACKOFFICE_BLOCK_SECONDS", "30"))
FACE_TOKEN_TTL = 60

# Client MQTT (publication des états de LED, retain pour l'ESP à la connexion).
_mqtt = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="auth-service")
if MQTT_PUB_USER:
    _mqtt.username_pw_set(MQTT_PUB_USER, MQTT_PUB_PASS)

# État du parcours 2FA PAR UTILISATEUR (tentatives, blocage) — logique SERVEUR.
# { username: {"attempts": int, "blocked_until": float} }
_bo: dict[str, dict] = {}
_bo_lock = threading.Lock()


def _bo_state(user: str) -> dict:
    return _bo.setdefault(user, {"attempts": 0, "blocked_until": 0.0})


def led(state: str) -> None:
    """Publie l'état de la LED : OFF, GREEN_BLINK, GREEN_30S, RED_BLINK_10, RED_30S."""
    try:
        _mqtt.publish(MQTT_TOPIC, state, qos=1, retain=True)
        logger.info("led_state", extra={"state": state})
    except Exception as exc:
        logger.warning("led_publish_failed", extra={"error": str(exc), "state": state})


def _mqtt_worker() -> None:
    while True:
        try:
            _mqtt.connect(MQTT_HOST, MQTT_PORT, keepalive=30)
            _mqtt.loop_start()
            logger.info("mqtt_connected", extra={"host": MQTT_HOST})
            led("OFF")
            return
        except Exception as exc:
            logger.warning("mqtt_retry", extra={"error": str(exc)})
            time.sleep(3)


def _blocked_remaining(user: str) -> int:
    rem = _bo_state(user)["blocked_until"] - time.time()
    return int(rem) + 1 if rem > 0 else 0


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    username: Mapped[str] = mapped_column(String(64), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(32), default="user")


app = FastAPI(title="auth-service", version="1.0.0")


@app.on_event("startup")
def seed():
    for attempt in range(30):
        try:
            Base.metadata.create_all(engine)
            with Session() as s:
                if not s.get(User, "demo"):
                    s.add(User(username="demo", password_hash=pwd.hash("demo1234"), role="user"))
                if not s.get(User, "admin"):
                    s.add(User(username="admin", password_hash=pwd.hash("admin"), role="admin"))
                if not s.get(User, "ctl-bot"):
                    s.add(User(username="ctl-bot", password_hash=pwd.hash(CTL_PASSWORD), role="control"))
                s.commit()
            logger.info("users_seeded")
            threading.Thread(target=_mqtt_worker, daemon=True).start()
            return
        except Exception as exc:
            logger.warning("db_wait", extra={"attempt": attempt, "error": str(exc)})
            time.sleep(2)
    raise RuntimeError("base indisponible")


class LoginIn(BaseModel):
    username: str
    password: str


def claims(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "jeton manquant")
    try:
        return jwt.decode(authorization.split(" ", 1)[1], JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(401, "jeton invalide")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/me")
def me(c: dict = Depends(claims)):
    return {"username": c["sub"], "role": c.get("role", "user")}


@app.get("/users")
def users(c: dict = Depends(claims)):
    # Réservé aux administrateurs (espace admin/ops du front).
    if c.get("role") != "admin":
        raise HTTPException(403, "réservé aux administrateurs")
    with Session() as s:
        rows = s.scalars(select(User)).all()
    return [{"username": u.username, "role": u.role} for u in rows]


# ----------------------------------------------------------------- 2FA par utilisateur
class FaceIn(BaseModel):
    username: str
    image: str


class EnrollIn(BaseModel):
    images: list[str]


class BackofficeLoginIn(BaseModel):
    face_token: str
    username: str
    password: str


def _fail(user: str) -> dict:
    """Compte un échec pour l'utilisateur ; verrouille après BO_MAX, pilote la LED."""
    with _bo_lock:
        st = _bo_state(user)
        st["attempts"] += 1
        if st["attempts"] >= BO_MAX:
            st["blocked_until"] = time.time() + BO_BLOCK
            st["attempts"] = 0
            led("RED_30S")
            return {"blocked_seconds": BO_BLOCK}
        left = BO_MAX - st["attempts"]
    led("RED_BLINK_10")
    return {"attempts_left": left}


@app.get("/backoffice/status")
def backoffice_status(username: str = ""):
    exists = False
    enrolled = False
    if username:
        with Session() as s:
            exists = s.get(User, username) is not None
        if exists:
            try:
                enrolled = requests.get(f"{FACE_AUTH_URL}/status", params={"user": username},
                                        timeout=4).json().get("enrolled", False)
            except Exception:
                pass
    return {"exists": exists, "face_enrolled": enrolled,
            "blocked_seconds": _blocked_remaining(username) if username else 0}


@app.post("/backoffice/enroll")
def backoffice_enroll(body: EnrollIn, c: dict = Depends(claims)):
    """Chaque utilisateur enrôle SON propre visage (après connexion standard)."""
    r = requests.post(f"{FACE_AUTH_URL}/enroll", json={"user": c["sub"], "images": body.images}, timeout=30)
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.json().get("detail", "échec de l'inscription"))
    logger.info("face_enrolled", extra={"user": c["sub"]})
    return r.json()


@app.post("/backoffice/face")
def backoffice_face(body: FaceIn):
    """Étape 2 : vérifie le visage de l'utilisateur <username>. LED + anti-bruteforce."""
    user = body.username.strip()
    if not user:
        raise HTTPException(422, "identifiant requis")
    if _blocked_remaining(user) > 0:
        led("RED_30S")
        return {"ok": False, "blocked_seconds": _blocked_remaining(user)}
    with Session() as s:
        exists = s.get(User, user) is not None
    if not exists:
        return {"ok": False, "reason": "identifiant inconnu", **_fail(user)}
    try:
        r = requests.post(f"{FACE_AUTH_URL}/verify", json={"user": user, "image": body.image}, timeout=15)
    except Exception as exc:
        raise HTTPException(502, f"face-auth injoignable : {exc}")
    if r.status_code == 409:
        return {"ok": False, "not_enrolled": True,
                "reason": "Aucun visage enregistré pour cet utilisateur. "
                          "Connectez-vous en standard pour l'enregistrer d'abord."}
    data = r.json()
    logger.info("face_attempt", extra={"user": user, "match": data.get("match"),
                                       "distance": data.get("distance")})
    if data.get("match"):
        with _bo_lock:
            _bo_state(user)["attempts"] = 0
        led("GREEN_BLINK")   # visage reconnu, en attente du mot de passe
        now = dt.datetime.now(dt.timezone.utc)
        ftok = jwt.encode({"face_ok": True, "sub": user, "iat": now,
                           "exp": now + dt.timedelta(seconds=FACE_TOKEN_TTL)}, JWT_SECRET, algorithm=JWT_ALG)
        return {"ok": True, "step": "password", "face_token": ftok}
    logger.warning("face_fail", extra={"user": user, "confidence": data.get("confidence")})
    return {"ok": False, **_fail(user)}


@app.post("/backoffice/login")
def backoffice_login(body: BackofficeLoginIn):
    """Étape 3 : mot de passe (après étape faciale réussie pour CE même utilisateur)."""
    user = body.username.strip()
    try:
        fc = jwt.decode(body.face_token, JWT_SECRET, algorithms=[JWT_ALG])
        if not fc.get("face_ok") or fc.get("sub") != user:
            raise ValueError()
    except Exception:
        led("RED_BLINK_10")
        raise HTTPException(401, "Étape faciale expirée ou invalide. Recommencez.")
    if _blocked_remaining(user) > 0:
        led("RED_30S")
        raise HTTPException(423, f"Compte bloqué. Réessayez dans {_blocked_remaining(user)}s.")
    with Session() as s:
        u = s.get(User, user)
    if not u or not pwd.verify(body.password, u.password_hash):
        res = _fail(user)
        if res.get("blocked_seconds"):
            raise HTTPException(423, f"Trop d'échecs. Compte bloqué {BO_BLOCK // 60} min.")
        raise HTTPException(401, f"Mot de passe invalide. Tentatives restantes : {res.get('attempts_left')}.")
    with _bo_lock:
        _bo_state(user)["attempts"] = 0
    led("GREEN_30S")   # accès accordé
    now = dt.datetime.now(dt.timezone.utc)
    token = jwt.encode({"sub": u.username, "role": u.role, "iat": now,
                        "exp": now + dt.timedelta(seconds=JWT_TTL)}, JWT_SECRET, algorithm=JWT_ALG)
    logger.info("twofa_login_ok", extra={"username": u.username})
    return {"access_token": token, "token_type": "bearer", "expires_in": JWT_TTL}


class RegisterIn(BaseModel):
    username: str
    password: str
    images: list[str]


@app.post("/register", status_code=201)
def register(body: RegisterIn):
    """Création de compte avec enrôlement du visage (inscription publique)."""
    user = body.username.strip()
    if len(user) < 3 or len(body.password) < 4:
        raise HTTPException(422, "Identifiant ≥ 3 caractères et mot de passe ≥ 4 caractères.")
    with Session() as s:
        if s.get(User, user):
            raise HTTPException(409, "Cet identifiant est déjà pris.")
    # Enrôle le visage d'abord : si aucun visage net n'est détecté, on ne crée pas le compte.
    r = requests.post(f"{FACE_AUTH_URL}/enroll", json={"user": user, "images": body.images}, timeout=30)
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.json().get("detail", "Échec de l'enregistrement du visage."))
    with Session() as s:
        s.add(User(username=user, password_hash=pwd.hash(body.password), role="user"))
        s.commit()
    logger.info("user_registered", extra={"user": user})
    return {"username": user, "face_enrolled": True}


@app.post("/login")
def login(body: LoginIn):
    with Session() as s:
        u = s.get(User, body.username)
    if not u or not pwd.verify(body.password, u.password_hash):
        logger.warning("login_failed", extra={"username": body.username})
        raise HTTPException(401, "identifiants invalides")
    now = dt.datetime.now(dt.timezone.utc)
    token = jwt.encode(
        {"sub": u.username, "role": u.role, "iat": now, "exp": now + dt.timedelta(seconds=JWT_TTL)},
        JWT_SECRET, algorithm=JWT_ALG,
    )
    logger.info("login_ok", extra={"username": u.username, "role": u.role})
    return {"access_token": token, "token_type": "bearer", "expires_in": JWT_TTL}
