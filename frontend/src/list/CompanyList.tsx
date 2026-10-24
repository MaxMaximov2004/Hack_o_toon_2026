import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCompanies } from '../api/endpoints'
import { filterToQuery } from '../filters/filterToQuery'
import type { CompanyFilters } from '../filters/types'
import type { CompanyShort } from '../api/types'
import { Badge } from '../ui/Badge'
import { ExportButtons } from '../export/ExportButtons'
import styles from './CompanyList.module.css'

interface CompanyListProps {
  filters: CompanyFilters
  selectedId?: number
  onSelectCompany: (id: number) => void
}

const SORT_OPTIONS = [
  { value: 'revenueEst,desc', label: 'По выручке ↓' },
  { value: 'revenueEst,asc', label: 'По выручке ↑' },
  { value: 'revenueGrowthEst,desc', label: 'По росту ↓' },
  { value: 'revenueGrowthEst,asc', label: 'По росту ↑' },
  { value: 'name,asc', label: 'По названию ↑' },
  { value: 'name,desc', label: 'По названию ↓' },
  { value: 'employees,desc', label: 'По численности ↓' },
  { value: 'employees,asc', label: 'По численности ↑' },
  { value: 'registeredAt,desc', label: 'Новые сначала' },
  { value: 'registeredAt,asc', label: 'Старые сначала' },
]

export function CompanyList({ filters, selectedId, onSelectCompany }: CompanyListProps) {
  const [sort, setSort] = useState('revenueEst,desc')
  const [page, setPage] = useState(0)
  const [allItems, setAllItems] = useState<CompanyShort[]>([])
  const size = 50

  const queryString = filterToQuery(filters) + `&page=${page}&size=${size}&sort=${sort}`

  const { data, isLoading, error } = useQuery({
    queryKey: ['companies', queryString],
    queryFn: () => getCompanies(queryString),
    placeholderData: (prev) => prev,
  })

  // Сброс при изменении фильтров или сортировки
  useEffect(() => {
    setPage(0)
    setAllItems([])
  }, [filterToQuery(filters), sort])

  // Накопление данных при пагинации
  useEffect(() => {
    if (data?.items) {
      if (page === 0) {
        setAllItems(data.items)
      } else {
        setAllItems((prev) => [...prev, ...data.items])
      }
    }
  }, [data, page])

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value)
  }

  const handleLoadMore = () => {
    setPage((prev) => prev + 1)
  }

  if (isLoading && allItems.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  if (error) {
    const errorMessage = (error as any)?.error?.message || 'Ошибка загрузки списка компаний'
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <div className={styles.error}>{errorMessage}</div>
          <button className={styles.retryButton} onClick={() => window.location.reload()}>
            Повторить
          </button>
        </div>
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>В этой области ничего нет</p>
          <p className={styles.hint}>Отдалите карту или ослабьте фильтры</p>
        </div>
      </div>
    )
  }

  const hasMore = allItems.length < data.total

  return (
    <div className={styles.container}>
      <ExportButtons filters={filters} total={data.total} />

      <div className={styles.header}>
        <h3 className={styles.title}>Найдено: {data.total}</h3>
        <select className={styles.sortSelect} value={sort} onChange={handleSortChange}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.list}>
        {allItems.map((company) => (
          <CompanyRow
            key={company.id}
            company={company}
            isSelected={company.id === selectedId}
            onClick={() => onSelectCompany(company.id)}
          />
        ))}

        {hasMore && (
          <button className={styles.loadMore} onClick={handleLoadMore} disabled={isLoading}>
            {isLoading ? 'Загрузка...' : 'Показать ещё'}
          </button>
        )}
      </div>
    </div>
  )
}

interface CompanyRowProps {
  company: CompanyShort
  isSelected: boolean
  onClick: () => void
}

function CompanyRow({ company, isSelected, onClick }: CompanyRowProps) {
  const formatRevenue = (revenue: number | null) => {
    if (!revenue) return '—'
    const millions = revenue / 1_000_000
    return `${millions.toFixed(1)} млн ₽`
  }

  const formatGrowth = (growth: number | null) => {
    if (growth === null) return null
    return growth > 0 ? `+${growth}%` : `${growth}%`
  }

  const getSizeLabel = (size: string) => {
    switch (size) {
      case 'micro':
        return 'Микро'
      case 'small':
        return 'Малый'
      case 'medium':
        return 'Средний'
      default:
        return size
    }
  }

  const getKindLabel = (kind: string) => {
    switch (kind) {
      case 'ours':
        return 'наш'
      case 'others':
        return 'не наш'
      case 'excluded':
        return 'исключён'
      default:
        return kind
    }
  }

  const kindColor = company.kind === 'ours' ? 'purple' : company.kind === 'others' ? 'orange' : 'default'
  const growth = formatGrowth(company.revenueGrowthEst)

  return (
    <div
      className={`${styles.row} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.rowHeader}>
        <div className={styles.rowTitleLine}>
          <Badge variant={kindColor}>{getKindLabel(company.kind)}</Badge>
          <div className={styles.rowTitle}>{company.name}</div>
        </div>
        <div className={styles.badges}>
          {company.isEstimated && <Badge variant="default">оценка</Badge>}
          {company.isNew && <Badge variant={kindColor}>новая</Badge>}
        </div>
      </div>

      <div className={styles.rowDetails}>
        <div className={styles.detail}>
          <span className={styles.label}>Отрасль:</span> {company.industryName}
        </div>
        <div className={styles.detail}>
          <span className={styles.label}>Категория:</span> {getSizeLabel(company.sizeCategory)}
        </div>
        <div className={styles.detail}>
          <span className={styles.label}>Выручка:</span> {formatRevenue(company.revenueEst)}
          {growth && (
            <span className={company.revenueGrowthEst! > 0 ? styles.growthPositive : styles.growthNegative}>
              {' '}
              ({growth})
            </span>
          )}
        </div>
        <div className={styles.detail}>
          <span className={styles.label}>Город:</span> {company.municipalityName}
        </div>
      </div>
    </div>
  )
}
