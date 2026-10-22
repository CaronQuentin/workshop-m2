FROM python:3.12-slim

# Durcissement : utilisateur non-root (cf. dossier §7)
RUN useradd -r -u 10001 appuser
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

USER appuser
EXPOSE 8000
# Plusieurs workers : la saturation de ces workers est l'effet visé par le flood.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WORKERS:-2}"]
