FROM python:3.12-slim
RUN useradd -r -u 10006 appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
USER appuser
EXPOSE 8800
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8800"]
