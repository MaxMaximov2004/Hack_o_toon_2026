"""Экспорт CSV — соглашения из 06-csharp-export.md.

UTF-8 с BOM, разделитель ;, десятичная запятая, даты dd.MM.yyyy,
числа без разделителя тысяч.
"""

import csv
import io
from datetime import datetime, timezone, timedelta
from decimal import Decimal


_MOSCOW = timezone(timedelta(hours=3))


def generate_csv_estimate(data: dict) -> bytes:
    """
    Генерирует CSV-таблицу по данным estimate.
    data — результат calculate_estimate.
    """
    output = io.StringIO()

    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)

    # Заголовок
    writer.writerow(["№", "Наименование", "Ед.изм.", "Кол-во", "Цена за ед.", "Сумма"])

    # Позиции
    for i, item in enumerate(data["items"], 1):
        writer.writerow([
            i,
            item["name"],
            item["unit"],
            item["qty"],
            _fmt_num(item["unitPrice"]),
            _fmt_num(item["lineTotal"]),
        ])

    # Итоги
    writer.writerow([])
    costs = data["costs"]
    writer.writerow(["", "Оборудование", "", "", "", _fmt_num(costs["equipment"])])
    writer.writerow(["", "Работы", "", "", "", _fmt_num(costs["works"])])
    writer.writerow(["", "Прямые затраты", "", "", "", _fmt_num(costs["direct"])])

    writer.writerow([])
    price = data["price"]
    writer.writerow(["Минимум", "", "", "", "", _fmt_num(price["min"])])
    writer.writerow(["Оптимум", "", "", "", "", _fmt_num(price["optimal"])])
    writer.writerow(["Максимум", "", "", "", "", _fmt_num(price["max"])])

    writer.writerow([])
    writer.writerow(["Маржа мин, %", "", "", "", "", _fmt_pct(data["margin"]["minPct"])])
    writer.writerow(["Маржа оптимум, %", "", "", "", "", _fmt_pct(data["margin"]["optimalPct"])])
    writer.writerow(["Маржа макс, %", "", "", "", "", _fmt_pct(data["margin"]["maxPct"])])

    # Водопад
    writer.writerow([])
    writer.writerow(["Водопад"])
    for step in data["breakdown"]:
        writer.writerow([step["label"], "", "", "", "", _fmt_num(step["amount"])])

    content = output.getvalue()

    # UTF-8 с BOM — ровно один: utf-8-sig добавляет его сам
    return content.encode("utf-8-sig")


def _fmt_num(v) -> str:
    """Форматирует число: запятая как разделитель, без разделителя тысяч, 2 знака."""
    if isinstance(v, Decimal):
        v = float(v)
    s = f"{v:.2f}"
    return s.replace(".", ",", 1)


def _fmt_pct(v) -> str:
    """Форматирует процент."""
    s = f"{v:.2f}"
    return s.replace(".", ",", 1)
