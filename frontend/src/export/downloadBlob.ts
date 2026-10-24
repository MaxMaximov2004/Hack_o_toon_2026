/**
 * Скачивает blob с именем из Content-Disposition заголовка
 */
export function downloadBlob(blob: Blob, contentDisposition: string | null, fallbackFilename: string) {
  // Парсим filename из Content-Disposition
  // Сначала ищем filename*=UTF-8''..., потом filename="..."
  let filename = fallbackFilename

  if (contentDisposition) {
    // RFC 5987: filename*=UTF-8''encoded%20name
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/)
    if (utf8Match) {
      filename = decodeURIComponent(utf8Match[1])
    } else {
      // Обычный: filename="name" или filename=name
      const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/)
      if (asciiMatch) {
        filename = asciiMatch[1]
      }
    }
  }

  // Создаём ссылку и кликаем
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Отложенная очистка, чтобы браузер успел начать скачивание
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 100)
}
