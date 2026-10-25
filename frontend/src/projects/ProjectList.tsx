import { useQuery } from '@tanstack/react-query'
import { getProjects } from '../api/endpoints'
import { projectFilterToQuery } from './projectFilterToQuery'
import { formatMoney, formatYears } from '../utils/formatMoney'
import { ExportButtons } from '../export/ExportButtons'
import type { ProjectFilters, ProjectSortField, ProjectSortDirection } from './types'
import type { ProjectShort } from '../api/types'
import styles from './ProjectList.module.css'

interface ProjectListProps {
  filters: ProjectFilters
  selectedId?: number
  onSelectProject: (id: number) => void
  sort: `${ProjectSortField},${ProjectSortDirection}`
  onSortChange: (sort: `${ProjectSortField},${ProjectSortDirection}`) => void
}

export function ProjectList({
  filters,
  selectedId,
  onSelectProject,
  sort,
  onSortChange,
}: ProjectListProps) {
  const queryString = projectFilterToQuery(filters)

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', queryString, sort],
    queryFn: () => getProjects(`${queryString}&page=0&size=50&sort=${sort}`),
    staleTime: 30000,
  })

  const handleSortClick = (field: ProjectSortField) => {
    const [currentField, currentDir] = sort.split(',') as [ProjectSortField, ProjectSortDirection]
    if (currentField === field) {
      // Переключаем направление
      const newDir = currentDir === 'desc' ? 'asc' : 'desc'
      onSortChange(`${field},${newDir}`)
    } else {
      // Новое поле — по умолчанию desc
      onSortChange(`${field},desc`)
    }
  }

  const getSortIcon = (field: ProjectSortField) => {
    const [currentField, currentDir] = sort.split(',')
    if (currentField !== field) return '↕'
    return currentDir === 'desc' ? '↓' : '↑'
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Загрузка проектов...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Ошибка загрузки: {String(error)}</div>
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          Проектов по этим условиям нет — ослабьте фильтры
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <ExportButtons endpoint="/api/export/projects" query={queryString} total={data.total} noun="проектов" />
      <div className={styles.header}>
        <div className={styles.count}>Найдено: {data.total}</div>
        <div className={styles.sortButtons}>
          <button
            className={styles.sortButton}
            onClick={() => handleSortClick('amountMln')}
            title="Сортировать по объёму"
          >
            Объём {getSortIcon('amountMln')}
          </button>
          <button
            className={styles.sortButton}
            onClick={() => handleSortClick('jobs')}
            title="Сортировать по рабочим местам"
          >
            Места {getSortIcon('jobs')}
          </button>
          <button
            className={styles.sortButton}
            onClick={() => handleSortClick('startYear')}
            title="Сортировать по году старта"
          >
            Старт {getSortIcon('startYear')}
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {data.items.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            isSelected={project.id === selectedId}
            onClick={() => onSelectProject(project.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface ProjectRowProps {
  project: ProjectShort
  isSelected: boolean
  onClick: () => void
}

function ProjectRow({ project, isSelected, onClick }: ProjectRowProps) {
  return (
    <div
      className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
      onClick={onClick}
    >
      <div className={styles.rowHeader}>
        <h3 className={styles.title}>{project.title}</h3>
        {project.isKey && <span className={styles.keyBadge}>ключевой</span>}
      </div>
      <div className={styles.initiator}>{project.initiator}</div>
      <div className={styles.meta}>
        <span className={styles.municipality}>{project.municipalityName}</span>
        <span className={`${styles.stageBadge} ${styles[`stage-${project.stage}`]}`}>
          {project.stageName}
        </span>
      </div>
      <div className={styles.stats}>
        <span className={styles.amount}>{formatMoney(project.amountMln)}</span>
        <span className={styles.years}>
          {formatYears(project.startYear, project.launchYear)}
        </span>
        {!!project.jobs && project.jobs > 0 && (
          <span className={styles.jobs}>{project.jobs} мест</span>
        )}
      </div>
    </div>
  )
}
