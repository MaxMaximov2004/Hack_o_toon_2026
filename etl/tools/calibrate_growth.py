"""
Калибровка модельного роста выручки по реальным данным ФНС (etl/model.py, GROWTH_BY_INDUSTRY и GROWTH_YOUNG_BONUS).

Берём юрлица, у которых рост по ФНС посчитан честно (model.growth_fns: оба года ≥ 1 млн ₽, пределы −90…+300 %),
сопоставляем с реестром МСП (отрасль по ОКВЭД, дата включения в реестр) и печатаем квартили по отраслям и поправку
на возраст — готовым кодом для model.py.

    cd etl && python tools/calibrate_growth.py

Ограничения (говорим честно): калибровка по юрлицам — у ИП отчётности в ФНС нет; «возраст» — по дате включения в
реестр МСП, у всех компаний старше реестра это 01.08.2016, поэтому различаем только «молодые (до 5 лет) / остальные».
"""
import csv
import gzip
import statistics as st
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from etl import model, normalize as nz  # noqa: E402

DATA = Path(__file__).resolve().parents[1] / "data"
MIN_GROUP = 100   # меньше — квартили шумные, берём общие


def main():
    okved = nz.load_okved_industry(DATA / "okved_industry.csv")
    incomes = {}
    with gzip.open(DATA / "revenue_fns.csv.gz", "rt", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["income"]:
                incomes.setdefault(r["inn"], {})[int(r["year"])] = float(r["income"])
    growth = {}
    for inn, years in incomes.items():
        last = max(years)
        g = model.growth_fns(years[last], years.get(last - 1))
        if g is not None:
            growth[inn] = g

    seen, by_industry, young, old = set(), defaultdict(list), [], []
    with gzip.open(DATA / "rmsp_61.csv.gz", "rt", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            inn = (r["inn"] or "").strip()
            if inn not in growth or inn in seen:
                continue
            seen.add(inn)
            code, _ = nz.split_okved(r["okved"])
            by_industry[nz.industry_of(code, okved)].append(growth[inn])
            d = nz.parse_date(r["included_at"])
            if d is not None:
                (young if model.CURRENT_YEAR - d.year <= model.GROWTH_YOUNG_YEARS else old).append(growth[inn])

    def quartiles(xs):
        q = st.quantiles(xs, n=4)
        return round(q[0], 1), round(q[1], 1), round(q[2], 1)

    everyone = [g for xs in by_industry.values() for g in xs]
    print(f"# юрлиц с ростом ФНС: {len(growth)}, сопоставлено с реестром: {len(seen)}")
    print(f"GROWTH_DEFAULT = {quartiles(everyone)}")
    print("GROWTH_BY_INDUSTRY = {   # (p25, медиана, p75), % год к году")
    for industry, xs in sorted(by_industry.items(), key=lambda t: -len(t[1])):
        if len(xs) >= MIN_GROUP:
            print(f'    "{industry}": {quartiles(xs)},   # n={len(xs)}')
    print("}")
    bonus = round(st.median(young) - st.median(old))
    print(f"GROWTH_YOUNG_BONUS = {bonus}   # медиана молодых {st.median(young):.1f} % (n={len(young)}) "
          f"против {st.median(old):.1f} % (n={len(old)})")


if __name__ == "__main__":
    main()
