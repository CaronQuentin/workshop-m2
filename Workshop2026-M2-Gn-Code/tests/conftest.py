"""
Fixtures communes aux tests d'API/auth (test 1 du plan de recette).

Les tests tapent la plateforme RÉELLE à travers le WAF (chemin métier), ce qui
prouve le système déployé, pas seulement une fonction isolée.

Base configurable par la variable d'env BASE :
  - depuis l'hôte            : BASE=http://localhost:8088  (défaut)
  - depuis le réseau Docker  : BASE=http://waf:8080
"""
import os

import pytest
import requests

BASE = os.getenv("BASE", "http://localhost:8088")
DEMO_USER = os.getenv("DEMO_USER", "demo")
DEMO_PASS = os.getenv("DEMO_PASS", "demo1234")


@pytest.fixture(scope="session")
def base() -> str:
    return BASE


@pytest.fixture(scope="session")
def token(base) -> str:
    r = requests.post(f"{base}/auth/login",
                      json={"username": DEMO_USER, "password": DEMO_PASS}, timeout=5)
    assert r.status_code == 200, f"login démo impossible: HTTP {r.status_code}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token) -> dict:
    return {"Authorization": f"Bearer {token}"}
