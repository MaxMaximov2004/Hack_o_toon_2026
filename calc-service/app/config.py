"""Конфигурация из переменных окружения."""

import os


class Settings:
    DATABASE_URL: str
    CORE_API_URL: str
    AUTH_JWKS_URL: str
    INTERNAL_TOKEN: str
    ETL_URL: str | None

    def __init__(self) -> None:
        self.DATABASE_URL = os.environ["DATABASE_URL"]
        self.CORE_API_URL = os.environ["CORE_API_URL"]
        self.AUTH_JWKS_URL = os.environ["AUTH_JWKS_URL"]
        self.INTERNAL_TOKEN = os.environ["INTERNAL_TOKEN"]
        # Необязательная: без неё «Обновить цены» отвечает 502, расчёт работает как обычно
        self.ETL_URL = os.environ.get("ETL_URL")


_required = ("DATABASE_URL", "CORE_API_URL", "AUTH_JWKS_URL", "INTERNAL_TOKEN")
missing = [e for e in _required if e not in os.environ]
if missing:
    print(f"FATAL: missing env vars: {', '.join(missing)}")
    exit(1)

settings = Settings()
