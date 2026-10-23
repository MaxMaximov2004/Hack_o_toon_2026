import { apiFetch } from './apiFetch'
import type { CompaniesResponse, Company, Dictionaries } from './types'

export async function getDictionaries(): Promise<Dictionaries> {
  return apiFetch<Dictionaries>('/api/dictionaries')
}

export async function getCompanies(query: string): Promise<CompaniesResponse> {
  return apiFetch<CompaniesResponse>(`/api/companies?${query}`)
}

export async function getCompany(id: number): Promise<Company> {
  return apiFetch<Company>(`/api/companies/${id}`)
}
