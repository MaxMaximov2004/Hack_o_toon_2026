import { useState } from 'react'
import type { CalcCatalog, CalcComponent, EstimateItemInput } from './types'
import { formatRub, formatPct } from '../utils/formatNumber'
import styles from './EquipmentPicker.module.css'

/** calc-service отклоняет qty > 100 000 (app/estimate.py) */
export const MAX_QTY = 100000

interface EquipmentPickerProps {
  catalog: CalcCatalog
  items: EstimateItemInput[]
  onChange: (items: EstimateItemInput[]) => void
}

/** Масштаб проекта: каталог по группам систем, количество и признак «нестандарт» у каждой позиции */
export function EquipmentPicker({ catalog, items, onChange }: EquipmentPickerProps) {
  const groups = Object.entries(catalog.components)
  const selectedIn = (components: CalcComponent[]) =>
    components.filter((c) => items.some((i) => i.componentId === c.id)).length

  // Открыты группы с выбранными позициями; если ничего не выбрано — первая
  const [open, setOpen] = useState<Set<string>>(() => {
    const withItems = groups.filter(([, cs]) => selectedIn(cs) > 0).map(([g]) => g)
    return new Set(withItems.length > 0 ? withItems : groups.slice(0, 1).map(([g]) => g))
  })

  const toggleGroup = (group: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const setItem = (componentId: string, qty: number, nonStandard: boolean) => {
    const rest = items.filter((i) => i.componentId !== componentId)
    if (qty <= 0) {
      onChange(rest)
      return
    }
    const item: EstimateItemInput = nonStandard ? { componentId, qty, nonStandard: true } : { componentId, qty }
    const index = items.findIndex((i) => i.componentId === componentId)
    // Порядок позиций сохраняем — так же они пойдут в КП и CSV
    onChange(index === -1 ? [...items, item] : items.map((i) => (i.componentId === componentId ? item : i)))
  }

  return (
    <div className={styles.groups}>
      {groups.map(([group, components]) => {
        const count = selectedIn(components)
        const isOpen = open.has(group)
        return (
          <section key={group} className={styles.group}>
            <button
              type="button"
              className={styles.groupHeader}
              aria-expanded={isOpen}
              onClick={() => toggleGroup(group)}
            >
              <span className={styles.groupName}>{group}</span>
              {count > 0 && <span className={styles.counter}>{count}</span>}
              <span className={styles.arrow} aria-hidden="true">
                {isOpen ? '▲' : '▼'}
              </span>
            </button>
            {isOpen && (
              <ul className={styles.list}>
                {components.map((c) => {
                  const item = items.find((i) => i.componentId === c.id)
                  return (
                    <ComponentRow
                      key={c.id}
                      component={c}
                      qty={item?.qty ?? 0}
                      nonStandard={!!item?.nonStandard}
                      nonStandardMarkup={catalog.pricingParams.nonStandardMarkup}
                      onChange={(qty, nonStandard) => setItem(c.id, qty, nonStandard)}
                    />
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

interface ComponentRowProps {
  component: CalcComponent
  qty: number
  nonStandard: boolean
  nonStandardMarkup: number
  onChange: (qty: number, nonStandard: boolean) => void
}

function ComponentRow({ component, qty, nonStandard, nonStandardMarkup, onChange }: ComponentRowProps) {
  const clamp = (n: number) => Math.min(Math.max(Math.trunc(n), 0), MAX_QTY)

  return (
    <li className={`${styles.row} ${qty > 0 ? styles.rowSelected : ''}`}>
      <div className={styles.rowInfo}>
        <span className={styles.name}>{component.name}</span>
        <span className={styles.meta}>
          {formatRub(component.base_price)} за {component.unit} · сложность ×{component.complexity.toLocaleString('ru-RU')}
        </span>
        {qty > 0 && (
          <label className={styles.nonStandard}>
            <input type="checkbox" checked={nonStandard} onChange={(e) => onChange(qty, e.target.checked)} />
            <span>
              Нестандартное исполнение <span className={styles.markup}>+{formatPct(nonStandardMarkup)}</span>
            </span>
          </label>
        )}
      </div>
      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.stepButton}
          onClick={() => onChange(clamp(qty - 1), nonStandard)}
          disabled={qty === 0}
          aria-label={`Меньше: ${component.name}`}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_QTY}
          className={styles.qty}
          value={qty === 0 ? '' : qty}
          placeholder="0"
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0), nonStandard)}
          aria-label={`Количество: ${component.name}`}
        />
        <button
          type="button"
          className={styles.stepButton}
          onClick={() => onChange(clamp(qty + 1), nonStandard)}
          disabled={qty >= MAX_QTY}
          aria-label={`Больше: ${component.name}`}
        >
          +
        </button>
      </div>
    </li>
  )
}
