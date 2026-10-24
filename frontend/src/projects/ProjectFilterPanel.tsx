import { useQuery } from '@tanstack/react-query'
import { getDictionaries } from '../api/endpoints'
import type { ProjectFilters } from './types'
import { useState, useMemo } from 'react'
import styles from './ProjectFilterPanel.module.css'

interface ProjectFilterPanelProps {
  filters: ProjectFilters
  onFiltersChange: (updates: Partial<ProjectFilters>) => void
  onReset: () => void
}

export function ProjectFilterPanel({
  filters,
  onFiltersChange,
  onReset,
}: ProjectFilterPanelProps) {
  const { data: dictionaries } = useQuery({
    queryKey: ['dictionaries'],
    queryFn: getDictionaries,
    staleTime: Infinity,
  })

  const [searchQuery, setSearchQuery] = useState(filters.q || '')
  const [amountMinInput, setAmountMinInput] = useState(
    filters.amountMin ? String(filters.amountMin) : ''
  )

  const handleStageToggle = (code: string) => {
    const current = filters.stage || []
    const newStages = current.includes(code)
      ? current.filter((s) => s !== code)
      : [...current, code]
    onFiltersChange({ stage: newStages.length > 0 ? newStages : undefined })
  }

  const handleNeedToggle = (code: string) => {
    const current = filters.need || []
    const newNeeds = current.includes(code)
      ? current.filter((n) => n !== code)
      : [...current, code]
    onFiltersChange({ need: newNeeds.length > 0 ? newNeeds : undefined })
  }

  const handleIndustryChange = (selected: string[]) => {
    onFiltersChange({ industry: selected.length > 0 ? selected : undefined })
  }

  const handleMunicipalityChange = (selected: number[]) => {
    onFiltersChange({ municipalityId: selected.length > 0 ? selected : undefined })
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    // Дебаунс через setTimeout
    const timer = setTimeout(() => {
      onFiltersChange({ q: value.length >= 2 ? value : undefined })
    }, 300)
    return () => clearTimeout(timer)
  }

  const handleAmountMinChange = (value: string) => {
    setAmountMinInput(value)
    const num = value === '' ? undefined : Number(value)
    if (num !== undefined && !isNaN(num)) {
      onFiltersChange({ amountMin: num })
    } else if (value === '') {
      onFiltersChange({ amountMin: undefined })
    }
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.stage && filters.stage.length > 0) count++
    if (filters.industry && filters.industry.length > 0) count++
    if (filters.need && filters.need.length > 0) count++
    if (filters.municipalityId && filters.municipalityId.length > 0) count++
    if (filters.yearFrom || filters.yearTo) count++
    if (filters.isKey) count++
    if (filters.amountMin) count++
    if (filters.q) count++
    return count
  }, [filters])

  if (!dictionaries) {
    return <div className={styles.container}>Загрузка...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Фильтры</h2>
        {activeFiltersCount > 0 && (
          <button className={styles.resetButton} onClick={onReset}>
            Сбросить ({activeFiltersCount})
          </button>
        )}
      </div>

      {/* Поиск */}
      <div className={styles.section}>
        <label className={styles.label}>Поиск</label>
        <input
          type="search"
          className={styles.input}
          placeholder="Название или инициатор"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Стадии - чипы */}
      <div className={styles.section}>
        <label className={styles.label}>Стадия</label>
        <div className={styles.chips}>
          {dictionaries.stages.map((stage) => (
            <button
              key={stage.code}
              className={`${styles.chip} ${
                filters.stage?.includes(stage.code) ? styles.chipActive : ''
              }`}
              onClick={() => handleStageToggle(stage.code)}
            >
              {stage.name}
            </button>
          ))}
        </div>
      </div>

      {/* Потребности - чипы */}
      <div className={styles.section}>
        <label className={styles.label}>Потребности</label>
        <div className={styles.chips}>
          {dictionaries.needs.map((need) => (
            <button
              key={need.code}
              className={`${styles.chip} ${
                filters.need?.includes(need.code) ? styles.chipActive : ''
              }`}
              onClick={() => handleNeedToggle(need.code)}
              title={need.name}
            >
              {need.name}
            </button>
          ))}
        </div>
      </div>

      {/* Отрасль - мультиселект */}
      <div className={styles.section}>
        <label className={styles.label}>Отрасль</label>
        <MultiSelect
          options={dictionaries.industries.map((i) => ({ value: i.code, label: i.name }))}
          selected={filters.industry || []}
          onChange={handleIndustryChange}
          placeholder="Выберите отрасли"
        />
      </div>

      {/* Район - мультиселект */}
      <div className={styles.section}>
        <label className={styles.label}>Район / Город</label>
        <MultiSelect
          options={dictionaries.municipalities.map((m) => ({
            value: String(m.id),
            label: m.name,
          }))}
          selected={(filters.municipalityId || []).map(String)}
          onChange={(selected) => handleMunicipalityChange(selected.map(Number))}
          placeholder="Выберите районы"
        />
      </div>

      {/* Объём от */}
      <div className={styles.section}>
        <label className={styles.label}>Объём от, млн ₽</label>
        <input
          type="number"
          className={styles.input}
          placeholder="Минимальный объём"
          value={amountMinInput}
          onChange={(e) => handleAmountMinChange(e.target.value)}
          min="0"
        />
      </div>

      {/* Только ключевые */}
      <div className={styles.section}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={filters.isKey || false}
            onChange={(e) => onFiltersChange({ isKey: e.target.checked || undefined })}
          />
          <span>Только ключевые</span>
        </label>
      </div>
    </div>
  )
}

// Простой мультиселект
interface MultiSelectProps {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder: string
}

function MultiSelect({ options, selected, onChange, placeholder }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleToggle = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    onChange(newSelected)
  }

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean)
    .join(', ')

  return (
    <div className={styles.multiSelect}>
      <button
        className={styles.multiSelectTrigger}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {selectedLabels || placeholder}
        <span className={styles.multiSelectArrow}>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className={styles.multiSelectDropdown}>
          {options.map((option) => (
            <label key={option.value} className={styles.multiSelectOption}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => handleToggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
