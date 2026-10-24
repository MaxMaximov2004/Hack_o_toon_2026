#!/usr/bin/env tsx
/**
 * Генератор фикстур инвестпроектов из ../infra/db/init/03_seed.sql
 * Создаёт src/mocks/fixtures/projects.json с 63 проектами из базы кейса
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Простой детерминированный RNG на основе seed
function seededRandom(seed: number) {
  let state = seed
  return function() {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

// Справочник муниципалитетов с координатами
const MUNICIPALITIES: Record<string, { id: number; lat: number; lon: number }> = {
  'Азовский район': { id: 22, lat: 47.1167, lon: 39.4167 },
  'г. Ростов-на-Дону': { id: 1, lat: 47.2357, lon: 39.7015 },
  'Боковский район': { id: 23, lat: 48.4667, lon: 40.9333 },
  'Каменский район': { id: 24, lat: 48.3178, lon: 40.2595 },
  'Неклиновский район': { id: 25, lat: 47.3333, lon: 38.6667 },
  'Тарасовский район': { id: 26, lat: 48.7833, lon: 40.7500 },
}

// Справочник отраслей (код → название)
const INDUSTRIES = [
  { code: 'agro', name: 'Сельское хозяйство', keywords: ['сельско', 'фермер', 'сад', 'овощ', 'рыб', 'молоко', 'корм', 'зерн'] },
  { code: 'manufacturing', name: 'Производство', keywords: ['завод', 'производст', 'цех'] },
  { code: 'construction', name: 'Строительство', keywords: ['строительство', 'здани', 'жилого', 'комплекс'] },
  { code: 'trade', name: 'Торговля', keywords: ['магазин', 'торгов'] },
  { code: 'logistics', name: 'Логистика', keywords: ['логистич', 'склад'] },
  { code: 'hospitality', name: 'Гостиничный бизнес', keywords: ['отдых', 'гостин', 'кемпинг', 'база отдыха'] },
  { code: 'realestate', name: 'Недвижимость', keywords: ['многоквартирн', 'жилой комплекс', 'жк'] },
  { code: 'services', name: 'Услуги', keywords: ['услуг', 'ремонт', 'спортивн', 'фитнес', 'медск', 'столов'] },
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
function detectIndustry(title: string): { code: string; name: string } {
  const lowerTitle = title.toLowerCase()
  for (const ind of INDUSTRIES) {
    if (ind.keywords.some(kw => lowerTitle.includes(kw))) {
      return { code: ind.code, name: ind.name }
    }
  }
  return { code: 'other', name: 'Прочее' }
}

// Определение стадии по годам
function detectStage(startYear: number, launchYear: number): { code: string; name: string } {
  const currentYear = 2026
  if (startYear > currentYear) {
    return { code: 'design', name: 'Проектирование' }
  }
  if (launchYear <= currentYear) {
    return { code: 'launch', name: 'Запуск' }
  }
  return { code: 'construction', name: 'Строительство' }
}

// Парсинг SQL INSERT
function parseSQLInsert(sql: string): any[] {
  const valuesRegex = /VALUES\s+(.*);/is
  const match = sql.match(valuesRegex)
  if (!match) return []

  const valuesStr = match[1]
  const rows: any[] = []

  // Простой парсер: разбиваем по строкам между ('...')
  const rowRegex = /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'(\d+)',\s*'(\d+)',\s*'([\d.]+)',\s*'(\d+)'\)/g

  let rowMatch
  while ((rowMatch = rowRegex.exec(valuesStr)) !== null) {
    rows.push({
      src_no: rowMatch[1],
      municipality: rowMatch[2],
      curator: rowMatch[3],
      is_key: rowMatch[4] === 'Да',
      initiator: rowMatch[5],
      title: rowMatch[6].replace(/\n/g, ' '),
      start_year: parseInt(rowMatch[7]),
      launch_year: parseInt(rowMatch[8]),
      amount_mln: parseFloat(rowMatch[9]),
      jobs: parseInt(rowMatch[10]),
    })
  }

  return rows
}

// Генерация потребностей (детерминированно)
function generateNeeds(seed: number): string[] {
  const rng = seededRandom(seed)
  const count = Math.floor(rng() * 3) + 1 // 1-3 потребности
  const selected: string[] = []
  const shuffled = [...NEEDS].sort(() => rng() - 0.5)
  for (let i = 0; i < count; i++) {
    selected.push(shuffled[i].code)
  }
  return selected
}

// Генерация рекомендованных предложений
function generateOffers(needs: string[], seed: number): any[] {
  const rng = seededRandom(seed)
  return needs.map((needCode) => {
    const need = NEEDS.find(n => n.code === needCode)!
    const offerCount = Math.floor(rng() * 3) + 1
    const offers: string[] = []
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
  const investMatch = sqlContent.match(/INSERT INTO etl\.raw_invest.*?VALUES\s+(.*?);/is)
  if (!investMatch) {
    throw new Error('Не найден INSERT INTO etl.raw_invest')
  }

  const rawRows = parseSQLInsert(`INSERT INTO etl.raw_invest VALUES ${investMatch[1]};`)
  console.log(`Найдено ${rawRows.length} проектов`)

  const projects = rawRows.map((row, idx) => {
    const municipality = MUNICIPALITIES[row.municipality]
    if (!municipality) {
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
      municipalityId: municipality?.id || 1,
      municipalityName: row.municipality,
      lat: municipality?.lat || 47.2357,
      lon: municipality?.lon || 39.7015,
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
  writeFileSync(outputPath, JSON.stringify(projects, null, 2), 'utf-8')
  console.log(`✓ Записано в ${outputPath}`)
}

main()
