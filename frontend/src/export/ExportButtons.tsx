import { useState } from 'react'
import { filterToQuery } from '../filters/filterToQuery'
import type { CompanyFilters } from '../filters/types'
import { downloadBlob } from './downloadBlob'
import { apiFetch, type BlobResponse } from '../api/apiFetch'
import { ConfirmDialog } from './ConfirmDialog'
import { Toast } from '../ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { ImportClientsDialog } from './ImportClientsDialog'
import type { ApiError } from '../api/types'
import styles from './ExportButtons.module.css'

interface ExportButtonsProps {
  filters: CompanyFilters
  total: number
}

export function ExportButtons({ filters, total }: ExportButtonsProps) {
  const { user } = useAuth()
  const isAdmin = !!user?.roles.includes('admin')
  const [importOpen, setImportOpen] = useState(false)
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

      const { blob, filename } = await apiFetch<BlobResponse>(url, {
        responseType: 'blob',
      })

      const fallbackFilename = format === 'csv' ? 'export.csv' : 'export_bitrix.csv'
      downloadBlob(blob, null, filename || fallbackFilename)
    } catch (err) {
      // Обработка ApiError
      if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
        const apiError = err as ApiError

        // Специальная обработка для 413
        if (apiError.code === 'TOO_LARGE' || apiError.code === 'PAYLOAD_TOO_LARGE') {
          const count = apiError.details?.total || total
          setError(`Слишком много, сузьте фильтр (${count} компаний)`)
        } else {
          setError(apiError.message)
        }
      } else {
        setError('Ошибка экспорта')
      }
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
        {isAdmin && (
          <button className={`${styles.button} ${styles.adminButton}`} onClick={() => setImportOpen(true)}>
            Обновить список клиентов
          </button>
        )}
      </div>

      {importOpen && <ImportClientsDialog onClose={() => setImportOpen(false)} />}

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
