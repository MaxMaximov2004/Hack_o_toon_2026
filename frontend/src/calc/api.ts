import { apiFetch, type BlobResponse } from '../api/apiFetch'
import type { CalcCatalog, EstimateRequest, EstimateResponse, ProposalClient } from './types'

// Калькулятор сделок (calc-service, через nginx /api/calc/*). Расчёт, CSV и КП — один и тот же POST-запрос.

export async function getCalcCatalog(): Promise<CalcCatalog> {
  return apiFetch<CalcCatalog>('/api/calc/catalog')
}

export async function postEstimate(body: EstimateRequest): Promise<EstimateResponse> {
  return apiFetch<EstimateResponse>('/api/calc/estimate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postEstimateCsv(body: EstimateRequest): Promise<BlobResponse> {
  return apiFetch<BlobResponse>('/api/calc/export/csv', {
    method: 'POST',
    body: JSON.stringify(body),
    responseType: 'blob',
  })
}

export async function postProposal(body: EstimateRequest, client: ProposalClient): Promise<BlobResponse> {
  return apiFetch<BlobResponse>('/api/calc/proposal', {
    method: 'POST',
    body: JSON.stringify({ ...body, client }),
    responseType: 'blob',
  })
}
