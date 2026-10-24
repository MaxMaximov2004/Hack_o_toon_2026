"""
Доходы юрлиц Ростовской области из открытых данных ФНС -> etl/data/revenue_fns.csv.gz (вход ETL, etl.raw_revenue).

Источник: «Сведения о суммах доходов и расходов по данным бухгалтерской (финансовой) отчетности организации»,
https://www.nalog.gov.ru/opendata/7707329152-revexp/ — ZIP с XML, один релиз = один отчётный год.
Берём два года подряд: последний даёт выручку, пара — рост год к году.

Запуск (из корня репозитория, нужен только Python 3.10+, ~200 МБ трафика, 2–3 минуты):
    python tools/fns/prepare_revenue.py
    python tools/fns/prepare_revenue.py путь/к/архиву1.zip путь/к/архиву2.zip   # уже скачанные архивы

Оставляем ИНН, начинающиеся на 61 (зарегистрированы в Ростовской обл.), и все ИНН из etl/data/rmsp_61.csv.gz
(переехавшие). Только юрлица: по ИП в наборе данных нет. «Доход» — все доходы по отчётности, не строго выручка.
Ведёт: техлид.
"""
import csv
import gzip
import io
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from xml.etree.ElementTree import iterparse

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "etl" / "data" / "revenue_fns.csv.gz"
RMSP = ROOT / "etl" / "data" / "rmsp_61.csv.gz"
REGION_PREFIX = "61"

# Релизы набора 7707329152-revexp: данные за 2024 и 2025 год. Новый год — добавить URL с паспорта набора.
RELEASES = [
    "https://file.nalog.ru/opendata/7707329152-revexp/data-20251225-structure-20180110.zip",   # за 2024
    "https://file.nalog.ru/opendata/7707329152-revexp/data-20260925-structure-20180110.zip",   # за 2025
]


def download(url, folder):
    path = Path(folder) / url.rsplit("/", 1)[1]
    print(f"скачиваю {url}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    return path


def market_inns():
    """ИНН из выгрузки реестра МСП — чтобы не потерять компании с ИНН другого региона."""
    if not RMSP.exists():
        return set()
    with gzip.open(RMSP, "rt", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return {(row.get("inn") or "").strip() for row in reader}


def parse_release(path, keep):
    """-> {inn: (year, income, expense)} по одному архиву. XML разбираем потоком: файлов ~2000, записей ~2,5 млн."""
    rows = {}
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            year = None
            with z.open(name) as xml:
                for _, el in iterparse(io.BufferedReader(xml), events=("end",)):
                    if el.tag != "Документ":
                        continue
                    year = year or int(el.get("ДатаСост")[-4:])          # "31.12.2025"
                    np, dr = el.find("СведНП"), el.find("СведДохРасх")
                    inn = np.get("ИННЮЛ") if np is not None else None
                    if inn and dr is not None and (inn.startswith(REGION_PREFIX) or inn in keep):
                        rows[inn] = (year, dr.get("СумДоход"), dr.get("СумРасход"))
                    el.clear()
    return rows


def main(args):
    keep = market_inns()
    with tempfile.TemporaryDirectory() as tmp:
        paths = [Path(a) for a in args] or [download(url, tmp) for url in RELEASES]
        result = {}
        for path in paths:
            rows = parse_release(path, keep)
            years = {y for y, _, _ in rows.values()}
            print(f"{path.name}: год {sorted(years)}, компаний {len(rows)}", flush=True)
            for inn, (year, income, expense) in rows.items():
                result[(inn, year)] = (income, expense)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["inn", "year", "income", "expense"])                     # колонки etl.raw_revenue
    for (inn, year), (income, expense) in sorted(result.items()):
        w.writerow([inn, year, income or "", expense or ""])
    with open(OUT, "wb") as f, gzip.GzipFile(fileobj=f, mode="wb", mtime=0) as gz:   # mtime=0: без лишних диффов
        gz.write(buf.getvalue().encode("utf-8"))
    print(f"готово: {OUT.relative_to(ROOT)} — {len(result)} строк, {OUT.stat().st_size / 1e6:.1f} МБ")


if __name__ == "__main__":
    main(sys.argv[1:])
