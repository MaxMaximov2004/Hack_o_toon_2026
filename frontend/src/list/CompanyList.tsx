import { useQuery } from '@tanstack/react-query'
import { getCompanies } from '../api/endpoints'
import { filterToQuery } from '../filters/filterToQuery'
import type { CompanyFilters } from '../filters/types'
import type { CompanyShort } from '../api/types'
import { Badge } from '../ui/Badge'
import styles from './CompanyList.module.css'

interface CompanyListProps {
  filters: CompanyFilters
  selectedId?: number
  onSelectCompany: (id: number) => void
}

export function CompanyList({ filters, selectedId, onSelectCompany }: CompanyListProps) {
  const sort = 'revenueEst,desc'

  const queryString = filterToQuery(filters) + `&page=0&size=50&sort=${sort}`

  const { data, isLoading, error } = useQuery({
    queryKey: ['companies', queryString],
    queryFn: () => getCompanies(queryString),
    placeholderData: (prev) => prev,
  })

  if (isLoading && !data) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Ошибка загрузки списка компаний</div>
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>В этой области ничего нет</p>
          <p className={styles.hint}>Отдалите карту или ослабьте фильтры</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Найдено: {data.total}</h3>
      </div>

      <div className={styles.list}>
        {data.items.map((company) => (
          <CompanyRow
            key={company.id}
            company={company}
            isSelected={company.id === selectedId}
            onClick={() => onSelectCompany(company.id)}
          />
        ))}
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

  const kindColor = company.kind === 'ours' ? 'purple' : company.kind === 'others' ? 'orange' : 'default'

  return (
    <div
      className={`${styles.row} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.rowHeader}>
        <div className={styles.rowTitle}>{company.name}</div>
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
          <span className={styles.label}>Выручка:</span> {formatRevenue(company.revenueEst)}
        </div>
        <div className={styles.detail}>
          <span className={styles.label}>Город:</span> {company.municipalityName}
        </div>
      </div>
    </div>
  )
}
