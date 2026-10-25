import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import * as api from './api'
import * as download from '../export/downloadBlob'
import { CalcExport } from './CalcExport'
import type { EstimateRequest } from './types'

vi.mock('./api')
vi.mock('../export/downloadBlob', () => ({ downloadBlob: vi.fn() }))

const body: EstimateRequest = {
  regionId: 3, level: 'basic', termMonths: 12, financing: 'prepay', stages: ['pir'],
  items: [{ componentId: 'el_01', qty: 10 }], customItems: [], urgent: false, uniqueSolution: false,
}
const blob = new Blob(['x'])

describe('CalcExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.postEstimateCsv).mockResolvedValue({ blob, filename: 'estimate_2026-10-25.csv' })
    vi.mocked(api.postProposal).mockResolvedValue({ blob, filename: 'radar_proposal_2026-10-25.docx' })
    vi.mocked(api.postEstimateBitrix).mockResolvedValue({ blob, filename: 'estimate_bitrix_2026-10-25.csv' })
  })

  it('CSV — сразу скачивание с именем из заголовка и тост', async () => {
    render(<CalcExport body={body} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Скачать CSV' }))
    await waitFor(() => expect(download.downloadBlob).toHaveBeenCalledWith(blob, null, 'estimate_2026-10-25.csv'))
    expect(api.postEstimateCsv).toHaveBeenCalledWith(body)
    expect(await screen.findByText('Таблица расчёта скачана')).toBeInTheDocument()
  })

  it('ошибка CSV — текст ApiError в тосте', async () => {
    vi.mocked(api.postEstimateCsv).mockRejectedValue({ code: 'UPSTREAM_UNAVAILABLE', message: 'Сервис временно недоступен' })
    render(<CalcExport body={body} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Скачать CSV' }))
    expect(await screen.findByText('Сервис временно недоступен')).toBeInTheDocument()
    expect(download.downloadBlob).not.toHaveBeenCalled()
  })

  it('КП: без названия нельзя, неверный ИНН подсвечен; client уходит в теле', async () => {
    render(<CalcExport body={body} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Коммерческое предложение' }))
    const submit = screen.getByRole('button', { name: 'Скачать DOCX' })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: ' ООО «Ромашка» ' } })
    fireEvent.change(screen.getByLabelText('ИНН'), { target: { value: '123' } })
    expect(screen.getByText('ИНН — 10 или 12 цифр')).toBeInTheDocument()
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('ИНН'), { target: { value: '6164000000' } })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(api.postProposal).toHaveBeenCalledWith(body, { name: 'ООО «Ромашка»', inn: '6164000000' })
    )
    expect(download.downloadBlob).toHaveBeenCalledWith(blob, null, 'radar_proposal_2026-10-25.docx')
  })

  it('В CRM: тот же диалог клиента, лид уходит в /export/bitrix', async () => {
    render(<CalcExport body={body} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'В CRM' }))
    expect(screen.getByRole('dialog', { name: 'Клиент для лида в CRM' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'ООО «Ромашка»' } })
    fireEvent.change(screen.getByLabelText('Контакт'), { target: { value: 'info@romashka.ru' } })
    fireEvent.click(screen.getByRole('button', { name: 'Скачать для CRM' }))
    await waitFor(() =>
      expect(api.postEstimateBitrix).toHaveBeenCalledWith(body, { name: 'ООО «Ромашка»', contact: 'info@romashka.ru' })
    )
    expect(download.downloadBlob).toHaveBeenCalledWith(blob, null, 'estimate_bitrix_2026-10-25.csv')
    expect(api.postProposal).not.toHaveBeenCalled()
    expect(await screen.findByText('Лид для Bitrix24 скачан')).toBeInTheDocument()
  })

  it('нет расчёта — кнопки неактивны', () => {
    render(<CalcExport body={body} disabled />)
    expect(screen.getByRole('button', { name: 'Скачать CSV' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Коммерческое предложение' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'В CRM' })).toBeDisabled()
  })
})
