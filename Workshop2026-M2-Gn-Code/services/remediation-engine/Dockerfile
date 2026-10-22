FROM python:3.12-slim
RUN useradd -r -u 10003 appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
# Note sécurité : ce conteneur reste root EN INTERNE pour écrire la liste de blocage
# partagée (bind-mount). Il est néanmoins privé de toutes les capacités Linux
# (cap_drop: ALL) et de l'élévation (no-new-privileges) via docker-compose.yml,
# et n'accède au démon Docker qu'à travers le proxy restreint.
EXPOSE 9000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9000"]
