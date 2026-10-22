FROM python:3.12-slim
RUN useradd -r -u 10005 appuser && pip install --no-cache-dir requests==2.32.3
WORKDIR /app
COPY gen.py .
USER appuser
CMD ["python", "-u", "gen.py"]
