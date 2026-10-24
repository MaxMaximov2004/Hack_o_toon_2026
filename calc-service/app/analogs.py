"""Аналоги: получение из core-api (путь B) или fallback."""

import json
import os
import time
from decimal import Decimal

import httpx

from app.config import settings

_cache: dict | None = None
_cache_ts: float = 0
_CACHE_TTL = 600  # 10 минут


def _load_it_share() -> dict[str, Decimal]:
    """Загружает доли ИТ-бюджета по отраслям из pricing_params.json."""
    path = os.path.join(os.path.dirname(__file__), "..", "data", "pricing_params.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {k: Decimal(str(v)) for k, v in data.get("it_share", {}).items()}


def _log_distance(a: Decimal, b: Decimal) -> Decimal:
    """Лог-расстояние между двумя значениями."""
    if a <= 0 or b <= 0:
        return Decimal("999")
    return abs(Decimal(str(a.log10())) - Decimal(str(b.log10())))


def get_analogs_data(optimal_price: Decimal) -> dict:
    """
    Получает данные об аналогах (синхронно).
    Возвращает: {available, source, count, percentile, distribution, nearest}
    """
    global _cache, _cache_ts
    now = time.time()

    # Проверка кэша
    if _cache is not None and now - _cache_ts < _CACHE_TTL:
        return _cache

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(
                f"{settings.CORE_API_URL}/internal/projects",
                headers={"X-Internal-Token": settings.INTERNAL_TOKEN},
            )
            if resp.status_code != 200:
                raise httpx.HTTPStatusError("Not OK", request=resp.request, response=resp)

            projects = resp.json()
            it_share = _load_it_share()

            # Считаем ИТ-бюджеты
            it_budgets = []
            for p in projects:
                amount_mln = Decimal(str(p.get("amountMln", 0)))
                industry = p.get("industry", "other")
                share = it_share.get(industry, Decimal("0.10"))
                it_budget = amount_mln * Decimal("1000000") * share
                it_budgets.append({
                    "id": p.get("id"),
                    "title": p.get("title"),
                    "itBudget": float(it_budget),
                    "industry": industry,
                    "distance": float(_log_distance(optimal_price, it_budget)),
                })

            # Сортируем по близости
            it_budgets.sort(key=lambda x: x["distance"])

            budgets = [b["itBudget"] for b in it_budgets]
            count = len(budgets)

            nearest = it_budgets[:5]

            # Percentiles
            dist = _percentiles(budgets)

            result = {
                "available": True,
                "source": "core-api-invest-projects",
                "count": count,
                "percentile": "budgets_p25",
                "distribution": dist,
                "nearest": [
                    {
                        "id": b["id"],
                        "title": b["title"],
                        "itBudget": b["itBudget"],
                        "industry": b["industry"],
                        "distance": b["distance"],
                    }
                    for b in nearest
                ],
            }

            _cache = result
            _cache_ts = now
            return result

    except Exception:
        # core-api недоступен
        return {
            "available": False,
            "source": None,
            "count": 0,
            "percentile": None,
            "distribution": {},
            "nearest": [],
        }


def _percentiles(values: list[float]) -> dict:
    """Вычисляет p10, p25, p50, p75, p90."""
    if not values:
        return {"p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0}

    sorted_v = sorted(values)
    n = len(sorted_v)

    def _pct(p):
        idx = p / 100 * (n - 1)
        lo = int(idx)
        hi = lo + 1
        if hi >= n:
            return sorted_v[lo]
        frac = idx - lo
        return sorted_v[lo] * (1 - frac) + sorted_v[hi] * frac

    return {
        "p10": round(_pct(10), 2),
        "p25": round(_pct(25), 2),
        "p50": round(_pct(50), 2),
        "p75": round(_pct(75), 2),
        "p90": round(_pct(90), 2),
    }
