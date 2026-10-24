import { describe, it, expect } from 'vitest'
import { getAllProjects, getCompanyById, getProjectRelatedCompanies } from './fixtures'
import relatedExample from '../../../contracts/examples/related-companies.json'
import projectExample from '../../../contracts/examples/project.json'

const sortedKeys = (o: object) => Object.keys(o).sort()

describe('mock GET /api/projects/:id/related-companies', () => {
  const projects = getAllProjects()

  it('совпадает по форме с contracts/examples/related-companies.json', () => {
    const response = getProjectRelatedCompanies(projects[0].id)!
    expect(sortedKeys(response)).toEqual(sortedKeys(relatedExample))
    const exampleItemKeys = sortedKeys(relatedExample.items[0])
    response.items.forEach((item) => {
      // relocated в моке радара необязателен (звёздочка)
      expect(sortedKeys(item).filter((k) => k !== 'relocated')).toEqual(
        exampleItemKeys.filter((k) => k !== 'relocated')
      )
    })
  })

  it('проект из фикстуры совпадает по форме с contracts/examples/project.json', () => {
    expect(sortedKeys(projects[0])).toEqual(sortedKeys(projectExample))
  })

  it('детерминирован (seeded RNG): два вызова дают одно и то же', () => {
    projects.slice(0, 10).forEach((p) => {
      expect(getProjectRelatedCompanies(p.id)).toEqual(getProjectRelatedCompanies(p.id))
    })
  })

  it('инициатор первым, затем не клиенты раньше клиентов, не больше 20 + инициатор', () => {
    projects.forEach((p) => {
      const { items, sameAreaIndustryTotal, radarQuery } = getProjectRelatedCompanies(p.id)!
      const initiators = items.filter((c) => c.relation === 'initiator')
      expect(initiators.length).toBeLessThanOrEqual(1)
      if (initiators.length) expect(items[0].relation).toBe('initiator')

      const rest = items.filter((c) => c.relation === 'same_area_industry')
      expect(rest.length).toBeLessThanOrEqual(20)
      expect(rest.length).toBeLessThanOrEqual(sameAreaIndustryTotal)
      const firstClient = rest.findIndex((c) => c.isClient)
      if (firstClient >= 0) expect(rest.slice(firstClient).every((c) => c.isClient)).toBe(true)
      rest.forEach((c) => {
        expect(c.industry).toBe(p.industry)
        expect(c.municipalityId).toBe(p.municipalityId)
      })

      expect(radarQuery).toBe(`industry=${p.industry}&municipalityId=${p.municipalityId}`)
    })
  })

  it('каждую компанию рядом открывает GET /api/companies/:id', () => {
    projects.slice(0, 15).forEach((p) => {
      getProjectRelatedCompanies(p.id)!.items.forEach((c) => {
        const company = getCompanyById(c.id)
        expect(company.id).toBe(c.id)
        expect(company.name).toBe(c.name)
        expect(company).not.toHaveProperty('relation')
      })
    })
  })

  it('неизвестный проект → undefined (404)', () => {
    expect(getProjectRelatedCompanies(999999)).toBeUndefined()
  })
})
