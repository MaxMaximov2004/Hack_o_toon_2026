import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importClients, importLocations } from '../api/endpoints'
import type { ApiError, ImportClientsResponse, ImportMode, LocationImportResponse } from '../api/types'
import styles from './ImportClientsDialog.module.css'

const MAX_BYTES = 10 * 1024 * 1024

type Tab = 'clients' | 'locations'

/**
 * Админ: «Обновить список клиентов» (POST /api/clients/import) и «Адреса из CRM» (POST /api/locations/import).
 * После успеха — пересчитанные карта, список, районы и белые пятна.
 */
export function ImportClientsDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('clients')
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<ImportMode>('append')
  const [localError, setLocalError] = useState<string | null>(null)

  const invalidateRadar = () => {
    const keys = ['map', 'companies', 'companies-count', 'municipality-stats', 'white-spots', 'excluded-clients-count', 'company',
      'company-locations']
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  }

  const clients = useMutation({
    mutationFn: (f: File) => importClients(f, mode),
    onSuccess: invalidateRadar,
  })
  const places = useMutation({
    mutationFn: (f: File) => importLocations(f),
    onSuccess: invalidateRadar,
  })
  const active = tab === 'clients' ? clients : places

  const handleFile = (f: File | null) => {
    setLocalError(null)
    clients.reset()
    places.reset()
    // Проверяем до отправки: nginx и core-api всё равно отрежут больше 10 МБ
    if (f && f.size > MAX_BYTES) {
      setFile(null)
      setLocalError('Файл больше 10 МБ')
      return
    }
    setFile(f)
  }

  const switchTab = (next: Tab) => {
    setTab(next)
    handleFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const errorText = (err: unknown) => {
    const e = err as ApiError
    return e.code === 'TOO_LARGE' ? 'Файл больше 10 МБ' : e.message
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-label="Загрузка из CSV" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Загрузка из CSV</h3>
          <button className={styles.close} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className={styles.tabs} role="tablist">
          <button role="tab" aria-selected={tab === 'clients'} className={tab === 'clients' ? styles.tabActive : ''}
            onClick={() => switchTab('clients')}>
            Список клиентов
          </button>
          <button role="tab" aria-selected={tab === 'locations'} className={tab === 'locations' ? styles.tabActive : ''}
            onClick={() => switchTab('locations')}>
            Адреса из CRM
          </button>
        </div>

        {tab === 'clients' ? (
          <p className={styles.hint}>
            Колонка <code>inn</code> (или первая), разделитель «;» или «,». Меняется только признак «наш клиент»,
            районы и белые пятна пересчитаются. <a href="/samples/clients-example.csv" download>Пример формата</a>
          </p>
        ) : (
          <p className={styles.hint}>
            Адреса точек подключения из биллинга: <code>inn;municipality;region;address;source</code>. Район — как в
            справочнике, другой регион — в <code>region</code>.{' '}
            <a href="/samples/crm-locations-example.csv" download>Пример формата</a>
          </p>
        )}

        <label className={styles.file}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <span>{file ? file.name : 'Выбрать CSV-файл (до 10 МБ)'}</span>
        </label>

        {tab === 'clients' && (
          <div className={styles.modes} role="radiogroup" aria-label="Режим">
            <label>
              <input type="radio" name="mode" checked={mode === 'append'} onChange={() => setMode('append')} />
              Добавить к текущим
            </label>
            <label>
              <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              Заменить список целиком
            </label>
          </div>
        )}
        {tab === 'clients' && mode === 'replace' && (
          <p className={styles.warning}>Клиенты, которых нет в файле, перестанут считаться нашими</p>
        )}

        {localError && <p className={styles.error}>{localError}</p>}
        {active.isError && <p className={styles.error}>{errorText(active.error)}</p>}
        {tab === 'clients' && clients.data && <ClientsResult result={clients.data} />}
        {tab === 'locations' && places.data && <LocationsResult result={places.data} />}

        <div className={styles.buttons}>
          <button className={styles.secondary} onClick={onClose}>
            {active.isSuccess ? 'Готово' : 'Отмена'}
          </button>
          <button
            className={styles.primary}
            disabled={!file || active.isPending}
            onClick={() => file && active.mutate(file)}
          >
            {active.isPending ? 'Загружаем…' : 'Загрузить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NotFoundList({ inns }: { inns: string[] }) {
  if (inns.length === 0) return null
  const shown = inns.slice(0, 10)
  return (
    <>
      : {shown.join(', ')}
      {inns.length > shown.length && ` и ещё ${inns.length - shown.length}`}
    </>
  )
}

function ClientsResult({ result }: { result: ImportClientsResponse }) {
  return (
    <p className={styles.result} role="status">
      Загружено {result.rows}, найдено {result.matched}, не найдено {result.notFound.length}
      <NotFoundList inns={result.notFound} />; белых пятен: {result.whiteSpots}
    </p>
  )
}

function LocationsResult({ result }: { result: LocationImportResponse }) {
  return (
    <div className={styles.result} role="status">
      Строк {result.rows}, адресов добавлено {result.matched}, ИНН не найдено {result.notFound.length}
      <NotFoundList inns={result.notFound} />
      {result.invalid.length > 0 && (
        <ul className={styles.invalid}>
          {result.invalid.slice(0, 5).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
