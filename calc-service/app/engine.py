"""Ядро расчёта: формулы, маржа, водопад, минимум/максимум."""

import json
from decimal import Decimal, ROUND_HALF_UP

from app.catalog import get_catalog
from app.analogs import get_analogs_data


def _round_kop(v):
    """Округляет Decimal до копеек (ROUND_HALF_UP)."""
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def load_pricing_params() -> dict:
    """Загружает параметры расширений из data/pricing_params.json."""
    import os
    path = os.path.join(os.path.dirname(__file__), "..", "data", "pricing_params.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def calculate_estimate(
    region_id,
    level,
    stages,
    items,
    custom_items,
    urgent,
    unique_solution,
    term_months,
    financing,
):
    """
    Считает estimate по формулам ТЗ.
    Возвращает словарь с items, costs, price, margin, breakdown.
    """
    # Конвертируем pydantic-модели в словари
    if items and hasattr(items[0], "model_dump"):
        items = [i.model_dump() for i in items]
    if custom_items and hasattr(custom_items[0], "model_dump"):
        custom_items = [c.model_dump() for c in custom_items]

    params = load_pricing_params()
    catalog = get_catalog()

    unique_markup = Decimal(str(params["unique_markup"])) / 100
    non_standard_markup = Decimal(str(params["non_standard_markup"])) / 100
    max_factor = Decimal(str(params["max_factor"]))
    min_margin = Decimal(str(params["min_margin"]))

    # Загрузка financing rates
    rate_table = params["financing_rates"]
    sorted_terms = sorted(int(k) for k in rate_table.keys())
    rate = Decimal(str(rate_table[str(sorted_terms[-1])])) / 100
    for t in sorted_terms:
        if term_months <= t:
            rate = Decimal(str(rate_table[str(t)])) / 100
            break

    # volume_discount
    volume_table = params["volume_discounts"]
    sorted_vol = sorted(volume_table.keys(), key=int)
    volume_discount = Decimal("0")
    eq_total = Decimal("0")
    for item in items:
        comp = _find_component(item["componentId"], catalog)
        if comp:
            qty = Decimal(str(item["qty"]))
            eq_total += qty * Decimal(str(comp["base_price"])) * Decimal(str(comp["complexity"]))
    for ci in custom_items:
        qty = Decimal(str(ci["qty"]))
        eq_total += qty * Decimal(str(ci["unitPrice"])) * Decimal(str(ci.get("complexity", 1.0)))
    for vol_str in sorted_vol:
        vol = Decimal(vol_str)
        if eq_total >= vol:
            volume_discount = Decimal(str(volume_table[vol_str])) / 100

    # --- 1. equipment ---
    calc_items = []
    equipment = Decimal("0")
    non_standard_total = Decimal("0")

    for item in items:
        comp = _find_component(item["componentId"], catalog)
        qty = Decimal(str(item["qty"]))
        base_price = Decimal(str(comp["base_price"]))
        complexity = Decimal(str(comp["complexity"]))
        line_total = qty * base_price * complexity
        equipment += line_total

        is_ns = item.get("nonStandard", False)
        ns_extra = Decimal("0")
        if is_ns:
            ns_extra = line_total * non_standard_markup
            non_standard_total += ns_extra

        calc_items.append({
            "componentId": item["componentId"],
            "name": comp["name"],
            "unit": comp["unit"],
            "qty": item["qty"],
            "unitPrice": float(base_price),
            "complexity": float(complexity),
            "lineTotal": float(_round_kop(line_total)),
            "nonStandardMarkup": float(_round_kop(ns_extra)) if ns_extra else 0,
            "isNonStandard": is_ns,
        })

    # custom items
    for ci in custom_items:
        qty = Decimal(str(ci["qty"]))
        unit_price = Decimal(str(ci["unitPrice"]))
        complexity = Decimal(str(ci.get("complexity", 1.0)))
        line_total = qty * unit_price * complexity
        equipment += line_total
        non_standard_total += line_total * non_standard_markup

        calc_items.append({
            "name": ci["name"],
            "unit": ci["unit"],
            "qty": ci["qty"],
            "unitPrice": float(unit_price),
            "complexity": float(complexity),
            "lineTotal": float(_round_kop(line_total)),
            "nonStandardMarkup": float(_round_kop(line_total * non_standard_markup)),
            "isNonStandard": True,
            "isCustom": True,
        })

    equipment = _round_kop(equipment)

    # --- 2. works ---
    stage_shares = Decimal("0")
    stage_details = []
    for sc in stages:
        stage = _find_stage(sc, catalog)
        share = Decimal(str(stage["share_of_equipment"]))
        stage_shares += share
        stage_details.append({"code": sc, "name": stage["name"], "share": float(share)})

    works = _round_kop(equipment * stage_shares)

    # --- 3. direct ---
    direct = _round_kop(equipment + works)

    # --- 4. цепочка P1..P6 ---
    region_coef = Decimal(str(_find_region(region_id, catalog)["coef"]))
    level_coef = Decimal(str(_find_level(level, catalog)["coef"]))

    P0 = direct
    P1 = _round_kop(P0 * region_coef)
    P2 = _round_kop(P1 * level_coef)
    P3 = _round_kop(P2 * (Decimal("1.2") if urgent else Decimal("1")))
    P4 = _round_kop(P3 * (1 + unique_markup) if unique_solution else P3)
    P5 = _round_kop(P4 * (1 + rate * Decimal(str(term_months)) / 12))
    P6 = _round_kop(P5 * (1 - volume_discount))

    optimal = P6

    # --- 5. breakdown «водопад» ---
    breakdown = [
        {"key": "direct", "label": "Прямые затраты (себестоимость)", "amount": float(P0)},
        {"key": "region", "label": f"Регион: {_find_region(region_id, catalog)['name']}", "amount": float(_round_kop(P1 - P0))},
        {"key": "level", "label": f"Уровень: {_find_level(level, catalog)['name']}", "amount": float(_round_kop(P2 - P1))},
    ]
    if urgent:
        breakdown.append({"key": "urgent", "label": "Срочность × 1.2", "amount": float(_round_kop(P3 - P2))})
    else:
        breakdown.append({"key": "urgent", "label": "Срочность", "amount": 0})
    if unique_solution:
        breakdown.append({"key": "unique", "label": "Уникальное решение", "amount": float(_round_kop(P4 - P3))})
    else:
        breakdown.append({"key": "unique", "label": "Уникальное решение", "amount": 0})
    breakdown.append({
        "key": "financing",
        "label": f"Финансирование ({financing}, {term_months} мес)",
        "amount": float(_round_kop(P5 - P4)),
    })
    if volume_discount > 0:
        breakdown.append({
            "key": "volume",
            "label": f"Скидка за объём ({float(volume_discount)*100:.1f}%)",
            "amount": -float(_round_kop(P5 * volume_discount)),
        })
    else:
        breakdown.append({"key": "volume", "label": "Скидка за объём", "amount": 0})

    if non_standard_total > 0:
        breakdown.append({
            "key": "non_standard",
            "label": "Наценка за нестандартные позиции",
            "amount": float(_round_kop(non_standard_total)),
        })

    # --- 6. min / max ---
    max_price = _round_kop(optimal * max_factor)

    # --- 7. маржа ---
    def _margin(price_val):
        p = Decimal(str(price_val))
        if p == 0:
            return 0.0
        return float(_round_kop((p - direct) / p * 100))

    min_price = Decimal("0")
    min_basis = ""
    analogs_data = get_analogs_data(optimal)
    analogs_available = analogs_data.get("available", False)

    if analogs_available and analogs_data.get("count", 0) >= 5:
        dist = analogs_data.get("distribution", {})
        p25 = Decimal(str(dist.get("p25", 0)))
        lower = direct * (1 + min_margin)
        upper = optimal * Decimal("0.95")
        min_price = p25
        if min_price < lower:
            min_price = lower
        if min_price > upper:
            min_price = upper
        min_price = _round_kop(min_price)
        min_basis = "analogs_p25"
    else:
        min_price = _round_kop(optimal * Decimal("0.9"))
        min_basis = "fallback_0.9"

    min_margin_pct = _margin(float(min_price))
    optimal_margin_pct = _margin(float(optimal))
    max_margin_pct = _margin(float(max_price))

    # --- 8. кривая ~20 точек ---
    curve = []
    n_points = 20
    low = min_price * Decimal("0.95")
    high = max_price * Decimal("1.05")
    if low == high:
        low = min_price
        high = max_price
    step = (high - low) / (n_points - 1)
    for i in range(n_points):
        p = _round_kop(low + step * i)
        curve.append({"price": float(p), "marginPct": _margin(float(p))})

    # --- 9. assumptions ---
    assumptions = []
    if min_basis == "fallback_0.9":
        assumptions.append("Минимальная цена рассчитана как optimal × 0.9 (аналогов недостаточно)")
    if not analogs_available:
        assumptions.append("Аналоги недоступны — расчёт минимума по запасному правилу")
    assumptions.append(f"Максимальная цена: optimal × {float(max_factor)} (допущение)")
    assumptions.append(f"Наценка за нестандарт: {float(non_standard_markup)*100}%")
    assumptions.append(f"Наценка за уникальное решение: {float(unique_markup)*100}%")

    return {
        "items": calc_items,
        "costs": {
            "equipment": float(equipment),
            "works": float(works),
            "direct": float(direct),
        },
        "price": {
            "min": float(min_price),
            "optimal": float(optimal),
            "max": float(max_price),
            "minBasis": min_basis,
            "urgent": float(P3) if urgent else None,
        },
        "margin": {
            "minPct": min_margin_pct,
            "optimalPct": optimal_margin_pct,
            "maxPct": max_margin_pct,
            "curve": curve,
        },
        "breakdown": breakdown,
        "analogs": analogs_data,
        "assumptions": assumptions,
    }


def _find_component(cid, catalog):
    for items in catalog["components"].values():
        for c in items:
            if c["id"] == cid:
                return c
    return None


def _find_stage(code, catalog):
    for s in catalog["stages"]:
        if s["code"] == code:
            return s
    return None


def _find_region(rid, catalog):
    for r in catalog["regions"]:
        if r["id"] == rid:
            return r
    return None


def _find_level(code, catalog):
    for l in catalog["levels"]:
        if l["code"] == code:
            return l
    return None


def items_total(items, catalog, custom_items, non_standard_markup):
    """Сумма equipment (для volume discount)."""
    total = Decimal("0")
    for item in items:
        comp = _find_component(item["componentId"], catalog)
        if comp:
            qty = Decimal(str(item["qty"]))
            total += qty * Decimal(str(comp["base_price"])) * Decimal(str(comp["complexity"]))
    for ci in custom_items:
        qty = Decimal(str(ci["qty"]))
        total += qty * Decimal(str(ci["unitPrice"])) * Decimal(str(ci.get("complexity", 1.0)))
    return total
