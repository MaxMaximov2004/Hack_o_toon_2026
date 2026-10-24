import { useState, type FormEvent } from 'react'
import type { CustomItemInput } from './types'
import { MAX_QTY } from './EquipmentPicker'
import { formatRub } from '../utils/formatNumber'
import styles from './CustomItems.module.css'

/** Своя позиция в состоянии страницы: id — только для ключей списка, в запрос не уходит */
export interface CustomItem extends CustomItemInput {
  id: number
}

interface CustomItemsProps {
  items: CustomItem[]
  onAdd: (item: CustomItemInput) => void
  onRemove: (id: number) => void
}

const EMPTY = { name: '', unit: 'шт.', unitPrice: '', qty: '1', complexity: '1' }

/** ПО и нестандартное оборудование, которого нет в каталоге (customItems в ТЗ 14) */
export function CustomItems({ items, onAdd, onRemove }: CustomItemsProps) {
  const [form, setForm] = useState(EMPTY)

  const unitPrice = Number(form.unitPrice.replace(',', '.'))
  const qty = Number(form.qty)
  const complexity = Number(form.complexity.replace(',', '.'))
  const valid =
    form.name.trim() !== '' &&
    form.unit.trim() !== '' &&
    unitPrice > 0 &&
    Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY &&
    complexity > 0

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onAdd({ name: form.name.trim(), unit: form.unit.trim(), unitPrice, qty, complexity })
    setForm(EMPTY)
  }

  return (
    <div className={styles.container}>
      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.row}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{item.name}</span>
                <span className={styles.rowMeta}>
                  {item.qty} {item.unit} × {formatRub(item.unitPrice)}
                  {item.complexity !== undefined && item.complexity !== 1 &&
                    ` · сложность ×${item.complexity.toLocaleString('ru-RU')}`}
                </span>
              </div>
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => onRemove(item.id)}
                aria-label={`Удалить: ${item.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={`${styles.field} ${styles.wide}`}>
          <span className={styles.label}>Название</span>
          <input className={styles.input} value={form.name} onChange={set('name')} placeholder="ПО диспетчеризации" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Ед. изм.</span>
          <input className={styles.input} value={form.unit} onChange={set('unit')} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Цена за ед., ₽</span>
          <input className={styles.input} inputMode="decimal" value={form.unitPrice} onChange={set('unitPrice')} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Кол-во</span>
          <input className={styles.input} type="number" inputMode="numeric" min={1} max={MAX_QTY}
            value={form.qty} onChange={set('qty')} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Сложность</span>
          <input className={styles.input} inputMode="decimal" value={form.complexity} onChange={set('complexity')} />
        </label>
        <button type="submit" className={styles.addButton} disabled={!valid}>
          Добавить позицию
        </button>
      </form>
    </div>
  )
}
