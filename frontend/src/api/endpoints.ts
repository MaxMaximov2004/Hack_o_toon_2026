import { apiFetch } from './apiFetch'
import type { CompaniesResponse, Company, Dictionaries, MunicipalityStats, WhiteSpot } from './types'

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
