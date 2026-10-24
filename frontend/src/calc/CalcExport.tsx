import { useState, type FormEvent } from 'react'
import { downloadBlob } from '../export/downloadBlob'
import { Toast } from '../ui/Toast'
import type { ApiError } from '../api/types'
import { postEstimateCsv, postProposal } from './api'
import type { EstimateRequest, ProposalClient } from './types'
import styles from './CalcExport.module.css'

interface CalcExportProps {
  body: EstimateRequest
  disabled: boolean
}

type ToastState = { message: string; type: 'success' | 'error' } | null

const errorText = (err: unknown) => (err as ApiError | null)?.message ?? 'Не удалось сформировать файл'

/** «CSV» — сразу скачивание; «КП (DOCX)» — сначала данные клиента. Тело то же, что у расчёта на экране */
export function CalcExport({ body, disabled }: CalcExportProps) {
  const [busy, setBusy] = useState<'csv' | 'docx' | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const downloadCsv = async () => {
    setBusy('csv')
    try {
      const { blob, filename } = await postEstimateCsv(body)
      downloadBlob(blob, null, filename || 'estimate.csv')
      setToast({ message: 'Таблица расчёта скачана', type: 'success' })
    } catch (err) {
      setToast({ message: errorText(err), type: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const downloadProposal = async (client: ProposalClient) => {
    setDialogOpen(false)
    setBusy('docx')
    try {
      const { blob, filename } = await postProposal(body, client)
      downloadBlob(blob, null, filename || 'proposal.docx')
      setToast({ message: 'Коммерческое предложение скачано', type: 'success' })
    } catch (err) {
      setToast({ message: errorText(err), type: 'error' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className={styles.buttons}>
        <button type="button" className={styles.secondaryButton} onClick={downloadCsv} disabled={disabled || busy !== null}>
          {busy === 'csv' ? 'Готовим CSV…' : 'Скачать CSV'}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setDialogOpen(true)}
          disabled={disabled || busy !== null}
        >
          {busy === 'docx' ? 'Готовим КП…' : 'Коммерческое предложение'}
        </button>
      </div>

      {dialogOpen && <ClientDialog onSubmit={downloadProposal} onCancel={() => setDialogOpen(false)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}

interface ClientDialogProps {
  onSubmit: (client: ProposalClient) => void
  onCancel: () => void
}

/** Клиент для шапки КП: название обязательно, ИНН (10 или 12 цифр) и контакт — по желанию */
export function ClientDialog({ onSubmit, onCancel }: ClientDialogProps) {
  const [name, setName] = useState('')
  const [inn, setInn] = useState('')
  const [contact, setContact] = useState('')

  const innValid = inn.trim() === '' || /^(\d{10}|\d{12})$/.test(inn.trim())
  const valid = name.trim() !== '' && innValid

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const client: ProposalClient = { name: name.trim() }
    if (inn.trim()) client.inn = inn.trim()
    if (contact.trim()) client.contact = contact.trim()
    onSubmit(client)
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-label="Клиент для коммерческого предложения"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className={styles.title}>Клиент</h3>
        <p className={styles.hint}>Попадёт в шапку коммерческого предложения</p>

        <label className={styles.field}>
          <span className={styles.label}>Название</span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>ИНН</span>
          <input
            className={styles.input}
            inputMode="numeric"
            value={inn}
            onChange={(e) => setInn(e.target.value)}
            aria-invalid={!innValid}
          />
        </label>
        {!innValid && <p className={styles.error}>ИНН — 10 или 12 цифр</p>}
        <label className={styles.field}>
          <span className={styles.label}>Контакт</span>
          <input className={styles.input} value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>

        <div className={styles.dialogButtons}>
          <button type="button" className={styles.secondaryButton} onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className={styles.primaryButton} disabled={!valid}>
            Скачать DOCX
          </button>
        </div>
      </form>
    </div>
  )
}
