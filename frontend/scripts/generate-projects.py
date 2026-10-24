#!/usr/bin/env python3
"""
Генератор фикстур инвестпроектов из ../infra/db/init/03_seed.sql
Создаёт src/mocks/fixtures/projects.json с 63 проектами из базы кейса
"""

import json
import re
import random
from pathlib import Path

# Простой детерминированный RNG на основе seed
def seeded_random(seed):
    random.seed(seed)
    return random.random

# Справочник муниципалитетов с координатами
MUNICIPALITIES = {
    'Азовский район': {'id': 22, 'lat': 47.1167, 'lon': 39.4167},
    'г. Ростов-на-Дону': {'id': 1, 'lat': 47.2357, 'lon': 39.7015},
    'Боковский район': {'id': 23, 'lat': 48.4667, 'lon': 40.9333},
    'Каменский район': {'id': 24, 'lat': 48.3178, 'lon': 40.2595},
    'Неклиновский район': {'id': 25, 'lat': 47.3333, 'lon': 38.6667},
    'Тарасовский район': {'id': 26, 'lat': 48.7833, 'lon': 40.7500},
}

# Справочник отраслей (код → название)
INDUSTRIES = [
    {'code': 'agro', 'name': 'Сельское хозяйство', 'keywords': ['сельско', 'фермер', 'сад', 'овощ', 'рыб', 'молоко', 'корм', 'зерн', 'теплич']},
    {'code': 'manufacturing', 'name': 'Производство', 'keywords': ['завод', 'производст', 'цех']},
    {'code': 'construction', 'name': 'Строительство', 'keywords': ['строительство', 'здани', 'жилого', 'реконструкц']},
    {'code': 'trade', 'name': 'Торговля', 'keywords': ['магазин', 'торгов']},
    {'code': 'logistics', 'name': 'Логистика', 'keywords': ['логистич', 'склад']},
    {'code': 'hospitality', 'name': 'Гостиничный бизнес', 'keywords': ['отдых', 'гостин', 'кемпинг', 'база отдыха']},
    {'code': 'realestate', 'name': 'Недвижимость', 'keywords': ['многоквартирн', 'жилой комплекс', 'жк', 'жилых и нежилых']},
    {'code': 'services', 'name': 'Услуги', 'keywords': ['услуг', 'ремонт', 'спортивн', 'фитнес', 'медск', 'столов', 'комплекс']},
    {'code': 'other', 'name': 'Прочее', 'keywords': []},
]

# Справочник потребностей
NEEDS = [
    {'code': 'it_infra', 'name': 'ИТ-инфраструктура и связь'},
    {'code': 'apcs', 'name': 'АСУ ТП и промышленный интернет вещей'},
    {'code': 'phys_security', 'name': 'Физическая безопасность'},
    {'code': 'info_security', 'name': 'Информационная безопасность'},
]

def detect_industry(title):
    """Определение отрасли по ключевым словам"""
    title_lower = title.lower()
    for ind in INDUSTRIES:
        if any(kw in title_lower for kw in ind['keywords']):
            return {'code': ind['code'], 'name': ind['name']}
    return {'code': 'other', 'name': 'Прочее'}

def detect_stage(start_year, launch_year):
    """Определение стадии по годам"""
    current_year = 2026
    if start_year > current_year:
        return {'code': 'design', 'name': 'Проектирование'}
    if launch_year <= current_year:
        return {'code': 'launch', 'name': 'Запуск'}
    return {'code': 'construction', 'name': 'Строительство'}

def generate_needs(seed):
    """Генерация потребностей (детерминированно)"""
    random.seed(seed)
    count = random.randint(1, 3)  # 1-3 потребности
    shuffled = NEEDS.copy()
    random.shuffle(shuffled)
    return [need['code'] for need in shuffled[:count]]

