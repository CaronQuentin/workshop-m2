"""
face-auth — reconnaissance faciale PAR UTILISATEUR par EMBEDDINGS profonds.

Moteur : dlib / face_recognition. Chaque visage est transformé en un vecteur de
128 dimensions ; deux visages sont comparés par distance euclidienne. Beaucoup plus
précis que LBPH : la distance sépare nettement une même personne (~0.3-0.45) des
autres (~0.7-0.9). Fonctionne hors-ligne (le modèle dlib est embarqué).

Un fichier d'empreintes (.npy, N×128) par utilisateur, sur /data. Service INTERNE.
"""
import base64
import io
import os
import re
import threading

import face_recognition
import numpy as np
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel

DATA = "/data/users"
# Seuil de DISTANCE (plus bas = plus ressemblant). 0.6 = défaut dlib ; 0.5 = plus strict.
THRESHOLD = float(os.getenv("FACE_THRESHOLD", "0.5"))

os.makedirs(DATA, exist_ok=True)
_lock = threading.Lock()
app = FastAPI(title="face-auth", version="3.0.0")


def _safe(user: str) -> str:
    s = re.sub(r"[^A-Za-z0-9_.-]", "_", user or "")
    if not s:
        raise HTTPException(422, "utilisateur invalide")
    return s


def _path(user: str) -> str:
    return os.path.join(DATA, _safe(user) + ".npy")


def decode_image(data_url: str) -> np.ndarray:
    if "," in data_url and data_url.strip().startswith("data:"):
        data_url = data_url.split(",", 1)[1]
    try:
        raw = base64.b64decode(data_url)
        return np.array(Image.open(io.BytesIO(raw)).convert("RGB"))
    except Exception:
        raise HTTPException(400, "image illisible")


def encode_face(img: np.ndarray):
    """Empreinte 128-D du plus grand visage de l'image (None si aucun visage)."""
    locs = face_recognition.face_locations(img, model="hog")
    if not locs:
        return None
    top, right, bottom, left = max(locs, key=lambda b: (b[2] - b[0]) * (b[1] - b[3]))
    encs = face_recognition.face_encodings(img, [(top, right, bottom, left)])
    return encs[0] if encs else None


class EnrollIn(BaseModel):
    user: str
    images: list[str]


class VerifyIn(BaseModel):
    user: str
    image: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/status")
def status(user: str | None = None):
    if user:
        return {"user": user, "enrolled": os.path.exists(_path(user))}
    enrolled = [f[:-4] for f in os.listdir(DATA) if f.endswith(".npy")]
    return {"enrolled_users": enrolled, "count": len(enrolled), "threshold": THRESHOLD}


@app.post("/enroll")
def enroll(body: EnrollIn):
    encs = [e for e in (encode_face(decode_image(i)) for i in body.images) if e is not None]
    if len(encs) < 2:
        raise HTTPException(422, f"Pas assez de visages nets détectés ({len(encs)}). "
                                 f"Rapprochez-vous, bon éclairage, et réessayez.")
    with _lock:
        np.save(_path(body.user), np.vstack(encs))
    return {"enrolled": True, "user": body.user, "images_utilisees": len(encs)}


@app.post("/verify")
def verify(body: VerifyIn):
    path = _path(body.user)
    if not os.path.exists(path):
        raise HTTPException(409, "aucun visage inscrit pour cet utilisateur")
    enc = encode_face(decode_image(body.image))
    if enc is None:
        return {"match": False, "reason": "aucun visage détecté"}
    known = np.load(path)
    dist = float(face_recognition.face_distance(known, enc).min())
    match = bool(dist <= THRESHOLD)
    return {"match": match, "user": body.user if match else None,
            "distance": round(dist, 3), "threshold": THRESHOLD}
