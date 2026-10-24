import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDictionaries, getCompanies } from '../api/endpoints'
import { filterToQuery } from '../filters/filterToQuery'
import type { CompanyFilters } from '../filters/types'
import { matchWordStart } from './matchWordStart'
import styles from './SmartSearch.module.css'

interface SmartSearchProps {
  filters: CompanyFilters
  onFiltersChange: (updates: Partial<CompanyFilters>) => void
  onSelectCompany: (id: number) => void
}

interface Suggestion {
  type: 'industry' | 'municipality' | 'sizeCategory' | 'isNew' | 'company'
  label: string
  value: string | number
  meta?: string
  matchType?: 'exact' | 'startFirst' | 'startOther' // для сортировки
}

export function SmartSearch({ filters, onFiltersChange, onSelectCompany }: SmartSearchProps) {
  const [inputValue, setInputValue] = useState(filters.q || '')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout>()

  const { data: dictionaries } = useQuery({
    queryKey: ['dictionaries'],
    queryFn: getDictionaries,
    staleTime: Infinity,
  })

  // Получаем топ-5 компаний для подсказок
  const shouldFetchCompanies = inputValue.length >= 2
  const companiesQueryString = useMemo(() => {
    if (!shouldFetchCompanies) return ''
    return filterToQuery({ ...filters, q: inputValue }) + '&page=0&size=5&sort=revenueEst,desc'
  }, [shouldFetchCompanies, filters, inputValue])

  const { data: companiesData } = useQuery({
    queryKey: ['search-suggestions', companiesQueryString],
    queryFn: () => getCompanies(companiesQueryString),
    enabled: shouldFetchCompanies && isFocused,
    staleTime: 30000,
  })

  // Генерируем подсказки
  const suggestions = useMemo((): Suggestion[] => {
    if (!dictionaries || inputValue.length < 2) return []

    const results: Suggestion[] = []

    // Поиск в отраслях
    dictionaries.industries.forEach((ind) => {
      const matchType = matchWordStart(ind.name, inputValue)
      if (matchType) {
        results.push({
          type: 'industry',
          label: ind.name,
          value: ind.code,
          meta: 'Отрасль',
          matchType,
        })
      }
    })

    // Поиск в районах/городах
    dictionaries.municipalities.forEach((mun) => {
      const matchType = matchWordStart(mun.name, inputValue)
      if (matchType) {
        results.push({
          type: 'municipality',
          label: mun.name,
          value: mun.id,
          meta: mun.kind === 'city' ? 'Город' : 'Район',
          matchType,
        })
      }
    })

    // Поиск в категориях
    dictionaries.sizeCategories.forEach((cat) => {
      const matchType = matchWordStart(cat.name, inputValue)
      if (matchType) {
        results.push({
          type: 'sizeCategory',
          label: cat.name,
          value: cat.code,
          meta: 'Категория',
          matchType,
        })
      }
    })

    // Поиск слова "новые"
    const newMatchType = matchWordStart('новые компании', inputValue)
    if (newMatchType) {
      results.push({
        type: 'isNew',
        label: 'Новые компании',
        value: 'true',
        meta: 'Фильтр',
        matchType: newMatchType,
      })
    }

    // Компании (топ-5)
    if (companiesData?.items) {
      companiesData.items.forEach((company) => {
        results.push({
          type: 'company',
          label: company.name,
          value: company.id,
          meta: company.industryName,
        })
      })
    }

    // Сортировка: exact → startFirst → startOther; внутри группы по алфавиту
    const matchTypeOrder = { exact: 1, startFirst: 2, startOther: 3 }

    return results.sort((a, b) => {
      // Компании всегда в конце
      if (a.type === 'company' && b.type !== 'company') return 1
      if (a.type !== 'company' && b.type === 'company') return -1
      if (a.type === 'company' && b.type === 'company') return 0

      // Сортировка по типу совпадения
      const orderA = matchTypeOrder[a.matchType || 'startOther']
      const orderB = matchTypeOrder[b.matchType || 'startOther']

      if (orderA !== orderB) {
        return orderA - orderB
      }

      // Внутри группы по алфавиту
      return a.label.localeCompare(b.label, 'ru')
    })
  }, [dictionaries, companiesData, inputValue])

  // Обработка изменения ввода
  const handleInputChange = (value: string) => {
    setInputValue(value)
    setSelectedIndex(-1)

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      // Если это 10 или 12 цифр - поиск по ИНН
      if (/^\d{10}$|^\d{12}$/.test(value.trim())) {
        onFiltersChange({ q: value.trim() })
      } else if (value.length >= 2) {
        onFiltersChange({ q: value })
      } else {
        onFiltersChange({ q: undefined })
      }
    }, 300)
  }

  // Обработка выбора подсказки
  const handleSelectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      if (suggestion.type === 'company') {
        onSelectCompany(suggestion.value as number)
        setIsFocused(false)
        return
      }

      // Очищаем строку поиска
      setInputValue('')

      // Добавляем фильтр (без дублей)
      const updates: Partial<CompanyFilters> = { q: undefined }

      if (suggestion.type === 'industry') {
        const current = filters.industry || []
        if (!current.includes(suggestion.value as string)) {
          updates.industry = [...current, suggestion.value as string]
        }
      } else if (suggestion.type === 'municipality') {
        const current = filters.municipalityId || []
        if (!current.includes(suggestion.value as number)) {
          updates.municipalityId = [...current, suggestion.value as number]
        }
      } else if (suggestion.type === 'sizeCategory') {
        const current = filters.sizeCategory || []
        if (!current.includes(suggestion.value as string)) {
          updates.sizeCategory = [...current, suggestion.value as string]
        }
      } else if (suggestion.type === 'isNew') {
        updates.isNew = true
      }

      // Применяем все обновления за один раз
      onFiltersChange(updates)

      setIsFocused(false)
      inputRef.current?.blur()
    },
    [filters, onFiltersChange, onSelectCompany]
  )

  // Обработка Enter - разбор текста
  const handleEnter = useCallback(() => {
    // Если выделена подсказка — применить её
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSelectSuggestion(suggestions[selectedIndex])
      return
    }

    if (!dictionaries || inputValue.length < 2) return

    // 10 или 12 цифр — это ИНН, сразу в q
    if (/^\d{10}$|^\d{12}$/.test(inputValue.trim())) {
      onFiltersChange({ q: inputValue.trim() })
      setInputValue('')
      setIsFocused(false)
      inputRef.current?.blur()
      return
    }

    const words = inputValue.split(/\s+/)
    const parsedWords: string[] = [] // слова, которые распознаны как фильтры
    const updates: Partial<CompanyFilters> = {}

    words.forEach((word) => {
      if (word.length < 2) return

      // Проверяем отрасли (с началом слова)
      const industry = dictionaries.industries.find((ind) => matchWordStart(ind.name, word))
      if (industry) {
        const current = filters.industry || []
        if (!current.includes(industry.code)) {
          updates.industry = [...(updates.industry || current), industry.code]
        }
        parsedWords.push(word)
        return
      }

      // Проверяем районы (с началом слова)
      const municipality = dictionaries.municipalities.find((mun) => matchWordStart(mun.name, word))
      if (municipality) {
        const current = filters.municipalityId || []
        if (!current.includes(municipality.id)) {
          updates.municipalityId = [...(updates.municipalityId || current), municipality.id]
        }
        parsedWords.push(word)
        return
      }

      // Проверяем категории (с началом слова)
      const sizeCategory = dictionaries.sizeCategories.find((cat) => matchWordStart(cat.name, word))
      if (sizeCategory) {
        const current = filters.sizeCategory || []
        if (!current.includes(sizeCategory.code)) {
          updates.sizeCategory = [...(updates.sizeCategory || current), sizeCategory.code]
        }
        parsedWords.push(word)
        return
      }

      // Проверяем "новые компании"
      if (matchWordStart('новые компании', word) || matchWordStart('новые', word)) {
        updates.isNew = true
        parsedWords.push(word)
      }
    })

    // Удаляем распознанные слова из ввода
    let remainingWords = words.filter((word) => !parsedWords.includes(word))
    const finalText = remainingWords.join(' ').trim()

    // Применяем все обновления за один раз
    const allUpdates: Partial<CompanyFilters> = { ...updates }

    // Если весь текст распознан — q не ставить
    if (finalText.length >= 2) {
      allUpdates.q = finalText
    } else if (finalText.length === 0 && parsedWords.length > 0) {
      // Весь текст распознан, q не нужен
      allUpdates.q = undefined
    }

    onFiltersChange(allUpdates)

    // Очищаем поле только если всё распознано, иначе оставляем нераспознанное
    setInputValue(finalText)
    setIsFocused(false)
    inputRef.current?.blur()
  }, [selectedIndex, suggestions, inputValue, dictionaries, filters, onFiltersChange, handleSelectSuggestion])

  // Клавиатурная навигация
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleEnter()
    } else if (e.key === 'Escape') {
      setIsFocused(false)
      inputRef.current?.blur()
    }
  }

  // Глобальная клавиша "/" для фокуса
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !isFocused && e.target === document.body) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isFocused])

  // Синхронизация с filters.q
  useEffect(() => {
    if (!isFocused && filters.q !== inputValue) {
      setInputValue(filters.q || '')
    }
  }, [filters.q, isFocused])

  // Скролл к выбранной подсказке
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selected = suggestionsRef.current.children[selectedIndex] as HTMLElement
      if (selected && selected.scrollIntoView) {
        selected.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  const showSuggestions = isFocused && suggestions.length > 0

  // Обработка submit формы
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleEnter()
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit}>
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            className={styles.input}
            placeholder="Название, ИНН, отрасль, город"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Задержка для обработки клика по подсказке
              setTimeout(() => setIsFocused(false), 200)
            }}
            onKeyDown={handleKeyDown}
          />
          {inputValue && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => {
                setInputValue('')
                onFiltersChange({ q: undefined })
                inputRef.current?.focus()
              }}
              aria-label="Очистить"
            >
              ×
            </button>
          )}
        </div>
      </form>

      {showSuggestions && (
        <div ref={suggestionsRef} className={styles.suggestions}>
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.value}`}
              className={`${styles.suggestion} ${index === selectedIndex ? styles.selected : ''}`}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className={styles.suggestionLabel}>{suggestion.label}</div>
              <div className={styles.suggestionMeta}>{suggestion.meta}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
