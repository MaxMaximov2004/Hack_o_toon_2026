import { useQuery } from '@tanstack/react-query'
import { getDictionaries } from '../api/endpoints'
import type { CompanyFilters } from '../filters/types'
import styles from './FilterChips.module.css'

interface FilterChipsProps {
  filters: CompanyFilters
  onFiltersChange: (updates: Partial<CompanyFilters>) => void
  onResetAll: () => void
}

interface Chip {
  key: string
  label: string
  onRemove: () => void
}

export function FilterChips({ filters, onFiltersChange, onResetAll }: FilterChipsProps) {
  const { data: dictionaries } = useQuery({
    queryKey: ['dictionaries'],
    queryFn: getDictionaries,
    staleTime: Infinity,
  })

  const chips: Chip[] = []

  // Клиент
  if (filters.client && filters.client !== 'all') {
    const label = filters.client === 'ours' ? 'Наши' : 'Не наши'
    chips.push({
      key: 'client',
      label,
      onRemove: () => onFiltersChange({ client: 'all' }),
    })
  }

  // Статус
  if (filters.status && filters.status !== 'active') {
    const label = filters.status === 'excluded' ? 'Исключённые из реестра' : 'С исключёнными'
    chips.push({
      key: 'status',
      label,
      onRemove: () => onFiltersChange({ status: 'active' }),
    })
  }

  // Отрасли
  if (filters.industry && filters.industry.length > 0 && dictionaries) {
    filters.industry.forEach((code) => {
      const industry = dictionaries.industries.find((ind) => ind.code === code)
      if (industry) {
        chips.push({
          key: `industry-${code}`,
          label: industry.name,
          onRemove: () => {
            const updated = filters.industry.filter((c) => c !== code)
            onFiltersChange({ industry: updated.length > 0 ? updated : [] })
          },
        })
      }
    })
  }

  // Районы
  if (filters.municipalityId && filters.municipalityId.length > 0 && dictionaries) {
    filters.municipalityId.forEach((id) => {
      const municipality = dictionaries.municipalities.find((mun) => mun.id === id)
      if (municipality) {
        chips.push({
          key: `municipality-${id}`,
          label: municipality.name,
          onRemove: () => {
            const updated = filters.municipalityId.filter((i) => i !== id)
            onFiltersChange({ municipalityId: updated.length > 0 ? updated : [] })
          },
        })
      }
    })
  }

  // Категории
  if (filters.sizeCategory && filters.sizeCategory.length > 0 && dictionaries) {
    filters.sizeCategory.forEach((code) => {
      const category = dictionaries.sizeCategories.find((cat) => cat.code === code)
      if (category) {
        chips.push({
          key: `sizeCategory-${code}`,
          label: category.name,
          onRemove: () => {
            const updated = filters.sizeCategory.filter((c) => c !== code)
            onFiltersChange({ sizeCategory: updated.length > 0 ? updated : [] })
          },
        })
      }
    })
  }

  // Выручка
  if (filters.revenueMin !== undefined || filters.revenueMax !== undefined) {
    const min = filters.revenueMin ? `от ${(filters.revenueMin / 1_000_000).toFixed(0)} млн` : ''
    const max = filters.revenueMax ? `до ${(filters.revenueMax / 1_000_000).toFixed(0)} млн` : ''
    const label = [min, max].filter(Boolean).join(' ')
    chips.push({
      key: 'revenue',
      label: `Выручка: ${label}`,
      onRemove: () => onFiltersChange({ revenueMin: undefined, revenueMax: undefined }),
    })
  }

  // Рост
  if (filters.growthMin !== undefined) {
    chips.push({
      key: 'growth',
      label: `Рост от ${filters.growthMin}%`,
      onRemove: () => onFiltersChange({ growthMin: undefined }),
    })
  }

  // Только новые
  if (filters.isNew) {
    chips.push({
      key: 'isNew',
      label: 'Новые компании',
      onRemove: () => onFiltersChange({ isNew: undefined }),
    })
  }

  // Поиск
  if (filters.q && filters.q.length >= 2) {
    chips.push({
      key: 'q',
      label: `Поиск: "${filters.q}"`,
      onRemove: () => onFiltersChange({ q: undefined }),
    })
  }

  // Переехавшие
  if (filters.relocated) {
    chips.push({
      key: 'relocated',
      label: 'Переехавшие',
      onRemove: () => onFiltersChange({ relocated: undefined }),
    })
  }

  if (chips.length === 0) {
    return null
  }

  return (
    <div className={styles.container}>
      <div className={styles.chips}>
        {chips.map((chip) => (
          <div key={chip.key} className={styles.chip}>
            <span className={styles.chipLabel}>{chip.label}</span>
            <button
              className={styles.chipRemove}
              onClick={chip.onRemove}
              aria-label={`Удалить фильтр ${chip.label}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className={styles.resetButton} onClick={onResetAll}>
        Сбросить всё
      </button>
    </div>
  )
}
