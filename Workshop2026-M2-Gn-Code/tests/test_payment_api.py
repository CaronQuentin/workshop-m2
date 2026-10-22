"""Tests de l'API de paiement (payment-api via le WAF)."""
import requests


def test_health(base):
    r = requests.get(f"{base}/api/health", timeout=5)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_paiement_requiert_authentification(base):
    r = requests.post(f"{base}/api/payments",
                      json={"amount_cents": 100, "currency": "EUR"}, timeout=5)
    assert r.status_code == 401


def test_creation_et_relecture_paiement(base, auth_headers):
    created = requests.post(f"{base}/api/payments",
                            json={"amount_cents": 100, "currency": "EUR"},
                            headers=auth_headers, timeout=5)
    assert created.status_code == 201, created.text
    ref = created.json()["reference"]
    assert ref

    read = requests.get(f"{base}/api/payments/{ref}", headers=auth_headers, timeout=5)
    assert read.status_code == 200
    body = read.json()
    assert body["reference"] == ref
    assert body["amount_cents"] == 100
    assert body["currency"] == "EUR"


def test_montant_negatif_rejete(base, auth_headers):
    r = requests.post(f"{base}/api/payments",
                      json={"amount_cents": -5, "currency": "EUR"},
                      headers=auth_headers, timeout=5)
    assert r.status_code == 422


def test_montant_nul_rejete(base, auth_headers):
    r = requests.post(f"{base}/api/payments",
                      json={"amount_cents": 0, "currency": "EUR"},
                      headers=auth_headers, timeout=5)
    assert r.status_code == 422


def test_devise_invalide_rejetee(base, auth_headers):
    r = requests.post(f"{base}/api/payments",
                      json={"amount_cents": 100, "currency": "euro"},
                      headers=auth_headers, timeout=5)
    assert r.status_code == 422


def test_liste_paiements(base, auth_headers):
    r = requests.get(f"{base}/api/payments?limit=5", headers=auth_headers, timeout=5)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and isinstance(body["items"], list)
    assert "total" in body


def test_paiement_inexistant(base, auth_headers):
    r = requests.get(f"{base}/api/payments/PAY-INEXISTANT-0000", headers=auth_headers, timeout=5)
    assert r.status_code == 404
