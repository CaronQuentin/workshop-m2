FROM python:3.12-slim

# Dépendances système (dlib runtime + traitement d'image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgl1 libgomp1 && rm -rf /var/lib/apt/lists/*

RUN useradd -r -u 10007 appuser
WORKDIR /app

# dlib précompilé (dlib-bin) pour éviter une longue compilation, puis face_recognition
# sans ses deps (on les installe nous-mêmes, dlib étant déjà fourni par dlib-bin).
# setuptools < 81 fournit encore pkg_resources (requis par face_recognition_models).
RUN pip install --no-cache-dir \
      "setuptools==70.3.0" numpy==1.26.4 Pillow==10.4.0 click face-recognition-models==0.3.0 dlib-bin && \
    pip install --no-cache-dir --no-deps face-recognition==1.3.0

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
RUN mkdir -p /data && chown appuser /data
USER appuser
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
