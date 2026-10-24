import { describe, it, expect, beforeEach } from 'vitest'
import {
  addCompanyLocation,
  deleteCompanyLocation,
  filterCompanies,
  getAllCompanies,
  getCompanyLocations,
  importClientsCsv,
  importLocationsCsv,
  resetLocationMocks,
} from './fixtures'
import locationsExample from '../../../contracts/examples/locations.json'

const sortedKeys = (o: object) => Object.keys(o).sort()
const salsk = () => getAllCompanies().find((c) => c.municipalityName === 'Сальск')!

describe('мок «Где работает» (ТЗ 07)', () => {
  beforeEach(resetLocationMocks)

  it('Сальск → Азов: relocated, фильтр, форма как в contracts/examples/locations.json', () => {
    const company = salsk()
    expect(getCompanyLocations(company.id)!.relocated).toBe(false)

    const added = addCompanyLocation(company.id, { municipalityName: 'Азов', address: 'ул. Ленина, 1' })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(sortedKeys(added.location)).toEqual(sortedKeys(locationsExample.actual[0]))
    expect(added.location).toMatchObject({ source: 'manager', confidence: 0.8, municipalityName: 'Азов' })

    const locations = getCompanyLocations(company.id)!
    expect(sortedKeys(locations)).toEqual(sortedKeys(locationsExample))
    expect(sortedKeys(locations.registered)).toEqual(sortedKeys(locationsExample.registered))
    expect(locations.relocated).toBe(true)
    expect(filterCompanies({ relocated: true }).map((c) => c.id)).toEqual([company.id])
  })

  it('тот же район, что при регистрации, — не relocated; другой регион — relocated', () => {
    const company = salsk()
    addCompanyLocation(company.id, { municipalityName: 'Сальск' })
    expect(getCompanyLocations(company.id)!.relocated).toBe(false)
    addCompanyLocation(company.id, { regionName: 'Краснодарский край' })
    expect(getCompanyLocations(company.id)!.relocated).toBe(true)
  })

  it('валидация: ровно одно из двух, район из справочника', () => {
    const id = salsk().id
    expect(addCompanyLocation(id, {})).toMatchObject({ ok: false, status: 400 })
    expect(addCompanyLocation(id, { municipalityName: 'Азов', regionName: 'Крым' })).toMatchObject({ ok: false })
    expect(addCompanyLocation(id, { municipalityName: 'Атлантида' })).toMatchObject({ ok: false, status: 400 })
    expect(addCompanyLocation(999999, { municipalityName: 'Азов' })).toMatchObject({ ok: false, status: 404 })
  })

  it('удаление: своё — 204, из CRM — 403, повтор — 404', () => {
    const company = salsk()
    const own = addCompanyLocation(company.id, { municipalityName: 'Азов' })
    if (!own.ok) throw new Error('не добавилось')
    importLocationsCsv(`inn;municipality;region;address;source\n${company.inn};Батайск;;;crm`)
    const crm = getCompanyLocations(company.id)!.actual.find((a) => a.source === 'crm')!

    expect(deleteCompanyLocation(company.id, crm.id)).toBe(403)
    expect(deleteCompanyLocation(company.id, own.location.id)).toBe(204)
    expect(deleteCompanyLocation(company.id, own.location.id)).toBe(404)
  })

  it('импорт адресов из CRM: найденные, не найденные, неразобранные', () => {
    const [a, b] = getAllCompanies()
    const result = importLocationsCsv(
      `\uFEFFinn;municipality;region;address;source\n${a.inn};Азов;;ул. Ленина, 1;crm\n0000000000;Азов;;;\n${b.inn};Атлантида;;;`
    )
    expect(result).toEqual({
      rows: 3,
      matched: 1,
      notFound: ['0000000000'],
      invalid: ['строка 3: Неизвестный район или город: Атлантида'],
    })
    expect(getCompanyLocations(a.id)!.actual[0]).toMatchObject({ source: 'crm', confidence: 0.9 })
  })
})

describe('мок импорта клиентов', () => {
  it('append добавляет, replace заменяет; не найденные ИНН — в notFound', () => {
    const others = getAllCompanies().filter((c) => !c.isClient && c.status === 'active')
    const [x, y] = others
    const before = getAllCompanies().filter((c) => c.isClient).length

    const appended = importClientsCsv(`inn\n${x.inn}\n123456789012`, 'append')
    expect(appended).toMatchObject({ rows: 2, matched: 1, notFound: ['123456789012'], mode: 'append' })
    expect(x.kind).toBe('ours')
    expect(getAllCompanies().filter((c) => c.isClient).length).toBe(before + 1)

    const replaced = importClientsCsv(`${y.inn}`, 'replace')
    expect(replaced).toMatchObject({ rows: 1, matched: 1, mode: 'replace' })
    expect(getAllCompanies().filter((c) => c.isClient).map((c) => c.id)).toEqual([y.id])
    expect(x.kind).toBe('others')
  })
})
