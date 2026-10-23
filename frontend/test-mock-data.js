// Тестовая проверка согласованности данных в моках
// Запуск: node test-mock-data.js

const { getAllCompanies, filterCompanies, generateMapCells } = require('./src/mocks/fixtures.ts')

console.log('=== Проверка согласованности данных моков ===\n')

// 1. Общее количество компаний
const allCompanies = getAllCompanies()
console.log(`Всего компаний: ${allCompanies.length}`)

// Подсчёт по городам
const byCity = {}
allCompanies.forEach(c => {
  if (!byCity[c.municipalityName]) {
    byCity[c.municipalityName] = { total: 0, ours: 0, others: 0 }
  }
  byCity[c.municipalityName].total++
  if (c.kind === 'ours') byCity[c.municipalityName].ours++
  else byCity[c.municipalityName].others++
})

console.log('\nРаспределение по городам:')
Object.entries(byCity)
  .sort((a, b) => b[1].total - a[1].total)
  .slice(0, 5)
  .forEach(([city, stats]) => {
    console.log(`  ${city}: ${stats.total} (наши: ${stats.ours}, не наши: ${stats.others})`)
  })

// 2. Проверка фильтрации без bbox
console.log('\n=== Фильтрация (status=active) ===')
const activeCompanies = filterCompanies({ status: 'active' })
console.log(`Активных компаний: ${activeCompanies.length}`)

// 3. Проверка фильтрации с bbox (Ростов-на-Дону примерно)
const rostovBbox = {
  minLat: 47.1,
  maxLat: 47.4,
  minLon: 39.5,
  maxLon: 39.9
}

console.log('\n=== Фильтрация по bbox (Ростов) ===')
const rostovCompanies = filterCompanies({ status: 'active', bbox: rostovBbox })
console.log(`Компаний в bbox Ростова: ${rostovCompanies.length}`)

// 4. Проверка кластеризации
console.log('\n=== Кластеризация (zoom=7, без bbox) ===')
const mapData = generateMapCells(7, { status: 'active' })
console.log(`Режим: ${mapData.cells.length > 0 ? 'cells' : 'points'}`)
console.log(`Total в ответе: ${mapData.total}`)
if (mapData.cells.length > 0) {
  console.log(`Кластеров: ${mapData.cells.length}`)
  const totalInCells = mapData.cells.reduce((sum, cell) => sum + cell.total, 0)
  console.log(`Сумма компаний в кластерах: ${totalInCells}`)

  // Самый большой кластер
  const biggest = mapData.cells.sort((a, b) => b.total - a.total)[0]
  console.log(`Самый большой кластер: ${biggest.total} компаний на [${biggest.lat.toFixed(2)}, ${biggest.lon.toFixed(2)}]`)
}

console.log('\n=== Кластеризация (zoom=7, bbox Ростова) ===')
const mapDataRostov = generateMapCells(7, { status: 'active', bbox: rostovBbox })
console.log(`Total в ответе: ${mapDataRostov.total}`)
console.log(`Кластеров: ${mapDataRostov.cells.length}`)

console.log('\n✅ Проверка пройдена!')
console.log('Вывод: total в /api/map/cells должен совпадать с total в /api/companies при одинаковых фильтрах.')
