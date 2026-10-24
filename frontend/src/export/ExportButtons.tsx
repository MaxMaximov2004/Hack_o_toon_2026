import { useState } from 'react'
import { filterToQuery } from '../filters/filterToQuery'
import type { CompanyFilters } from '../filters/types'
import { downloadBlob } from './downloadBlob'
import { getToken } from '../api/apiFetch'
import { ConfirmDialog } from './ConfirmDialog'
import { Toast } from '../ui/Toast'
import styles from './ExportButtons.module.css'

interface ExportButtonsProps {
  filters: CompanyFilters
  total: number
}

export function ExportButtons({ filters, total }: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFormat, setPendingFormat] = useState<'csv' | 'bitrix' | null>(null)

  const handleButtonClick = (format: 'csv' | 'bitrix') => {
    setPendingFormat(format)
  }

  const handleConfirm = async () => {
    const format = pendingFormat
    setPendingFormat(null)

    if (!format) return

    setIsExporting(true)
    setError(null)

    try {
      const query = filterToQuery(filters)
      const url = `/api/export/companies?${query}&format=${format}`

      // Получаем токен
      const token = getToken()
      if (!token) {
        throw new Error('Требуется авторизация')
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 413) {
          const data = await response.json()
          const count = data.error?.details?.total || total
          throw new Error(`Слишком много, сузьте фильтр (${count} компаний)`)
        }

        const data = await response.json()
        throw new Error(data.error?.message || 'Ошибка экспорта')
      }

      // Скачиваем blob
      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      const fallbackFilename = format === 'csv' ? 'export.csv' : 'export_bitrix.csv'
      downloadBlob(blob, contentDisposition, fallbackFilename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка экспорта')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <div className={styles.container}>
        <button
          className={styles.button}
          onClick={() => handleButtonClick('csv')}
          disabled={isExporting || total === 0}
        >
          CSV
        </button>
        <button
          className={styles.button}
          onClick={() => handleButtonClick('bitrix')}
          disabled={isExporting || total === 0}
        >
          В CRM
        </button>
      </div>

      {pendingFormat && (
        <ConfirmDialog
          title="Экспорт компаний"
          message={`Будет выгружено ${total} компаний`}
          onConfirm={handleConfirm}
          onCancel={() => setPendingFormat(null)}
        />
      )}

      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
    </>
  )
}
