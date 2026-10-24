# stage 1: build
FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# stage 2: runtime
FROM python:3.12-slim

RUN groupadd -r calc && useradd -r -g calc calc
WORKDIR /app

COPY --from=builder /install /usr/local
COPY app/ ./app/
COPY data/ ./data/

RUN chown -R calc:calc /app

USER calc

EXPOSE 8085

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8085/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8085", "--log-level", "info"]
