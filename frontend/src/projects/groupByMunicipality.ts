import type { ProjectShort } from '../api/types'

/** Маркер района на карте Навигатора: проекты района и сколько их на каждой стадии */
export interface ProjectMunicipalityCluster {
  municipalityId: number
  municipalityName: string
  lat: number
  lon: number
  total: number
  design: number
  construction: number
  launch: number
  projects: ProjectShort[]
}

/**
 * Группирует проекты по району. Координат у проекта нет — lat/lon = центр района (контракт 08),
 * поэтому несколько проектов района показываем одним маркером с числом.
 */
export function groupByMunicipality(projects: ProjectShort[]): ProjectMunicipalityCluster[] {
  const grouped = new Map<number, ProjectShort[]>()
  projects.forEach((project) => {
    if (!grouped.has(project.municipalityId)) {
      grouped.set(project.municipalityId, [])
    }
    grouped.get(project.municipalityId)!.push(project)
  })

  const clusters: ProjectMunicipalityCluster[] = []
  grouped.forEach((items, municipalityId) => {
    const first = items[0]
    clusters.push({
      municipalityId,
      municipalityName: first.municipalityName,
      lat: first.lat,
      lon: first.lon,
      total: items.length,
      design: items.filter((p) => p.stage === 'design').length,
      construction: items.filter((p) => p.stage === 'construction').length,
      launch: items.filter((p) => p.stage === 'launch').length,
      projects: items,
    })
  })
  return clusters
}
