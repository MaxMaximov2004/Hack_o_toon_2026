import { useQuery } from '@tanstack/react-query'
import { getProjectTimeline } from '../api/endpoints'
import { projectFilterToQuery } from './projectFilterToQuery'
import type { ProjectFilters } from './types'
import type { TimelineEvent } from '../api/types'
import { useState, useMemo } from 'react'
import { formatMoney } from '../utils/formatMoney'
import styles from './ProjectTimeline.module.css'

interface ProjectTimelineProps {
  filters: ProjectFilters
  onSelectProject: (id: number) => void
  onYearRangeChange: (yearFrom: number | undefined, yearTo: number | undefined) => void
}

export function ProjectTimeline({
  filters,
  onSelectProject,
  onYearRangeChange,
}: ProjectTimelineProps) {
  const queryString = projectFilterToQuery(filters)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['timeline', queryString],
    queryFn: () => getProjectTimeline(queryString),
    staleTime: 30000,
  })

  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null)

  // Ограничиваем maxYear до 2035, всё позже — "2036+"
  const displayMaxYear = data?.maxYear != null ? Math.min(data.maxYear, 2035) : 2035

  // Годы для отображения
  const years = useMemo(() => {
    // minYear = null — под фильтром нет ни одного события
    if (!data || data.minYear === null) return []
    const result: number[] = []
    for (let y = data.minYear; y <= displayMaxYear; y++) {
      result.push(y)
    }
    // Если есть события после 2035, добавляем виртуальный год "2036+"
    const hasFutureEvents = data.years.some((yearData) => yearData.year > 2035)
    if (hasFutureEvents) {
      result.push(2036) // Маркер для "2036+"
    }
    return result
  }, [data, displayMaxYear])

  const handleYearMouseDown = (year: number) => {
    setDragStart(year)
    setDragEnd(year)
  }

  const handleYearMouseEnter = (year: number) => {
    if (dragStart !== null) {
      setDragEnd(year)
    }
  }

  const handleYearMouseUp = () => {
    if (dragStart !== null && dragEnd !== null) {
      const from = Math.min(dragStart, dragEnd)
      const to = Math.max(dragStart, dragEnd)
      onYearRangeChange(from, to === 2036 ? undefined : to)
    }
    setDragStart(null)
    setDragEnd(null)
  }

  const handleClearRange = () => {
    onYearRangeChange(undefined, undefined)
  }

  const isYearSelected = (year: number) => {
    if (!filters.yearFrom && !filters.yearTo) return false
    const from = filters.yearFrom || -Infinity
    const to = filters.yearTo || Infinity
    return year >= from && year <= to
  }

  const isYearInDrag = (year: number) => {
    if (dragStart === null || dragEnd === null) return false
    const from = Math.min(dragStart, dragEnd)
    const to = Math.max(dragStart, dragEnd)
    return year >= from && year <= to
  }

  if (isLoading) {
    return <div className={styles.container}>Загрузка таймлайна...</div>
  }

  if (isError) {
    const errorMessage = (() => {
      if (error instanceof Error) {
        // Проверяем HTTP-ошибки
        if (error.message.includes('404') || error.message.includes('502')) {
          return 'Сервис таймлайна недоступен'
        }
        return error.message
      }
      return 'Неизвестная ошибка'
    })()

    return (
      <div className={styles.container}>
        <div className={styles.error}>
          Не удалось загрузить таймлайн: {errorMessage}
          <button className={styles.retryButton} onClick={() => refetch()}>
            Повторить
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className={styles.container}>Нет данных</div>
  }

  return (
    <div className={styles.container} onMouseUp={handleYearMouseUp} onMouseLeave={handleYearMouseUp}>
      <div className={styles.header}>
        <div className={styles.info}>
          Всего проектов: {data.total}
          {(filters.yearFrom || filters.yearTo) && (
            <>
              {' · '}
              Диапазон: {filters.yearFrom || data.minYear}–{filters.yearTo || 2035}
              <button className={styles.clearButton} onClick={handleClearRange}>
                ✕
              </button>
            </>
          )}
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.eventStart}`}></span>
            Старт
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.eventLaunch}`}></span>
            Запуск
          </span>
        </div>
      </div>

      <div className={styles.timeline}>
        {years.map((year) => {
          const yearData = data.years.find((y) => y.year === year)
          const events = year === 2036
            ? data.years.filter((y) => y.year > 2035).flatMap((y) => y.events)
            : yearData?.events || []

          return (
            <div
              key={year}
              className={`${styles.yearColumn} ${
                isYearSelected(year) || isYearInDrag(year) ? styles.yearSelected : ''
              }`}
              onMouseDown={() => handleYearMouseDown(year)}
              onMouseEnter={() => handleYearMouseEnter(year)}
            >
              <div className={styles.yearLabel}>
                {year === 2036 ? '2036+' : year}
              </div>
              <div className={styles.eventsContainer}>
                {events.map((event, idx) => (
                  <div
                    key={`${event.projectId}-${event.type}-${idx}`}
                    className={`${styles.event} ${styles[`event-${event.type}`]}`}
                    style={{
                      width: `${Math.min(Math.log((event.amountMln ?? 0) + 1) * 3, 20)}px`,
                      height: `${Math.min(Math.log((event.amountMln ?? 0) + 1) * 3, 20)}px`,
                    }}
                    onClick={() => onSelectProject(event.projectId)}
                    onMouseEnter={() => setHoveredEvent(event)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    title={`${event.title} (${event.municipalityName})`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Подсказка при наведении */}
      {hoveredEvent && (
        <div className={styles.tooltip}>
          <div className={styles.tooltipTitle}>{hoveredEvent.title}</div>
          <div className={styles.tooltipMeta}>
            {hoveredEvent.municipalityName} · {formatMoney(hoveredEvent.amountMln)}
          </div>
        </div>
      )}
    </div>
  )
}
