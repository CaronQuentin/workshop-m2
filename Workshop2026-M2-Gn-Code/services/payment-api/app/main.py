"""
payment-api — cœur métier de la plateforme de paiement fictive SWAP.

Endpoints : /health /metrics /me /account /stats /beneficiaries /payments
Exporte les métriques Prometheus (source de la détection ML) et journalise en JSON.
Vérifie les JWT émis par auth-service.
"""
import datetime as dt
import logging
import os
import time
import uuid

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from jose import JWTError, jwt
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from pydantic import BaseModel, Field
from pythonjsonlogger import jsonlogger
from sqlalchemy import func, select, and_, or_

from app.db import Payment, Beneficiary, SessionLocal, init_db, STARTING_BALANCE_CENTS

logger = logging.getLogger("payment-api")
_handler = logging.StreamHandler()
_handler.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
logger.addHandler(_handler)
logger.setLevel(logging.INFO)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = os.getenv("JWT_ALG", "HS256")

REQS = Counter("http_requests_total", "Requêtes HTTP", ["method", "path", "status"])
LAT = Histogram(
    "http_request_duration_seconds", "Latence des requêtes", ["method", "path"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5),
)
PAYMENTS = Counter("payments_total", "Paiements créés", ["result"])

app = FastAPI(title="SWAP payment-api", version="2.0.0")


@app.on_event("startup")
def _startup() -> None:
    for attempt in range(30):
        try:
            init_db()
            seed_beneficiaries()
            logger.info("db_ready", extra={"attempt": attempt})
            return
        except Exception as exc:
            logger.warning("db_wait", extra={"attempt": attempt, "error": str(exc)})
            time.sleep(2)
    raise RuntimeError("base indisponible")


def seed_beneficiaries() -> None:
    """Quelques bénéficiaires fictifs pour que le carnet ne soit pas vide."""
    demo = [
        ("admin", "EDF Énergie", "FR7630006000011234567890189"),
        ("admin", "Loyer SCI Lumière", "FR7612548029981234567890142"),
        ("admin", "Orange SA", "FR7630004000031234567890143"),
    ]
    with SessionLocal() as s:
        if s.scalar(select(func.count()).select_from(Beneficiary)) == 0:
            for owner, name, iban in demo:
                s.add(Beneficiary(owner=owner, name=name, iban=iban))
            s.commit()


@app.middleware("http")
async def observe(request: Request, call_next):
    start = time.perf_counter()
    path = request.url.path
    # Agrège les chemins paramétrés pour des séries lisibles.
    if path.startswith("/payments/") and path != "/payments":
        label = "/payments/{ref}"
    elif path.startswith("/beneficiaries/"):
        label = "/beneficiaries/{id}"
    else:
        label = path
    try:
        response = await call_next(request)
        status = response.status_code
    except Exception:
        REQS.labels(request.method, label, "500").inc()
        LAT.labels(request.method, label).observe(time.perf_counter() - start)
        raise
    REQS.labels(request.method, label, str(status)).inc()
    LAT.labels(request.method, label).observe(time.perf_counter() - start)
    return response


