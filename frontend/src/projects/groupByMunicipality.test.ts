import { describe, it, expect } from 'vitest'
import type { ProjectShort } from '../api/types'
import { groupByMunicipality } from './groupByMunicipality'

function project(id: number, municipalityId: number, stage: ProjectShort['stage']): ProjectShort {
  return {
    id,
    title: `Проект ${id}`,
    initiator: null,
    municipalityId,
    municipalityName: municipalityId === 53 ? 'г. Ростов-на-Дону' : 'Азовский р-н',
    lat: municipalityId === 53 ? 47.22 : 47.05,
    lon: municipalityId === 53 ? 39.72 : 39.6,
    isKey: id === 2,
    curator: null,
    startYear: 2024,
    launchYear: 2027,
    amountMln: 100,
    jobs: 10,
    stage,
    stageName: null,
    industry: 'logistics',
    industryName: 'Транспорт и логистика',
    needs: [],
    recommendedOffers: [],
    updatedAt: '2026-10-24T09:00:00Z',
  } as unknown as ProjectShort
}

describe('groupByMunicipality', () => {
  it('один маркер на район, стадии посчитаны', () => {
    const clusters = groupByMunicipality([
      project(1, 53, 'construction'),
      project(2, 53, 'design'),
      project(3, 53, 'construction'),
      project(4, 7, 'launch'),
    ])

    expect(clusters).toHaveLength(2)
    const rostov = clusters.find((c) => c.municipalityId === 53)!
    expect(rostov).toMatchObject({ total: 3, design: 1, construction: 2, launch: 0, lat: 47.22, lon: 39.72 })
    expect(rostov.projects.map((p) => p.id)).toEqual([1, 2, 3])
    expect(clusters.find((c) => c.municipalityId === 7)).toMatchObject({ total: 1, launch: 1 })
  })

  it('пустой список — пустая карта', () => {
    expect(groupByMunicipality([])).toEqual([])
  })
})
