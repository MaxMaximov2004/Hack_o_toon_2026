import { Fragment } from 'react'

/**
 * Подсвечивает совпадения поискового запроса в тексте
 */
export function highlightText(text: string, query: string | undefined): React.ReactNode {
  if (!query || query.length < 2) {
    return text
  }

  // Экранируем спецсимволы регулярных выражений
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} style={{ backgroundColor: '#FFD700', fontWeight: 'bold' }}>
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </>
  )
}
