"""Подготовка выгрузки реестра МСП (rmsp.nalog.ru) для ETL.

Склеивает файлы выгрузки (xlsx или csv), чинит ИНН, убирает дубли, оставляет только
Ростовскую область и сверяет результат со списком клиентов Ростелекома из кейса.

Пример (из корня репозитория):
    python3 tools/rmsp/prepare_rmsp.py \
        --active   data-raw/rmsp/active/*.xlsx \
        --excluded data-raw/rmsp/excluded/*.xlsx \
        --clients  infra/db/tools/case.xlsx \
        --out      etl/data/rmsp_61.csv.gz

Результат:
  etl/data/rmsp_61.csv.gz      — CSV (UTF-8, ',', заголовок) для COPY в etl.raw_rmsp
  etl/data/rmsp_61_report.md   — отчёт: сколько строк, дублей, сверка с клиентами

Зависимости: только openpyxl (pip install openpyxl).
"""
import argparse
import collections
import csv
import gzip
import io
import os
import re
import sys

import openpyxl

# Колонки etl.raw_rmsp в порядке таблицы, и как они называются в выгрузке rmsp.nalog.ru.
# Названия совпадают с таблицей кейса (она выгружена оттуда же). Сравнение — без регистра и пробелов по краям,
# достаточно начала названия, т. к. у последней колонки длинный хвост.
COLUMNS = [
    ("src_no", "№ п/п"),
    ("name", "Наименование / ФИО"),
    ("subject_type", "Тип субъекта"),
    ("category", "Категория"),
    ("ogrn", "ОГРН"),
    ("inn", "ИНН"),
    ("okved", "Основной вид деятельности"),
    ("region", "Регион"),
    ("district", "Район"),
    ("city", "Город"),
    ("settlement", "Населенный пункт"),
    ("is_new", "Вновь созданный"),
    ("included_at", "Дата включения в реестр"),
    ("excluded_at", "Дата исключения из реестра"),
    ("phone", "Телефон"),
    ("email", "E-mail"),
    ("website", "WWW"),
    ("has_licenses", "Наличие лицензий"),
    ("innovative", "Производство инновационной"),
    ("partnership", "Участие в программах партнерства"),
    ("social", "Является социальным предприятием"),
    ("employees", "Среднесписочная численность"),
]
OUT_COLS = [c for c, _ in COLUMNS] + ["source_file", "is_excluded"]
REGION_PREFIX = "61"


def norm_header(s):
    return re.sub(r"\s+", " ", str(s or "")).strip().lower().replace("ё", "е")


def map_header(header):
    """Индексы колонок выгрузки -> наши имена. Возвращает (mapping, missing)."""
    h = [norm_header(x) for x in header]
    mapping, missing = {}, []
    for col, title in COLUMNS:
        t = norm_header(title)
        idx = next((i for i, x in enumerate(h) if x == t), None)
        if idx is None:
            idx = next((i for i, x in enumerate(h) if x.startswith(t)), None)
        if idx is None:
            missing.append(title)
        else:
            mapping[col] = idx
    return mapping, missing


def cell(v):
    if v is None:
        return ""
    if hasattr(v, "strftime"):
        return v.strftime("%d.%m.%Y")
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r"\s+", " ", str(v)).strip()


def read_rows(path):
    """Строки файла как списки значений, начиная с заголовка (строка, где есть «ИНН»)."""
    if path.lower().endswith((".xlsx", ".xlsm")):
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        for ws in wb.worksheets:
            ws.reset_dimensions()
            it = ws.iter_rows(values_only=True)
            for row in it:
                if any(norm_header(c) == "инн" for c in row if c is not None):
                    yield list(row)
                    for r in it:
                        yield list(r)
                    return
        raise SystemExit(f"{path}: не нашёл строку заголовка с колонкой «ИНН»")
    # csv: кодировка utf-8 (с BOM) или cp1251, разделитель ; или ,
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "cp1251"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise SystemExit(f"{path}: не удалось определить кодировку")
    first = text.splitlines()[0] if text else ""
    delim = ";" if first.count(";") >= first.count(",") else ","
    found = False
    for row in csv.reader(io.StringIO(text), delimiter=delim):
        if not found and any(norm_header(c) == "инн" for c in row):
            found = True
        if found:
            yield row


def fix_inn(raw, subject_type):
    """Excel любит превращать ИНН в число и терять ведущий ноль. Возвращаем (inn, был_ли_ремонт)."""
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return "", False
    want = 12 if "предприниматель" in subject_type.lower() else 10
    if len(digits) < want:
        return digits.zfill(want), True
    return digits, False


def load(paths, excluded, stats):
    out = []
    for path in paths:
        it = read_rows(path)
        header = next(it)
        mapping, missing = map_header(header)
        if "inn" not in mapping:
            raise SystemExit(f"{path}: нет колонки ИНН")
        if missing:
            stats["warnings"].append(f"{os.path.basename(path)}: нет колонок {', '.join(missing)}")
        n = 0
        for row in it:
            if not any(c not in (None, "") for c in row):
                continue
            rec = {col: cell(row[i]) if i < len(row) else "" for col, i in mapping.items()}
            for col, _ in COLUMNS:
                rec.setdefault(col, "")
            rec["inn"], fixed = fix_inn(rec["inn"], rec["subject_type"])
            if not rec["inn"]:
                stats["no_inn"] += 1
                continue
            if fixed:
                stats["inn_fixed"] += 1
            if not rec["region"].startswith(REGION_PREFIX):
                stats["other_region"] += 1
                continue
            rec["source_file"] = os.path.basename(path)
            rec["is_excluded"] = "true" if excluded else "false"
            out.append(rec)
            n += 1
        stats["files"].append((os.path.basename(path), "исключённые" if excluded else "действующие", n))
    return out


