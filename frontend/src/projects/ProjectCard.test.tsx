import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectCard } from './ProjectCard'
import * as endpoints from '../api/endpoints'
import { getProjectById, getProjectRelatedCompanies } from '../mocks/fixtures'
import type { Project, Subscription } from '../api/types'

vi.mock('../api/endpoints')

const project = getProjectById(1)! as Project
const related = getProjectRelatedCompanies(1)!

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function RadarStub() {
  const location = useLocation()
  return <div data-testid="radar">{location.search}</div>
}

function renderCard(onOpenCompany = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/navigator']}>
        <Routes>
          <Route
            path="/navigator"
            element={<ProjectCard projectId={1} onClose={vi.fn()} onOpenCompany={onOpenCompany} />}
          />
          <Route path="/" element={<RadarStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { onOpenCompany }
}

describe('ProjectCard', () => {
  beforeEach(() => {
    vi.mocked(endpoints.getProject).mockResolvedValue(project)
    vi.mocked(endpoints.getProjectRelatedCompanies).mockResolvedValue(related)
    vi.mocked(endpoints.createSubscription).mockResolvedValue({ id: 99 } as Subscription)
  })

  it('показывает рекомендации по потребностям', async () => {
    renderCard()
    expect(await screen.findByText('Что предложить Ростелекому')).toBeInTheDocument()
    project.recommendedOffers.forEach((group) => {
      expect(screen.getByText(group.needName)).toBeInTheDocument()
      group.offers.forEach((offer) => expect(screen.getAllByText(offer).length).toBeGreaterThan(0))
    })
  })

  it('клик по компании рядом открывает карточку компании', async () => {
    const { onOpenCompany } = renderCard()
    // Имя инициатора есть и в поле «Инициатор» — кликаем именно строку списка
    const buttons = await screen.findAllByRole('button', { name: new RegExp(escape(related.items[0].name)) })
    fireEvent.click(buttons[0])
    expect(onOpenCompany).toHaveBeenCalledWith(related.items[0].id)
  })

  it('«Открыть в радаре» ведёт на /?radarQuery', async () => {
    renderCard()
    fireEvent.click(await screen.findByText('Открыть в радаре'))
    expect(await screen.findByTestId('radar')).toHaveTextContent(`?${related.radarQuery}`)
  })

  it('без radarQuery кнопки «Открыть в радаре» нет', async () => {
    vi.mocked(endpoints.getProjectRelatedCompanies).mockResolvedValue({
      ...related,
      radarQuery: null,
    })
    renderCard()
    expect(await screen.findByText(/Всего в районе по отрасли/)).toBeInTheDocument()
    expect(screen.queryByText('Открыть в радаре')).not.toBeInTheDocument()
  })

  it('подписка уходит с отраслью и районом проекта', async () => {
    renderCard()
    fireEvent.click(await screen.findByText('Подписаться на такие проекты'))
    await waitFor(() =>
      expect(endpoints.createSubscription).toHaveBeenCalledWith({
        industry: project.industry,
        municipalityId: project.municipalityId,
      })
    )
    expect(await screen.findByText('Подписка оформлена')).toBeInTheDocument()
  })

  it('404 → «Проект не найден»', async () => {
    vi.mocked(endpoints.getProject).mockRejectedValue({ code: 'NOT_FOUND', message: 'x' })
    renderCard()
    expect(await screen.findByText('Проект не найден')).toBeInTheDocument()
  })
})
