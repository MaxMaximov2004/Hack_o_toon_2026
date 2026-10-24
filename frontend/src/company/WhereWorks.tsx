import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addCompanyLocation, deleteCompanyLocation, getCompanyLocations, getDictionaries } from '../api/endpoints'
import type { ActualLocation, ApiError, LocationInput } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { companyLocationsKey } from '../api/queryKeys'
import styles from './WhereWorks.module.css'

const SOURCE_LABEL: Record<string, string> = {
  crm: 'CRM / биллинг РТ',
  manager: 'менеджер',
  egrul: 'ЕГРЮЛ',
}

const apiMessage = (err: unknown) => (err as ApiError | null)?.message ?? 'Произошла ошибка'

/**
 * «Где работает» (ТЗ 07): регистрация из реестра МСП и фактические места с источником и уверенностью.
 * Менеджер может указать фактическое место; удалить — только введённое вручную (admin — любое).
 */
export function WhereWorks({ companyId }: { companyId: number }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = !!user?.roles.includes('admin')
  const [formOpen, setFormOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: companyLocationsKey(companyId),
    queryFn: () => getCompanyLocations(companyId),
  })

  // relocated меняет список, фильтр «работает не там» и карту
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: companyLocationsKey(companyId) })
    queryClient.invalidateQueries({ queryKey: ['company', companyId] })
    queryClient.invalidateQueries({ queryKey: ['companies'] })
    queryClient.invalidateQueries({ queryKey: ['companies-count'] })
    queryClient.invalidateQueries({ queryKey: ['map'] })
  }

  const remove = useMutation({
    mutationFn: (locationId: number) => deleteCompanyLocation(companyId, locationId),
    onSettled: invalidateAll,
  })

  return (
    <div className={styles.section}>
      <h3 className={styles.title}>Где работает</h3>

      {isLoading && <div className={styles.skeleton} />}
      {error && <p className={styles.error}>{apiMessage(error)}</p>}

      {data && (
        <>
          <div className={styles.place}>
            <span className={`${styles.marker} ${styles.registered}`} aria-hidden="true" />
            <div className={styles.placeBody}>
              <span className={styles.placeName}>
                {data.registered.municipalityName}
                {data.registered.settlement && `, ${data.registered.settlement}`}
              </span>
              <span className={styles.meta}>регистрация · реестр МСП</span>
            </div>
          </div>

          {data.actual.map((place) => (
            <ActualPlace
              key={place.id}
              place={place}
              canDelete={isAdmin || place.source === 'manager'}
              isDeleting={remove.isPending && remove.variables === place.id}
              onDelete={() => remove.mutate(place.id)}
            />
          ))}

          {remove.isError && <p className={styles.error}>{apiMessage(remove.error)}</p>}

          {data.relocated && (
            <p className={styles.relocatedNote}>Работает не там, где зарегистрирована — на карте пунктир</p>
          )}
          {data.actual.length === 0 && !formOpen && (
            <p className={styles.hint}>Фактический адрес неизвестен: в открытых реестрах его нет</p>
          )}

          {formOpen ? (
            <LocationForm
              companyId={companyId}
              onDone={() => {
                setFormOpen(false)
                invalidateAll()
              }}
              onCancel={() => setFormOpen(false)}
            />
          ) : (
            <button className={styles.secondaryButton} onClick={() => setFormOpen(true)}>
              Указать фактическое место
            </button>
          )}
        </>
      )}
    </div>
  )
}

function ActualPlace({
  place,
  canDelete,
  isDeleting,
  onDelete,
}: {
  place: ActualLocation
  canDelete: boolean
  isDeleting: boolean
  onDelete: () => void
}) {
  return (
    <div className={styles.place}>
      <span className={`${styles.marker} ${styles.actual}`} aria-hidden="true" />
      <div className={styles.placeBody}>
        <span className={styles.placeName}>
          {place.municipalityName ?? place.regionName}
          {place.address && `, ${place.address}`}
        </span>
        <span className={styles.meta}>
          факт · {SOURCE_LABEL[place.source] ?? place.source} · уверенность {Math.round(place.confidence * 100)} %
          {' · '}
          {new Date(place.createdAt).toLocaleDateString('ru-RU')}
        </span>
        {place.note && <span className={styles.note}>{place.note}</span>}
      </div>
      {canDelete && (
        <button
          className={styles.deleteButton}
          onClick={onDelete}
          disabled={isDeleting}
          aria-label="Удалить место"
          title="Удалить"
        >
          ×
        </button>
      )}
    </div>
  )
}

function LocationForm({
  companyId,
  onDone,
  onCancel,
}: {
  companyId: number
  onDone: () => void
  onCancel: () => void
}) {
  const { data: dict } = useQuery({ queryKey: ['dictionaries'], queryFn: getDictionaries, staleTime: Infinity })
  const [where, setWhere] = useState<'area' | 'region'>('area')
  const [municipalityName, setMunicipalityName] = useState('')
  const [regionName, setRegionName] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: (input: LocationInput) => addCompanyLocation(companyId, input),
    onSuccess: onDone,
  })

  const place = where === 'area' ? municipalityName : regionName.trim()
  const municipalities = dict ? [...dict.municipalities].sort((a, b) => a.name.localeCompare(b.name, 'ru')) : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!place) return
    mutation.mutate({
      ...(where === 'area' ? { municipalityName } : { regionName: regionName.trim() }),
      address: address.trim() || undefined,
      note: note.trim() || undefined,
    })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.switch} role="radiogroup" aria-label="Где">
        <label className={where === 'area' ? styles.switchActive : ''}>
          <input type="radio" name="where" checked={where === 'area'} onChange={() => setWhere('area')} />
          Район или город области
        </label>
        <label className={where === 'region' ? styles.switchActive : ''}>
          <input type="radio" name="where" checked={where === 'region'} onChange={() => setWhere('region')} />
          Другой регион
        </label>
      </div>

      {where === 'area' ? (
        <label className={styles.field}>
          <span className={styles.label}>Район / город</span>
          <select
            className={styles.input}
            value={municipalityName}
            onChange={(e) => setMunicipalityName(e.target.value)}
          >
            <option value="">Выберите…</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className={styles.field}>
          <span className={styles.label}>Регион</span>
          <input
            className={styles.input}
            value={regionName}
            onChange={(e) => setRegionName(e.target.value)}
            placeholder="Краснодарский край"
          />
        </label>
      )}

      <label className={styles.field}>
        <span className={styles.label}>Адрес (необязательно)</span>
        <input className={styles.input} value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Комментарий (необязательно)</span>
        <input
          className={styles.input}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="например: офис и склад, со слов директора"
        />
      </label>

      {mutation.isError && <p className={styles.error}>{apiMessage(mutation.error)}</p>}

      <div className={styles.formButtons}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className={styles.primaryButton} disabled={!place || mutation.isPending}>
          Сохранить
        </button>
      </div>
    </form>
  )
}
