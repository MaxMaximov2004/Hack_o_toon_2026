import { useState } from 'react'
import { FINANCING_OPTIONS, type CalcParams } from './calcParams'
import type { CalcCatalog } from './types'
import { formatPct } from '../utils/formatNumber'
import styles from './CalcParamsForm.module.css'

interface CalcParamsFormProps {
  catalog: CalcCatalog
  params: CalcParams
  onChange: (updates: Partial<CalcParams>) => void
}

const coef = (value: number) => `×${value.toLocaleString('ru-RU')}`

/** Условия сделки: регион, уровень (тип проекта), этапы работ, срочность, уникальность, финансирование и срок */
export function CalcParamsForm({ catalog, params, onChange }: CalcParamsFormProps) {
  const region = catalog.regions.find((r) => r.id === params.regionId)
  const levels = [...catalog.levels].sort((a, b) => a.coef - b.coef)

  const toggleStage = (code: string) => {
    const stages = params.stages.includes(code)
      ? params.stages.filter((s) => s !== code)
      : [...params.stages, code]
    onChange({ stages })
  }

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="calc-region" className={styles.label}>
          Регион
        </label>
        <select
          id="calc-region"
          className={styles.select}
          value={params.regionId}
          onChange={(e) => onChange({ regionId: Number(e.target.value) })}
        >
          {catalog.regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {coef(r.coef)}
            </option>
          ))}
        </select>
        {region?.reason && <span className={styles.hint}>{region.reason}</span>}
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Уровень проекта</legend>
        <div className={styles.levels} role="radiogroup" aria-label="Уровень проекта">
          {levels.map((l) => (
            <label
              key={l.code}
              className={`${styles.levelCard} ${params.level === l.code ? styles.levelCardActive : ''}`}
            >
              <input
                type="radio"
                name="calc-level"
                checked={params.level === l.code}
                onChange={() => onChange({ level: l.code })}
              />
              <span className={styles.levelBody}>
                <span className={styles.levelName}>
                  {l.name} <span className={styles.coef}>{coef(l.coef)}</span>
                </span>
                {l.description && <span className={styles.hint}>{l.description}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Виды работ</legend>
        {catalog.stages.map((s) => (
          <label key={s.code} className={styles.check}>
            <input type="checkbox" checked={params.stages.includes(s.code)} onChange={() => toggleStage(s.code)} />
            <span className={styles.checkBody}>
              <span>
                {s.name} <span className={styles.coef}>+{formatPct(s.share_of_equipment * 100)} от оборудования</span>
              </span>
              {s.comment && <span className={styles.hint}>{s.comment}</span>}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Особые условия</legend>
        <label className={styles.check}>
          <input type="checkbox" checked={params.urgent} onChange={(e) => onChange({ urgent: e.target.checked })} />
          <span>
            Срочный проект <span className={styles.coef}>×1,2</span>
          </span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={params.uniqueSolution}
            onChange={(e) => onChange({ uniqueSolution: e.target.checked })}
          />
          <span>
            Уникальное решение{' '}
            <span className={styles.coef}>+{formatPct(catalog.pricingParams.uniqueMarkup)}</span>
          </span>
        </label>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Схема финансирования</legend>
        <div className={styles.segments}>
          {FINANCING_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`${styles.segment} ${params.financing === o.value ? styles.segmentActive : ''}`}
              aria-pressed={params.financing === o.value}
              onClick={() => onChange({ financing: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
        <TermInput value={params.termMonths} onChange={(termMonths) => onChange({ termMonths })} />
      </fieldset>
    </div>
  )
}

/** Срок в месяцах: целое ≥ 1; пока поле пустое или неверное — в URL остаётся прежнее значение */
function TermInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value))
  const [shown, setShown] = useState(value)
  // Значение сменили снаружи (ссылка, «Сбросить») — показываем его
  if (shown !== value) {
    setShown(value)
    setText(String(value))
  }

  const handleChange = (raw: string) => {
    setText(raw)
    if (/^\d+$/.test(raw) && Number(raw) >= 1) {
      setShown(Number(raw))
      onChange(Number(raw))
    }
  }

  const invalid = !/^\d+$/.test(text) || Number(text) < 1

  return (
    <div className={styles.field}>
      <label htmlFor="calc-term" className={styles.label}>
        Срок, мес
      </label>
      <input
        id="calc-term"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        className={`${styles.input} ${styles.termInput}`}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        aria-invalid={invalid}
      />
      {invalid && <span className={styles.error}>Целое число месяцев, не меньше 1</span>}
    </div>
  )
}
