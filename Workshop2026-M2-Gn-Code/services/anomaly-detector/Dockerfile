FROM python:3.12-slim
RUN useradd -r -u 10004 appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY detector.py .
USER appuser
CMD ["python", "-u", "detector.py"]
