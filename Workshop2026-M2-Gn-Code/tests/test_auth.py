"""Tests d'authentification (auth-service via le WAF)."""
import requests


def test_login_valide(base):
    r = requests.post(f"{base}/auth/login",
                      json={"username": "demo", "password": "demo1234"}, timeout=5)
    assert r.status_code == 200
    body = r.json()
    assert body.get("access_token"), "un jeton d'accès doit être renvoyé"


def test_login_mauvais_mot_de_passe(base):
    r = requests.post(f"{base}/auth/login",
                      json={"username": "demo", "password": "mauvais"}, timeout=5)
    assert r.status_code == 401


def test_login_utilisateur_inconnu(base):
    r = requests.post(f"{base}/auth/login",
                      json={"username": "fantome", "password": "x"}, timeout=5)
    assert r.status_code == 401


def test_endpoint_protege_sans_jeton(base):
    r = requests.get(f"{base}/api/me", timeout=5)
    assert r.status_code == 401


def test_endpoint_protege_jeton_invalide(base):
    r = requests.get(f"{base}/api/me",
                     headers={"Authorization": "Bearer jeton.invalide.xxx"}, timeout=5)
    assert r.status_code == 401
