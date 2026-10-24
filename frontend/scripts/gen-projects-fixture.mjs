#!/usr/bin/env node
/**
 * Генератор фикстур инвестпроектов из ../infra/db/init/03_seed.sql
 * Создаёт src/mocks/fixtures/projects.json с 63 проектами из базы кейса
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Простой детерминированный RNG на основе seed
function seededRandom(seed) {
  let state = seed
  return function () {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

// Справочник муниципалитетов с координатами
const MUNICIPALITIES = {
  'Азовский район': { id: 22, lat: 47.1167, lon: 39.4167 },
  'г. Ростов-на-Дону': { id: 1, lat: 47.2357, lon: 39.7015 },
  'Боковский район': { id: 23, lat: 48.4667, lon: 40.9333 },
  'Каменский район': { id: 24, lat: 48.3178, lon: 40.2595 },
  'Неклиновский район': { id: 25, lat: 47.3333, lon: 38.6667 },
  'Тарасовский район': { id: 26, lat: 48.7833, lon: 40.7500 },
}

// Справочник отраслей (код → название)
const INDUSTRIES = [
  { code: 'agro', name: 'Сельское хозяйство', keywords: ['сельско', 'фермер', 'сад', 'овощ', 'рыб', 'молоко', 'корм', 'зерн', 'теплич'] },
  { code: 'manufacturing', name: 'Производство', keywords: ['завод', 'производст', 'цех'] },
  { code: 'construction', name: 'Строительство', keywords: ['строительство', 'здани', 'жилого', 'реконструкц'] },
  { code: 'trade', name: 'Торговля', keywords: ['магазин', 'торгов'] },
  { code: 'logistics', name: 'Логистика', keywords: ['логистич', 'склад'] },
  { code: 'hospitality', name: 'Гостиничный бизнес', keywords: ['отдых', 'гостин', 'кемпинг', 'база отдыха'] },
  { code: 'realestate', name: 'Недвижимость', keywords: ['многоквартирн', 'жилой комплекс', 'жк', 'жилых и нежилых'] },
  { code: 'services', name: 'Услуги', keywords: ['услуг', 'ремонт', 'спортивн', 'фитнес', 'медск', 'столов', 'комплекс'] },
  { code: 'other', name: 'Прочее', keywords: [] },
]

// Справочник потребностей
const NEEDS = [
  { code: 'it_infra', name: 'ИТ-инфраструктура и связь' },
  { code: 'apcs', name: 'АСУ ТП и промышленный интернет вещей' },
  { code: 'phys_security', name: 'Физическая безопасность' },
  { code: 'info_security', name: 'Информационная безопасность' },
]

// Определение отрасли по ключевым словам
function detectIndustry(title) {
  const lowerTitle = title.toLowerCase()
  for (const ind of INDUSTRIES) {
    if (ind.keywords.some(kw => lowerTitle.includes(kw))) {
      return { code: ind.code, name: ind.name }
    }
  }
  return { code: 'other', name: 'Прочее' }
}

// Определение стадии по годам
function detectStage(startYear, launchYear) {
  const currentYear = 2026
  if (startYear > currentYear) {
    return { code: 'design', name: 'Проектирование' }
  }
  if (launchYear <= currentYear) {
    return { code: 'launch', name: 'Запуск' }
  }
  return { code: 'construction', name: 'Строительство' }
}

// Генерация потребностей (детерминированно)
function generateNeeds(seed) {
  const rng = seededRandom(seed)
  const count = Math.floor(rng() * 3) + 1 // 1-3 потребности
  const selected = []
  const shuffled = [...NEEDS].sort(() => rng() - 0.5)
  for (let i = 0; i < count; i++) {
    selected.push(shuffled[i].code)
  }
  return selected
}

// Генерация рекомендованных предложений
function generateOffers(needs, seed) {
  const rng = seededRandom(seed)
  return needs.map((needCode) => {
    const need = NEEDS.find(n => n.code === needCode)
    const offerCount = Math.floor(rng() * 3) + 1
    const offers = []
    for (let i = 0; i < offerCount; i++) {
      if (needCode === 'it_infra') {
        offers.push(`ОБД-кабель ${Math.round(rng() * 100)}Гб/с`)
      } else if (needCode === 'apcs') {
        offers.push(`Контроллер SCADA v${Math.floor(rng() * 5) + 1}`)
      } else if (needCode === 'phys_security') {
        offers.push(`IP-камера ${Math.round(rng() * 4) + 2}Мп`)
      } else {
        offers.push(`Решение ИБ класса ${Math.floor(rng() * 3) + 1}`)
      }
    }
    return {
      need: needCode,
      needName: need.name,
      offers,
    }
  })
}

// Основная функция
function main() {
  console.log('Чтение SQL-файла...')
  const sqlPath = join(__dirname, '../../infra/db/init/03_seed.sql')
  const sqlContent = readFileSync(sqlPath, 'utf-8')

  console.log('Парсинг INSERT INTO etl.raw_invest...')

  // Находим весь блок INSERT INTO etl.raw_invest ... VALUES ... ;
  const investMatch = sqlContent.match(/INSERT INTO etl\.raw_invest.*?VALUES\s+(.*?);/is)
  if (!investMatch) {
    throw new Error('Не найден INSERT INTO etl.raw_invest')
  }

  const valuesStr = investMatch[1]

  // Парсим строки формата ('2', 'Азовский район', ..., '14'),
  // Учитываем многострочные значения
  const pattern = /\('(\d+)',\s*'([^']+)',\s*'([^']+)',\s*'(Да|Нет)',\s*'([^']+)',\s*'(.+?)',\s*'(\d+)',\s*'(\d+)',\s*'([\d.]+)',\s*'(\d+)'\)/gs

  const rows = []
  let match
  while ((match = pattern.exec(valuesStr)) !== null) {
    rows.push({
      src_no: match[1],
      municipality: match[2],
      curator: match[3],
      is_key: match[4] === 'Да',
      initiator: match[5],
      title: match[6].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
      start_year: parseInt(match[7]),
      launch_year: parseInt(match[8]),
      amount_mln: parseFloat(match[9]),
      jobs: parseInt(match[10]),
    })
  }

  console.log(`Найдено ${rows.length} проектов`)

  const projects = rows.map((row, idx) => {
    const municipality = MUNICIPALITIES[row.municipality] || { id: 1, lat: 47.2357, lon: 39.7015 }

    if (!MUNICIPALITIES[row.municipality]) {
      console.warn(`Неизвестный район: ${row.municipality}`)
    }

    const industry = detectIndustry(row.title)
    const stage = detectStage(row.start_year, row.launch_year)
    const needs = generateNeeds(idx + 100)
    const offers = generateOffers(needs, idx + 200)

    return {
      id: idx + 1,
      title: row.title,
      initiator: row.initiator,
      municipalityId: municipality.id,
      municipalityName: row.municipality,
      lat: municipality.lat,
      lon: municipality.lon,
      isKey: row.is_key,
      curator: row.curator,
      startYear: row.start_year,
      launchYear: row.launch_year,
      amountMln: row.amount_mln,
      jobs: row.jobs,
      stage: stage.code,
      stageName: stage.name,
      industry: industry.code,
      industryName: industry.name,
      needs,
      recommendedOffers: offers,
      updatedAt: new Date().toISOString(),
    }
  })

  console.log(`Сгенерировано ${projects.length} проектов`)

  const outputPath = join(__dirname, '../src/mocks/fixtures/projects.json')

  // Создаём директорию, если не существует
  mkdirSync(dirname(outputPath), { recursive: true })

  writeFileSync(outputPath, JSON.stringify(projects, null, 2), 'utf-8')
  console.log(`✓ Записано в ${outputPath}`)
  console.log(`✓ Проектов в фикстуре: ${projects.length}`)
}

main()
