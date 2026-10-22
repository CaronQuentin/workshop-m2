# Raccourcis de pilotage. Sous Windows, utilisez Git Bash ou lancez les commandes
# docker compose directement (voir README).

.PHONY: help up down logs baseline smoke train attack sqli clean

help:
	@echo "up       - construit et démarre la plateforme"
	@echo "baseline - démarre aussi le générateur de trafic légitime"
	@echo "smoke    - vérifie que la plateforme répond"
	@echo "train    - entraîne le modèle de détection (données simulées)"
	@echo "attack   - rappelle la commande k6 du flood"
	@echo "down     - arrête tout"

up:
	@test -f .env || cp .env.example .env
	docker compose up -d --build

baseline:
	docker compose --profile baseline up -d

smoke:
	bash scripts/smoke_test.sh http://localhost:8080

train:
	cd ml && pip install -q -r requirements.txt && python train.py

attack:
	@echo "Depuis le PC Attaquant : k6 run -e TARGET=http://192.168.137.1:8080 attack/dos.js"

sqli:
	bash attack/sqli.sh http://localhost:8080

down:
	docker compose down

clean:
	docker compose down -v
