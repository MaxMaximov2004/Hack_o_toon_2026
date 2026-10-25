import { useState, type FormEvent } from 'react'
import { downloadBlob } from '../export/downloadBlob'
import { Toast } from '../ui/Toast'
import type { ApiError } from '../api/types'
import { postEstimateBitrix, postEstimateCsv, postProposal } from './api'
import type { EstimateRequest, ProposalClient } from './types'
import styles from './CalcExport.module.css'

interface CalcExportProps {
  body: EstimateRequest
  disabled: boolean
}

type ToastState = { message: string; type: 'success' | 'error' } | null

const errorText = (err: unknown) => (err as ApiError | null)?.message ?? 'Не удалось сформировать файл'

/** «CSV» — сразу скачивание; «В CRM» и «КП (DOCX)» — сначала данные клиента. Тело то же, что у расчёта на экране */
export function CalcExport({ body, disabled }: CalcExportProps) {
  const [busy, setBusy] = useState<'csv' | ClientPurpose | null>(null)
  const [dialogFor, setDialogFor] = useState<ClientPurpose | null>(null)
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

  const downloadForClient = async (purpose: ClientPurpose, client: ProposalClient) => {
    setDialogFor(null)
    setBusy(purpose)
    try {
      const { blob, filename } =
        purpose === 'docx' ? await postProposal(body, client) : await postEstimateBitrix(body, client)
      downloadBlob(blob, null, filename || (purpose === 'docx' ? 'proposal.docx' : 'estimate_bitrix.csv'))
      setToast({
        message: purpose === 'docx' ? 'Коммерческое предложение скачано' : 'Лид для Bitrix24 скачан',
        type: 'success',
      })
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
          className={styles.secondaryButton}
          onClick={() => setDialogFor('bitrix')}
          disabled={disabled || busy !== null}
        >
          {busy === 'bitrix' ? 'Готовим лид…' : 'В CRM'}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setDialogFor('docx')}
          disabled={disabled || busy !== null}
        >
          {busy === 'docx' ? 'Готовим КП…' : 'Коммерческое предложение'}
        </button>
      </div>

      {dialogFor && (
        <ClientDialog
          purpose={dialogFor}
          onSubmit={(client) => downloadForClient(dialogFor, client)}
          onCancel={() => setDialogFor(null)}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}

/** Зачем спрашиваем клиента: КП в DOCX или лид Bitrix24 */
type ClientPurpose = 'docx' | 'bitrix'

const PURPOSE_TEXT: Record<ClientPurpose, { aria: string; hint: string; submit: string }> = {
  docx: {
    aria: 'Клиент для коммерческого предложения',
    hint: 'Попадёт в шапку коммерческого предложения',
    submit: 'Скачать DOCX',
  },
  bitrix: {
    aria: 'Клиент для лида в CRM',
    hint: 'Станет лидом Bitrix24 с суммой сделки; телефон или e-mail — в контакт',
    submit: 'Скачать для CRM',
  },
}

interface ClientDialogProps {
  purpose?: ClientPurpose
  onSubmit: (client: ProposalClient) => void
  onCancel: () => void
}

/** Клиент для шапки КП или лида в CRM: название обязательно, ИНН (10 или 12 цифр) и контакт — по желанию */
export function ClientDialog({ purpose = 'docx', onSubmit, onCancel }: ClientDialogProps) {
  const text = PURPOSE_TEXT[purpose]
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
        aria-label={text.aria}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className={styles.title}>Клиент</h3>
        <p className={styles.hint}>{text.hint}</p>

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
            {text.submit}
          </button>
        </div>
      </form>
    </div>
  )
}
