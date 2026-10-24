/**
 * Нормализация текста: lowercase + ё→е
 */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е')
}

/**
 * Проверяет, начинается ли какое-то слово в тексте с поискового запроса
 * Возвращает тип совпадения для сортировки
 */
export function matchWordStart(
  text: string,
  query: string
): 'exact' | 'startFirst' | 'startOther' | null {
  if (!query) {
    return null
  }

  const normText = normalize(text)
  const normQuery = normalize(query)

  if (normText === normQuery) {
    return 'exact'
  }

  const words = normText.split(/\s+/)

  if (words[0].startsWith(normQuery)) {
    return 'startFirst'
  }

  for (let i = 1; i < words.length; i++) {
    if (words[i].startsWith(normQuery)) {
      return 'startOther'
    }
  }

  return null
}
