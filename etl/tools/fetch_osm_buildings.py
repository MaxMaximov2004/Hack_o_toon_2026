"""Одноразовая выгрузка зданий Ростовской области из OpenStreetMap (Overpass API; в рантайме ETL сеть не нужна).

    python etl/tools/fetch_osm_buildings.py --user-agent "radar-hackathon (you@example.com)"

Для каждого района и городского округа (admin_level=6) берёт центры зданий внутри его границы — Overpass сам делает
point-in-polygon, поэтому здание соседнего района сюда не попадёт. Хозпостройки, гаражи, руины и военные объекты
отбрасываются. Чтобы файл был компактным, в каждом муниципалитете остаётся не больше --cap зданий (детерминированная
выборка по хэшу координат — плотность застройки сохраняется).

Пишет etl/data/buildings.csv.gz (municipality,lat,lon). Уже скачанные муниципалитеты пропускаются (кэш в --cache),
так что можно прерывать и запускать снова. Результат — закоммитить.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import subprocess
import sys
import time
from pathlib import Path

# Публичный overpass-api.de часто «at capacity» — перебираем зеркала по кругу.
OVERPASS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter",
            "https://overpass.private.coffee/api/interpreter"]
SKIP = {"garage", "garages", "shed", "roof", "ruins", "collapsed", "construction", "military", "bunker", "hut",
        "greenhouse", "parking", "carport", "transformer_tower", "toilets", "kiosk", "no", "abandoned", "proposed"}


def overpass(query, ua):
    """Через curl: системный Python на macOS (LibreSSL) не договаривается по TLS с overpass-api.de."""
    for attempt in range(1, 10):
        url = OVERPASS[(attempt - 1) % len(OVERPASS)]
        r = subprocess.run(["curl", "-sS", "-m", "600", "-A", ua, "-w", "\n%{http_code}", url,
                            "--data-urlencode", f"data={query}"], capture_output=True, text=True)
        body, _, code = r.stdout.rpartition("\n")
        if r.returncode == 0 and code == "200" and "runtime error" not in body[-2000:]:
            return body
        # 429/504 у публичного Overpass — обычное дело
        print(f"  {url}: HTTP {code or '-'} {r.stderr.strip()[:100]} — повтор {attempt}/9 через {10 * attempt} с")
        time.sleep(10 * attempt)
    raise RuntimeError("Overpass не отвечает")


def our_name(osm_name):
    """'Азовский район' -> 'Азовский р-н', 'городской округ Таганрог' -> 'г. Таганрог' (как в municipalities.json)."""
    n = osm_name.replace("ё", "е").replace("Ё", "Е").strip()
    if n.lower().startswith("городской округ "):
        return "г. " + n[len("городской округ "):]
    if n.lower().startswith("город "):
        return "г. " + n[len("город "):]
    if n.endswith(" район"):
        return n[: -len(" район")] + " р-н"
    return n


def boundaries(ua, cache):
    path = cache / "boundaries.json"
    if not path.exists():
        q = ('[out:json][timeout:120];area["ISO3166-2"="RU-ROS"]->.a;'
             'rel(area.a)["boundary"="administrative"]["admin_level"="6"];out ids tags;')
        elements = json.loads(overpass(q, ua))["elements"]
        if not elements:
            raise RuntimeError("Overpass вернул 0 границ — повторите позже")
        path.write_text(json.dumps(elements, ensure_ascii=False))
    return sorted((our_name(e["tags"]["name"]), e["id"]) for e in json.loads(path.read_text()))


def buildings(rel_id, ua):
    q = (f"[out:csv(::lat,::lon,building;false)][timeout:580];area(id:{3600000000 + rel_id})->.a;"
         "way(area.a)[building];out center;")
    out = []
    for row in csv.reader(io.StringIO(overpass(q, ua)), delimiter="\t"):
        if len(row) < 3 or not row[0] or row[2] in SKIP:
            continue
        out.append((round(float(row[0]), 5), round(float(row[1]), 5)))
    return sorted(set(out))


def thin(points, cap):
    if len(points) <= cap:
        return points
    key = lambda p: hashlib.sha256(f"{p[0]:.5f},{p[1]:.5f}".encode()).hexdigest()
    return sorted(sorted(points, key=key)[:cap])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user-agent", required=True, help='например "radar-hackathon (mail@example.com)"')
    ap.add_argument("--cap", type=int, default=25000, help="максимум зданий на муниципалитет")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "data" / "buildings.csv.gz"))
    ap.add_argument("--cache", default=str(Path(__file__).resolve().parent / ".osm_cache"))
    a = ap.parse_args()
    cache = Path(a.cache)
    cache.mkdir(exist_ok=True)

    known = json.loads((Path(a.out).parent / "municipalities.json").read_text(encoding="utf-8"))
    rels = boundaries(a.user_agent, cache)
    print(f"границ в OSM: {len(rels)}")
    unknown = [n for n, _ in rels if n not in known]
    if unknown:
        print("WARN: нет в municipalities.json (имя в OSM отличается?):", "; ".join(unknown))

    rows = []
    for i, (name, rid) in enumerate(rels, 1):
        part = cache / f"{rid}.json"
        if part.exists():
            pts = [tuple(p) for p in json.loads(part.read_text())]
        else:
            pts = buildings(rid, a.user_agent)
            part.write_text(json.dumps(pts))
            time.sleep(5)
        kept = thin(pts, a.cap)
        print(f"[{i}/{len(rels)}] {name}: зданий {len(pts)}, оставлено {len(kept)}")
        rows += [(name, f"{lat:.5f}", f"{lon:.5f}") for lat, lon in kept]
    total = len(rows)
    with gzip.open(a.out, "wt", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["municipality", "lat", "lon"])
        w.writerows(rows)
    print(f"итого {total} зданий -> {a.out}")
    if unknown:
        sys.exit(1)


if __name__ == "__main__":
    main()
