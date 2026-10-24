import { apiFetch } from './apiFetch'
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
  NotificationsResponse,
  TelegramLinkResponse,
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

export async function createSubscription(data: {
  industry?: string
  municipalityId?: number
  need?: string
  stage?: string
}): Promise<Subscription> {
  return apiFetch<Subscription>('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

export async function getProjectClusters(query: string) {
  return apiFetch<any[]>(`/api/projects/map/clusters?${query}`)
}
