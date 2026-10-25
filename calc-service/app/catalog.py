"""Справочники из БД с кэшем 60 с."""

import time
from decimal import Decimal
from typing import Any

from app.db import _fetchall

_CACHE: dict[str, Any] = {}
_CACHE_TTL = 60


def _get(key: str, loader):
    now = time.time()
    entry = _CACHE.get(key)
    if entry and now - entry["ts"] < _CACHE_TTL:
        return entry["data"]
    data = loader()
    _CACHE[key] = {"data": data, "ts": now}
    return data


def _load_regions():
    rows = _fetchall(
        "SELECT id, name, coef::text, reason FROM calc.region_coef ORDER BY id"
    )
    return {
        "regions": [
            {"id": r["id"], "name": r["name"], "coef": float(r["coef"]), "reason": r["reason"]}
            for r in rows
        ]
    }


def _load_levels():
    rows = _fetchall(
        "SELECT code, name, coef::text, description FROM calc.project_level ORDER BY code"
    )
    return {
        "levels": [
            {"code": r["code"], "name": r["name"], "coef": float(r["coef"]), "description": r["description"]}
            for r in rows
        ]
    }


def _load_stages():
    rows = _fetchall(
        "SELECT code, name, share_of_equipment::text, comment FROM calc.work_stage ORDER BY code"
    )
    return {
        "stages": [
            {
                "code": r["code"],
                "name": r["name"],
                "share_of_equipment": float(r["share_of_equipment"]),
                "comment": r["comment"],
            }
            for r in rows
        ]
    }


def _load_components():
    rows = _fetchall(
        "SELECT id, system_group, name, unit, base_price::text, complexity::text, "
        "price_source, price_url, price_date, market_price::text, market_source, market_note, market_url, "
        "market_checked_at FROM calc.component ORDER BY system_group, id"
    )
    groups: dict[str, list[dict]] = {}
    for r in rows:
        g = r["system_group"]
        if g not in groups:
            groups[g] = []
        groups[g].append(
            {
                "id": r["id"],
                "name": r["name"],
                "unit": r["unit"],
                "base_price": float(r["base_price"]),
                "complexity": float(r["complexity"]),
                # Откуда цена (парсер ETL, 08_calc_prices.sql): None — цена из таблицы кейса
                "price_source": r["price_source"],
                "price_url": r["price_url"],
                "price_date": r["price_date"].isoformat() if r["price_date"] else None,
                # Рыночный аналог той же серии (tinko.ru) — для сравнения в калькуляторе
                "market_price": float(r["market_price"]) if r["market_price"] else None,
                "market_source": r["market_source"],
                "market_note": r["market_note"],
                "market_url": r["market_url"],
                "market_checked_at": r["market_checked_at"].isoformat() if r["market_checked_at"] else None,
            }
        )
    return {"components": groups}


def invalidate():
    """Сбросить кэш — после парсинга цен каталог перечитывается сразу, а не через 60 с."""
    _CACHE.clear()


def get_catalog():
    """Возвращает объединённый каталог (регионы, уровни, этапы, компоненты)."""
    regions = _get("regions", _load_regions)
    levels = _get("levels", _load_levels)
    stages = _get("stages", _load_stages)
    components = _get("components", _load_components)
    return {**regions, **levels, **stages, **components}


def validate_region(region_id):
    """Проверяет существование region_id. Возвращает True если существует."""
    data = _get("regions", _load_regions)
    ids = {r["id"] for r in data["regions"]}
    return region_id in ids


def validate_level(level_code):
    data = _get("levels", _load_levels)
    codes = {r["code"] for r in data["levels"]}
    return level_code in codes


def validate_stages(stages_codes):
    data = _get("stages", _load_stages)
    codes = {r["code"] for r in data["stages"]}
    return all(c in codes for c in stages_codes)


def validate_components(component_ids):
    data = _get("components", _load_components)
    all_ids = set()
    for items in data["components"].values():
        for item in items:
            all_ids.add(item["id"])
    return all(c in all_ids for c in component_ids)