def date_key(s):
    m = re.match(r"(\d{2})\.(\d{2})\.(\d{4})", s or "")
    return (m.group(3), m.group(2), m.group(1)) if m else ("", "", "")


def dedupe(rows, stats):
    """Один ИНН — одна строка. Действующая запись важнее исключённой; среди равных — более поздняя дата включения."""
    best = {}
    for r in rows:
        cur = best.get(r["inn"])
        if cur is None:
            best[r["inn"]] = r
            continue
        stats["duplicates"] += 1
        rank_new = (r["is_excluded"] == "false", date_key(r["included_at"]))
        rank_cur = (cur["is_excluded"] == "false", date_key(cur["included_at"]))
        if rank_new > rank_cur:
            best[r["inn"]] = r
    return list(best.values())


def client_inns(path):
    rows = list(read_rows(path))
    mapping, _ = map_header(rows[0])
    res = {}
    for row in rows[1:]:
        if not any(c not in (None, "") for c in row):
            continue
        inn, _ = fix_inn(cell(row[mapping["inn"]]), cell(row[mapping["subject_type"]]))
        if inn:
            res[inn] = cell(row[mapping["name"]])
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--active", nargs="+", required=True, help="файлы выгрузки ДЕЙСТВУЮЩИХ субъектов МСП")
    ap.add_argument("--excluded", nargs="*", default=[], help="файлы выгрузки ИСКЛЮЧЁННЫХ из реестра (если удалось)")
    ap.add_argument("--clients", required=True, help="таблица кейса (лист МОД1) — клиенты Ростелекома")
    ap.add_argument("--out", required=True, help="куда положить .csv.gz")
    a = ap.parse_args()

    stats = collections.defaultdict(int)
    stats["files"], stats["warnings"] = [], []
    rows = load(a.active, False, stats) + load(a.excluded, True, stats)
    total_read = len(rows)
    rows = dedupe(rows, stats)
    rows.sort(key=lambda r: r["inn"])

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with gzip.open(a.out, "wt", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=OUT_COLS)
        w.writeheader()
        w.writerows(rows)

    by_inn = {r["inn"]: r for r in rows}
    clients = client_inns(a.clients)
    found_active = [i for i in clients if i in by_inn and by_inn[i]["is_excluded"] == "false"]
    found_excl = [i for i in clients if i in by_inn and by_inn[i]["is_excluded"] == "true"]
    not_found = [i for i in clients if i not in by_inn]
    active = sum(1 for r in rows if r["is_excluded"] == "false")
    cats = collections.Counter(r["category"] for r in rows if r["is_excluded"] == "false")
    types = collections.Counter(r["subject_type"] for r in rows if r["is_excluded"] == "false")
    places = collections.Counter((r["district"] or r["city"]) for r in rows if r["is_excluded"] == "false")

    rep = [
        "# Отчёт по выгрузке реестра МСП", "",
        "| Файл | Тип | Строк (Ростовская обл.) |", "| --- | --- | --- |",
        *[f"| {n} | {t} | {c} |" for n, t, c in stats["files"]], "",
        f"- Прочитано строк: {total_read}; дублей ИНН убрано: {stats['duplicates']}; итог: **{len(rows)}**",
        f"- Действующих: **{active}**; исключённых: {len(rows) - active}",
        f"- ИНН с потерянным ведущим нулём (починено): {stats['inn_fixed']}; строк без ИНН: {stats['no_inn']}; "
        f"не Ростовская обл. (отброшено): {stats['other_region']}", "",
        "## Сверка с клиентами Ростелекома (таблица кейса)", "",
        f"- Клиентов в кейсе: {len(clients)}",
        f"- Найдены среди действующих: **{len(found_active)}** — действующие клиенты",
        f"- Найдены среди исключённых: **{len(found_excl)}** — клиент исключён из реестра (дата есть)",
        f"- Не найдены нигде: **{len(not_found)}** — тоже считаем исключёнными, дата неизвестна",
        f"- Не наших (потенциальных) действующих: **{active - len(found_active)}**", "",
        "## Структура рынка (действующие)", "",
        "| Категория | Число |", "| --- | --- |", *[f"| {k or '—'} | {v} |" for k, v in cats.most_common()], "",
        "| Тип | Число |", "| --- | --- |", *[f"| {k or '—'} | {v} |" for k, v in types.most_common()], "",
        "Топ-15 районов/городов:", "", "| Место | Число |", "| --- | --- |",
        *[f"| {k or '—'} | {v} |" for k, v in places.most_common(15)], "",
    ]
    if stats["warnings"]:
        rep += ["## Предупреждения", "", *[f"- {w}" for w in stats["warnings"]], ""]
    if not_found:
        rep += ["## Клиенты, которых нет в реестре (первые 50)", "", "| ИНН | Наименование |", "| --- | --- |",
                *[f"| {i} | {clients[i]} |" for i in not_found[:50]], ""]
    report_path = re.sub(r"\.csv(\.gz)?$", "", a.out) + "_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(rep))

    print(f"готово: {a.out} ({len(rows)} строк, действующих {active})")
    print(f"клиенты: действующих {len(found_active)}, исключённых {len(found_excl)}, не найдено {len(not_found)}")
    print(f"отчёт: {report_path}")
    for w in stats["warnings"]:
        print("ВНИМАНИЕ:", w, file=sys.stderr)


if __name__ == "__main__":
    main()
