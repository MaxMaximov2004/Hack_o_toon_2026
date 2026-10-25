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


def generate_bitrix_lead(data: dict, client: dict) -> bytes:
    """
    Расчёт -> лид для импорта в Bitrix24 (CRM -> Лиды -> Импорт), те же колонки, что у экспорта Радара
    и Навигатора (docs/tz/06), плюс «Сумма» и «Валюта» — оптимальная цена сделки.
    client — {name, inn?, contact?}; контакт с «@» уходит в e-mail, иначе — в телефон.
    """
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["Название лида", "Название компании", "Сумма", "Валюта", "Рабочий телефон",
                     "Рабочий e-mail", "Источник", "Комментарий"])

    contact = (client.get("contact") or "").strip()
    price, margin = data["price"], data["margin"]
    positions = ", ".join(f"{i['name']} × {i['qty']}" for i in data["items"])
    comment = "; ".join(filter(None, [
        f"ИНН {client['inn']}" if client.get("inn") else "",
        f"минимум {_fmt_num(price['min'])} руб., оптимум {_fmt_num(price['optimal'])} руб., "
        f"максимум {_fmt_num(price['max'])} руб.",
        f"маржа при оптимуме {_fmt_pct(margin['optimalPct'])} %",
        f"позиции: {positions}",
        "расчёт предварительный",
    ]))
    writer.writerow([
        f"Расчёт: {client['name']}",
        client["name"],
        _fmt_num(price["optimal"]),
        "RUB",
        "" if "@" in contact else contact,
        contact if "@" in contact else "",
        "Калькулятор сделок",
        comment,
    ])
    # UTF-8 с BOM — ровно один, как у generate_csv_estimate
    return output.getvalue().encode("utf-8-sig")


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
