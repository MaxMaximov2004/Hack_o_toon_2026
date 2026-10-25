import { useState } from 'react'
import { downloadBlob } from './downloadBlob'
import { apiFetch, type BlobResponse } from '../api/apiFetch'
import { ConfirmDialog } from './ConfirmDialog'
import { Toast } from '../ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { ImportClientsDialog } from './ImportClientsDialog'
import type { ApiError } from '../api/types'
import styles from './ExportButtons.module.css'

interface ExportButtonsProps {
  /** `/api/export/companies` (Радар) или `/api/export/projects` (Навигатор) */
  endpoint: string
  /** Та же строка фильтра, что у списка на экране — выгрузка совпадает с ним */
  query: string
  total: number
  /** «компаний» / «проектов» — в подтверждении и ошибке */
  noun: string
  /** «Обновить список клиентов» для админа — только на Радаре */
  allowImport?: boolean
}

export function ExportButtons({ endpoint, query, total, noun, allowImport = false }: ExportButtonsProps) {
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
      const url = `${endpoint}?${query}${query ? '&' : ''}format=${format}`

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
          setError(`Слишком много, сузьте фильтр (${count} ${noun})`)
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
        {allowImport && isAdmin && (
          <button className={`${styles.button} ${styles.adminButton}`} onClick={() => setImportOpen(true)}>
            Обновить список клиентов
          </button>
        )}
      </div>

      {importOpen && <ImportClientsDialog onClose={() => setImportOpen(false)} />}

      {pendingFormat && (
        <ConfirmDialog
          title={`Экспорт ${noun}`}
          message={`Будет выгружено ${total} ${noun}`}
          onConfirm={handleConfirm}
          onCancel={() => setPendingFormat(null)}
        />
      )}

      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
    </>
  )
}