def generate_offers(needs, seed):
    """Генерация рекомендованных предложений"""
    random.seed(seed)
    offers = []
    for need_code in needs:
        need = next(n for n in NEEDS if n['code'] == need_code)
        offer_count = random.randint(1, 3)
        offer_list = []
        for i in range(offer_count):
            if need_code == 'it_infra':
                offer_list.append(f"ОБД-кабель {random.randint(10, 100)}Гб/с")
            elif need_code == 'apcs':
                offer_list.append(f"Контроллер SCADA v{random.randint(1, 5)}")
            elif need_code == 'phys_security':
                offer_list.append(f"IP-камера {random.randint(2, 8)}Мп")
            else:
                offer_list.append(f"Решение ИБ класса {random.randint(1, 3)}")
        offers.append({
            'need': need_code,
            'needName': need['name'],
            'offers': offer_list
        })
    return offers

def main():
    print('Чтение SQL-файла...')
    sql_path = Path(__file__).parent.parent.parent / 'infra' / 'db' / 'init' / '03_seed.sql'
    sql_content = sql_path.read_text(encoding='utf-8')

    print('Парсинг INSERT INTO etl.raw_invest...')
    # Ищем секцию с INSERT INTO etl.raw_invest
    invest_match = re.search(r'INSERT INTO etl\.raw_invest.*?VALUES\s+(.*?);', sql_content, re.DOTALL | re.IGNORECASE)
    if not invest_match:
        raise Exception('Не найден INSERT INTO etl.raw_invest')

    values_str = invest_match.group(1)

    # Парсим каждую строку формата ('2', '...', '...', ...)
    # Используем более простое регулярное выражение
    rows = []
    pattern = r"\('(\d+)',\s*'([^']+)',\s*'([^']+)',\s*'(Да|Нет)',\s*'([^']+)',\s*'(.+?)',\s*'(\d+)',\s*'(\d+)',\s*'([\d.]+)',\s*'(\d+)'\)"

    for match in re.finditer(pattern, values_str, re.DOTALL):
        rows.append({
            'src_no': match.group(1),
            'municipality': match.group(2),
            'curator': match.group(3),
            'is_key': match.group(4) == 'Да',
            'initiator': match.group(5),
            'title': match.group(6).replace('\n', ' ').strip(),
            'start_year': int(match.group(7)),
            'launch_year': int(match.group(8)),
            'amount_mln': float(match.group(9)),
            'jobs': int(match.group(10)),
        })

    print(f'Найдено {len(rows)} проектов')

    projects = []
    for idx, row in enumerate(rows):
        municipality = MUNICIPALITIES.get(row['municipality'])
        if not municipality:
            print(f"Предупреждение: Неизвестный район: {row['municipality']}")
            municipality = {'id': 1, 'lat': 47.2357, 'lon': 39.7015}  # default to Rostov

        industry = detect_industry(row['title'])
        stage = detect_stage(row['start_year'], row['launch_year'])
        needs = generate_needs(idx + 100)
        offers = generate_offers(needs, idx + 200)

        projects.append({
            'id': idx + 1,
            'title': row['title'],
            'initiator': row['initiator'],
            'municipalityId': municipality['id'],
            'municipalityName': row['municipality'],
            'lat': municipality['lat'],
            'lon': municipality['lon'],
            'isKey': row['is_key'],
            'curator': row['curator'],
            'startYear': row['start_year'],
            'launchYear': row['launch_year'],
            'amountMln': row['amount_mln'],
            'jobs': row['jobs'],
            'stage': stage['code'],
            'stageName': stage['name'],
            'industry': industry['code'],
            'industryName': industry['name'],
            'needs': needs,
            'recommendedOffers': offers,
            'updatedAt': '2026-10-24T12:00:00.000Z',
        })

    print(f'Сгенерировано {len(projects)} проектов')

    output_path = Path(__file__).parent.parent / 'src' / 'mocks' / 'fixtures' / 'projects.json'
    output_path.write_text(json.dumps(projects, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'✓ Записано в {output_path}')

if __name__ == '__main__':
    main()
