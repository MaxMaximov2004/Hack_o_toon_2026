import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportButtons } from './ExportButtons'
import * as api from '../api/apiFetch'
import * as download from './downloadBlob'

vi.mock('../api/apiFetch')
vi.mock('./downloadBlob')
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 1, email: 'admin@rt.ru', fullName: 'Админ', roles: ['admin'] } }),
}))

describe('ExportButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.apiFetch).mockResolvedValue({ blob: new Blob(['x']), filename: 'navigator_bitrix_2026-10-25.csv' })
  })

  it('Навигатор: «В CRM» выгружает проекты с фильтром экрана, без импорта клиентов', async () => {
    render(<ExportButtons endpoint="/api/export/projects" query="stage=design&need=apcs" total={8} noun="проектов" />)
    expect(screen.queryByText('Обновить список клиентов')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'В CRM' }))
    expect(screen.getByText('Будет выгружено 8 проектов')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Скачать' }))

    await waitFor(() =>
      expect(api.apiFetch).toHaveBeenCalledWith('/api/export/projects?stage=design&need=apcs&format=bitrix', {
        responseType: 'blob',
      })
    )
    expect(download.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), null, 'navigator_bitrix_2026-10-25.csv')
  })

  it('пустой фильтр — без лишнего «&»; импорт клиентов только на Радаре', () => {
    render(<ExportButtons endpoint="/api/export/companies" query="" total={5} noun="компаний" allowImport />)
    expect(screen.getByText('Обновить список клиентов')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    fireEvent.click(screen.getByRole('button', { name: 'Скачать' }))
    expect(api.apiFetch).toHaveBeenCalledWith('/api/export/companies?format=csv', { responseType: 'blob' })
  })
})
