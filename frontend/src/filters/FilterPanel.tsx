import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDictionaries } from '../api/endpoints'
import type { CompanyFilters } from './types'
import { Checkbox } from '../ui/Checkbox'
import type { Map } from 'maplibre-gl'
import styles from './FilterPanel.module.css'

interface FilterPanelProps {
  filters: CompanyFilters
  onFiltersChange: (updates: Partial<CompanyFilters>) => void
  onReset: () => void
  mapRef?: React.RefObject<Map | null>
  hideHeader?: boolean
  onExcludedPresetApply?: () => void
}

export function FilterPanel({ filters, onFiltersChange, onReset, mapRef, hideHeader, onExcludedPresetApply }: FilterPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [revenueMinMln, setRevenueMinMln] = useState('')
  const [revenueMaxMln, setRevenueMaxMln] = useState('')
  const [growthMin, setGrowthMin] = useState('')
  const [municipalitySearch, setMunicipalitySearch] = useState('')

  const { data: dictionaries } = useQuery({
    queryKey: ['dictionaries'],
    queryFn: getDictionaries,
    staleTime: Infinity,
  })

  // Дебаунс для поиска
  const handleSearchChange = useMemo(
    () => {
      let timeout: NodeJS.Timeout
      return (value: string) => {
        setSearchQuery(value)
        clearTimeout(timeout)
        timeout = setTimeout(() => {
          onFiltersChange({ q: value || undefined })
        }, 300)
      }
    },
    [onFiltersChange]
  )

  const handleRevenueMinChange = (value: string) => {
    setRevenueMinMln(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0) {
      setTimeout(() => onFiltersChange({ revenueMin: num * 1_000_000 }), 300)
    } else if (value === '') {
      setTimeout(() => onFiltersChange({ revenueMin: undefined }), 300)
    }
  }

  const handleRevenueMaxChange = (value: string) => {
    setRevenueMaxMln(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0) {
      setTimeout(() => onFiltersChange({ revenueMax: num * 1_000_000 }), 300)
    } else if (value === '') {
      setTimeout(() => onFiltersChange({ revenueMax: undefined }), 300)
    }
  }

  const handleGrowthMinChange = (value: string) => {
    setGrowthMin(value)
    const num = parseFloat(value)
    if (!isNaN(num)) {
      setTimeout(() => onFiltersChange({ growthMin: num }), 300)
    } else if (value === '') {
      setTimeout(() => onFiltersChange({ growthMin: undefined }), 300)
    }
  }

  const filteredMunicipalities = useMemo(() => {
    if (!dictionaries?.municipalities) return []
    const search = municipalitySearch.toLowerCase()
    return dictionaries.municipalities.filter((m) =>
      m.name.toLowerCase().includes(search)
    )
  }, [dictionaries, municipalitySearch])

  const toggleIndustry = (code: string) => {
    const current = filters.industry || []
    const updated = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code]
    onFiltersChange({ industry: updated.length > 0 ? updated : undefined })
  }

  const toggleMunicipality = (id: number) => {
    const current = filters.municipalityId || []
    const updated = current.includes(id)
      ? current.filter((i) => i !== id)
      : [...current, id]
    onFiltersChange({ municipalityId: updated.length > 0 ? updated : undefined })

    // Если добавили муниципалитет (не удалили) — перелетаем к нему
    if (!current.includes(id) && dictionaries && mapRef?.current) {
      const selectedMunicipalities = [...updated].map(mId =>
        dictionaries.municipalities.find(m => m.id === mId)
      ).filter(Boolean) as typeof dictionaries.municipalities

      if (selectedMunicipalities.length > 0) {
        // Вычисляем bbox для всех выбранных муниципалитетов
        const lats = selectedMunicipalities.map(m => m.lat)
        const lons = selectedMunicipalities.map(m => m.lon)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        const minLon = Math.min(...lons)
        const maxLon = Math.max(...lons)

        // Отступ ~10%
        const latPadding = (maxLat - minLat) * 0.1 || 0.05
        const lonPadding = (maxLon - minLon) * 0.1 || 0.05

        mapRef.current.fitBounds(
          [
            [minLon - lonPadding, minLat - latPadding],
            [maxLon + lonPadding, maxLat + latPadding]
          ],
          { duration: 800, padding: 50 }
        )
      }
    }
  }

  const toggleSizeCategory = (code: string) => {
    const current = filters.sizeCategory || []
    const updated = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code]
    onFiltersChange({ sizeCategory: updated.length > 0 ? updated : undefined })
  }

  // Подсчёт исключённых клиентов (110 из мока)
  const excludedClients = 110

  // Проверяем активен ли пресет
  const isPresetActive = filters.client === 'ours' && filters.status === 'excluded'

  const handleExcludedPreset = () => {
    if (isPresetActive) {
      // Снять пресет - вернуться к дефолтным значениям
      onFiltersChange({ client: 'all', status: 'active' })
    } else {
      // Применить пресет - ВСЕ параметры одним вызовом
      onFiltersChange({
        client: 'ours',
        status: 'excluded',
        // Сбросить bbox
        minLat: undefined,
        maxLat: undefined,
        minLon: undefined,
        maxLon: undefined
      })
      // Вызвать callback для закрытия панели и других действий
      onExcludedPresetApply?.()
    }
  }

  return (
    <div className={styles.panel}>
      {!hideHeader && (
        <div className={styles.header}>
          <h2 className={styles.title}>Фильтры</h2>
          <button className={styles.resetButton} onClick={onReset}>
            Сбросить
          </button>
        </div>
      )}

      <div className={styles.content}>
        {/* Пресет: Исключённые клиенты */}
        <div className={styles.section}>
          <button
            className={isPresetActive ? styles.presetButtonActive : styles.presetButtonOutline}
            onClick={handleExcludedPreset}
          >
            {isPresetActive && <span className={styles.presetCross}>×</span>}
            Исключённые клиенты
          </button>
          <p className={styles.excludedInfo}>
            {excludedClients} из 759 клиентов исключены из реестра МСП
          </p>
        </div>
        {/* Поиск */}
        <div className={styles.section}>
          <label className={styles.label}>Поиск по названию или ИНН</label>
          <input
            type="text"
            className={styles.input}
            placeholder="Введите название или ИНН"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Отрасль */}
        <div className={styles.section}>
          <label className={styles.label}>Отрасль</label>
          <div className={styles.checkboxGroup}>
            {dictionaries?.industries.map((industry) => (
              <Checkbox
                key={industry.code}
                label={industry.name}
                checked={(filters.industry || []).includes(industry.code)}
                onChange={() => toggleIndustry(industry.code)}
              />
            ))}
          </div>
        </div>

        {/* Выручка */}
        <div className={styles.section}>
          <label className={styles.label}>Выручка (млн ₽/год)</label>
          <div className={styles.rangeInputs}>
            <input
              type="number"
              className={styles.input}
              placeholder="От"
              value={revenueMinMln}
              onChange={(e) => handleRevenueMinChange(e.target.value)}
              min="0"
              step="1"
            />
            <span className={styles.rangeSeparator}>—</span>
            <input
              type="number"
              className={styles.input}
              placeholder="До"
              value={revenueMaxMln}
              onChange={(e) => handleRevenueMaxChange(e.target.value)}
              min="0"
              step="1"
            />
          </div>
        </div>

        {/* Район/Город */}
        <div className={styles.section}>
          <label className={styles.label}>Район/Город</label>
          <input
            type="text"
            className={styles.input}
            placeholder="Поиск..."
            value={municipalitySearch}
            onChange={(e) => setMunicipalitySearch(e.target.value)}
          />
          <div className={styles.checkboxGroup}>
            {filteredMunicipalities.slice(0, 10).map((municipality) => (
              <Checkbox
                key={municipality.id}
                label={`${municipality.name} (${municipality.kind === 'city' ? 'город' : 'район'})`}
                checked={(filters.municipalityId || []).includes(municipality.id)}
                onChange={() => toggleMunicipality(municipality.id)}
              />
            ))}
          </div>
        </div>

        {/* Категория */}
        <div className={styles.section}>
          <label className={styles.label}>Категория</label>
          <div className={styles.checkboxGroup}>
            {dictionaries?.sizeCategories.map((category) => (
              <Checkbox
                key={category.code}
                label={category.name}
                checked={(filters.sizeCategory || []).includes(category.code)}
                onChange={() => toggleSizeCategory(category.code)}
              />
            ))}
          </div>
        </div>

        {/* Рост выручки */}
        <div className={styles.section}>
          <label className={styles.label}>Рост выручки от (%)</label>
          <input
            type="number"
            className={styles.input}
            placeholder="Минимальный рост"
            value={growthMin}
            onChange={(e) => handleGrowthMinChange(e.target.value)}
            step="1"
          />
        </div>

        {/* Только новые */}
        <div className={styles.section}>
          <Checkbox
            label="Только новые компании"
            checked={filters.isNew || false}
            onChange={(checked) => onFiltersChange({ isNew: checked || undefined })}
          />
        </div>

        {/* Показывать исключённых */}
        <div className={styles.section}>
          <Checkbox
            label="Показывать исключённых из реестра МСП"
            checked={filters.status === 'all'}
            onChange={(checked) => onFiltersChange({ status: checked ? 'all' : 'active' })}
          />
        </div>
      </div>
    </div>
  )
}
