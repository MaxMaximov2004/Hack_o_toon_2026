"""Подключение к БД (пул psycopg 3, только SELECT)."""

from contextlib import asynccontextmanager
from decimal import Decimal

from psycopg import Connection, DatabaseError, OperationalError
from psycopg_pool import ConnectionPool

from app.config import settings

_pool: ConnectionPool | None = None


def _make_conn() -> Connection:
    """Создаёт одно соединение с повторами при старте."""
    max_retries = 30
    for attempt in range(max_retries):
        try:
            return Connection.connect(settings.DATABASE_URL, autocommit=True)
        except OperationalError:
            if attempt < max_retries - 1:
                import time
                time.sleep(2)
            else:
                raise


def init_pool() -> None:
    global _pool
    _pool = ConnectionPool(settings.DATABASE_URL, open=True)


def get_conn() -> Connection:
    """Возвращает соединение из пула."""
    assert _pool is not None, "pool not initialized"
    return _pool.connection()


@asynccontextmanager
async def db_pool_context():
    """Асинхронный контекст для пула."""
    if _pool is None:
        raise RuntimeError("DB pool not initialized")
    async with _pool.connection() as conn:
        yield conn


def _scalar(query: str, params: tuple = ()) -> Decimal | None:
    """Выполняет запрос и возвращает одно значение."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone()
            if row is None:
                return None
            v = row[0]
            if isinstance(v, Decimal):
                return v
            return Decimal(str(v))


def _fetchall(query: str, params: tuple = ()) -> list[dict]:
    """Выполняет запрос и возвращает список словарей."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            cols = [d.name for d in cur.description] if cur.description else []
            rows = cur.fetchall()
            return [dict(zip(cols, row)) for row in rows]
