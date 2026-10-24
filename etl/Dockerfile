FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY etl/ ./etl/
COPY data/ ./data/
EXPOSE 8084
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8084/health', timeout=2)"
CMD ["python", "-m", "etl", "serve"]
