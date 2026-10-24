import { apiFetch } from './apiFetch'
import { groupByMunicipality, type ProjectMunicipalityCluster } from '../projects/groupByMunicipality'
import type {
  CompaniesResponse,
  Company,
  Dictionaries,
  MunicipalityStats,
  WhiteSpot,
  ProjectsResponse,
  Project,
  TimelineResponse,
  ProjectRelatedCompaniesResponse,
  SubscriptionsResponse,
  Subscription,
  SubscriptionInput,
  NotificationsResponse,
  TelegramLinkResponse,
  CompanyLocations,
  ActualLocation,
  LocationInput,
  LocationImportResponse,
  ImportClientsResponse,
  ImportMode,
} from './types'

export async function getDictionaries(): Promise<Dictionaries> {
  return apiFetch<Dictionaries>('/api/dictionaries')
}

export async function getCompanies(query: string): Promise<CompaniesResponse> {
  return apiFetch<CompaniesResponse>(`/api/companies?${query}`)
}

export async function getCompany(id: number): Promise<Company> {
  return apiFetch<Company>(`/api/companies/${id}`)
}

export async function getMunicipalityStats(industry: string): Promise<MunicipalityStats[]> {
  return apiFetch<MunicipalityStats[]>(`/api/municipalities/stats?industry=${industry}`)
}

export async function getWhiteSpots(industry: string, limit = 10): Promise<WhiteSpot[]> {
  return apiFetch<WhiteSpot[]>(`/api/white-spots?industry=${industry}&limit=${limit}`)
}

// «Где работает» (ТЗ 07)

export async function getCompanyLocations(id: number): Promise<CompanyLocations> {
  return apiFetch<CompanyLocations>(`/api/companies/${id}/locations`)
}

export async function addCompanyLocation(id: number, data: LocationInput): Promise<ActualLocation> {
  return apiFetch<ActualLocation>(`/api/companies/${id}/locations`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteCompanyLocation(id: number, locationId: number): Promise<void> {
  await apiFetch<void>(`/api/companies/${id}/locations/${locationId}`, { method: 'DELETE' })
}

// Админ: загрузка CSV. Тело — FormData: браузер сам ставит multipart/form-data с границей

export async function importClients(file: File, mode: ImportMode): Promise<ImportClientsResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('mode', mode)
  return apiFetch<ImportClientsResponse>('/api/clients/import', { method: 'POST', body: form })
}

export async function importLocations(file: File): Promise<LocationImportResponse> {
  const form = new FormData()
  form.append('file', file)
  return apiFetch<LocationImportResponse>('/api/locations/import', { method: 'POST', body: form })
}

// Продукт 2 - Навигатор

export async function getProjects(query: string): Promise<ProjectsResponse> {
  return apiFetch<ProjectsResponse>(`/api/projects?${query}`)
}

export async function getProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}`)
}

export async function getProjectTimeline(query: string): Promise<TimelineResponse> {
  return apiFetch<TimelineResponse>(`/api/projects/timeline?${query}`)
}

export async function getProjectRelatedCompanies(id: number): Promise<ProjectRelatedCompaniesResponse> {
  return apiFetch<ProjectRelatedCompaniesResponse>(`/api/projects/${id}/related-companies`)
}

export async function getSubscriptions(): Promise<SubscriptionsResponse> {
  return apiFetch<SubscriptionsResponse>('/api/subscriptions')
}

export async function createSubscription(data: SubscriptionInput): Promise<Subscription> {
  return apiFetch<Subscription>('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteSubscription(id: number): Promise<void> {
  await apiFetch<void>(`/api/subscriptions/${id}`, { method: 'DELETE' })
}

export async function getNotifications(): Promise<NotificationsResponse> {
  return apiFetch<NotificationsResponse>('/api/notifications')
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiFetch<void>(`/api/notifications/${id}/read`, { method: 'POST' })
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch<void>('/api/notifications/read-all', { method: 'POST' })
}

export async function getTelegramLink(): Promise<TelegramLinkResponse> {
  return apiFetch<TelegramLinkResponse>('/api/notifications/telegram-link')
}

/**
 * Маркеры районов для карты Навигатора. Отдельного эндпоинта нет (контракт 08): берём все проекты
 * по фильтру — их десятки, size ≤ 200 — и группируем по району на клиенте.
 */
export async function getProjectClusters(query: string): Promise<ProjectMunicipalityCluster[]> {
  const page = await getProjects(query ? `${query}&size=200` : 'size=200')
  return groupByMunicipality(page.items)
}