def claims(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "jeton manquant")
    try:
        return jwt.decode(authorization.split(" ", 1)[1], JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(401, "jeton invalide")


def current_account(c: dict = Depends(claims)) -> str:
    return c["sub"]


# ----------------------------------------------------------------- schémas
class PaymentIn(BaseModel):
    amount_cents: int = Field(gt=0, le=10_000_000)
    currency: str = Field(default="EUR", pattern="^[A-Z]{3}$")
    beneficiary_name: str = Field(default="", max_length=128)
    label: str = Field(default="", max_length=160)
    account: str | None = None


class BeneficiaryIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    iban: str = Field(default="", max_length=34)


# ----------------------------------------------------------------- santé & métriques
@app.get("/health")
def health():
    try:
        with SessionLocal() as s:
            s.execute(select(func.now()))
        return {"status": "ok"}
    except Exception as exc:
        return JSONResponse({"status": "degraded", "error": str(exc)}, status_code=503)


@app.get("/metrics")
def metrics():
    return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/me")
def me(c: dict = Depends(claims)):
    return {"username": c["sub"], "role": c.get("role", "user")}


# ----------------------------------------------------------------- compte & stats
def _fake_iban(account: str) -> str:
    n = abs(hash(account)) % (10 ** 11)
    return f"FR76{n:011d}7654321"


@app.get("/account")
def account(acc: str = Depends(current_account)):
    with SessionLocal() as s:
        spent = s.scalar(select(func.coalesce(func.sum(Payment.amount_cents), 0))
                         .where(and_(Payment.account == acc, Payment.status == "captured"))) or 0
    return {
        "account": acc,
        "iban": _fake_iban(acc),
        "currency": "EUR",
        "balance_cents": STARTING_BALANCE_CENTS - int(spent),
        "spent_cents": int(spent),
    }


@app.get("/stats")
def stats(acc: str = Depends(current_account)):
    today = dt.date.today()
    series = []
    with SessionLocal() as s:
        for i in range(6, -1, -1):
            day = today - dt.timedelta(days=i)
            start = dt.datetime.combine(day, dt.time.min, tzinfo=dt.timezone.utc)
            end = start + dt.timedelta(days=1)
            vol = s.scalar(select(func.coalesce(func.sum(Payment.amount_cents), 0))
                           .where(and_(Payment.account == acc, Payment.created_at >= start,
                                       Payment.created_at < end))) or 0
            cnt = s.scalar(select(func.count()).select_from(Payment)
                           .where(and_(Payment.account == acc, Payment.created_at >= start,
                                       Payment.created_at < end))) or 0
            series.append({"date": day.isoformat(), "volume_cents": int(vol), "count": int(cnt)})
        total = s.scalar(select(func.count()).select_from(Payment).where(Payment.account == acc)) or 0
        ok = s.scalar(select(func.count()).select_from(Payment)
                      .where(and_(Payment.account == acc, Payment.status == "captured"))) or 0
    return {
        "today_count": series[-1]["count"],
        "today_volume_cents": series[-1]["volume_cents"],
        "total_count": int(total),
        "success_rate": round(ok / total, 4) if total else 1.0,
        "series": series,
    }


# ----------------------------------------------------------------- bénéficiaires
@app.get("/beneficiaries")
def list_beneficiaries(acc: str = Depends(current_account)):
    with SessionLocal() as s:
        rows = s.scalars(select(Beneficiary).where(Beneficiary.owner == acc)
                         .order_by(Beneficiary.name)).all()
    return [{"id": b.id, "name": b.name, "iban": b.iban} for b in rows]


@app.post("/beneficiaries", status_code=201)
def add_beneficiary(body: BeneficiaryIn, acc: str = Depends(current_account)):
    with SessionLocal() as s:
        b = Beneficiary(owner=acc, name=body.name, iban=body.iban)
        s.add(b); s.commit(); s.refresh(b)
    return {"id": b.id, "name": b.name, "iban": b.iban}


@app.put("/beneficiaries/{bid}")
def edit_beneficiary(bid: int, body: BeneficiaryIn, acc: str = Depends(current_account)):
    with SessionLocal() as s:
        b = s.get(Beneficiary, bid)
        if not b or b.owner != acc:
            raise HTTPException(404, "introuvable")
        b.name, b.iban = body.name, body.iban
        s.commit()
    return {"id": bid, "name": body.name, "iban": body.iban}


@app.delete("/beneficiaries/{bid}", status_code=204)
def delete_beneficiary(bid: int, acc: str = Depends(current_account)):
    with SessionLocal() as s:
        b = s.get(Beneficiary, bid)
        if not b or b.owner != acc:
            raise HTTPException(404, "introuvable")
        s.delete(b); s.commit()


# ----------------------------------------------------------------- paiements
@app.post("/payments", status_code=201)
def create_payment(body: PaymentIn, acc: str = Depends(current_account)):
    ref = f"PAY-{uuid.uuid4().hex[:12]}"
    try:
        with SessionLocal() as s:
            p = Payment(reference=ref, account=body.account or acc,
                        beneficiary_name=body.beneficiary_name, label=body.label,
                        amount_cents=body.amount_cents, currency=body.currency, status="captured")
            s.add(p); s.commit()
        PAYMENTS.labels("ok").inc()
        logger.info("payment_created", extra={"reference": ref, "account": acc})
        return {"reference": ref, "status": "captured", "amount_cents": body.amount_cents,
                "beneficiary_name": body.beneficiary_name}
    except Exception as exc:
        PAYMENTS.labels("error").inc()
        logger.error("payment_error", extra={"error": str(exc)})
        raise HTTPException(500, "échec de création")


@app.get("/payments")
def list_payments(acc: str = Depends(current_account), q: str = "", status: str = "",
                  min_cents: int = 0, max_cents: int = 0, limit: int = 20, offset: int = 0):
    limit = max(1, min(limit, 100))
    conds = [Payment.account == acc]
    if status:
        conds.append(Payment.status == status)
    if min_cents:
        conds.append(Payment.amount_cents >= min_cents)
    if max_cents:
        conds.append(Payment.amount_cents <= max_cents)
    if q:
        like = f"%{q}%"
        conds.append(or_(Payment.reference.ilike(like), Payment.beneficiary_name.ilike(like),
                         Payment.label.ilike(like)))
    with SessionLocal() as s:
        total = s.scalar(select(func.count()).select_from(Payment).where(and_(*conds))) or 0
        rows = s.scalars(select(Payment).where(and_(*conds))
                         .order_by(Payment.id.desc()).limit(limit).offset(offset)).all()
    return {
        "total": int(total),
        "items": [{"reference": r.reference, "beneficiary_name": r.beneficiary_name,
                   "label": r.label, "amount_cents": r.amount_cents, "currency": r.currency,
                   "status": r.status, "created_at": r.created_at.isoformat() if r.created_at else None}
                  for r in rows],
    }


@app.get("/payments/{ref}")
def get_payment(ref: str, acc: str = Depends(current_account)):
    with SessionLocal() as s:
        p = s.scalar(select(Payment).where(Payment.reference == ref))
    if not p:
        raise HTTPException(404, "introuvable")
    return {"reference": p.reference, "account": p.account, "beneficiary_name": p.beneficiary_name,
            "label": p.label, "amount_cents": p.amount_cents, "currency": p.currency,
            "status": p.status, "created_at": p.created_at.isoformat() if p.created_at else None}
