"""Trafic légitime : clients fictifs qui se connectent, paient et consultent.
Sert à établir la ligne de base du modèle ML (profil « normal ») et à rendre
les graphiques vivants avant/après l'incident."""
import os
import random
import time

import requests

TARGET = os.getenv("TARGET", "http://waf:8080")
RATE = float(os.getenv("RATE", "5"))   # requêtes/s approximatives


def token():
    try:
        r = requests.post(f"{TARGET}/auth/login",
                          json={"username": "demo", "password": "demo1234"}, timeout=3)
        return r.json().get("access_token", "")
    except Exception:
        return ""


def main():
    tok = token()
    last_login = time.time()
    while True:
        if time.time() - last_login > 600 or not tok:   # jeton court (TTL 15 min)
            tok = token(); last_login = time.time()
        h = {"Authorization": f"Bearer {tok}"}
        try:
            if random.random() < 0.6:
                requests.post(f"{TARGET}/api/payments",
                              json={"amount_cents": random.randint(100, 20000), "currency": "EUR"},
                              headers=h, timeout=3)
            else:
                requests.get(f"{TARGET}/api/payments?limit=5", headers=h, timeout=3)
        except Exception:
            pass
        time.sleep(max(0.01, 1.0 / RATE) * random.uniform(0.5, 1.5))


if __name__ == "__main__":
    main()
