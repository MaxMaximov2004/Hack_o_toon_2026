import type { EstimateResponse } from './types'
import { formatRub } from '../utils/formatNumber'
import { Badge } from '../ui/Badge'
import styles from './EstimateDetails.module.css'

/** Таблица позиций из ответа calc-service (те же строки пойдут в CSV и КП) */
export function ItemsTable({ estimate }: { estimate: EstimateResponse }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Позиция</th>
          <th className={styles.num}>Кол-во</th>
          <th className={styles.num}>Цена за ед.</th>
          <th className={styles.num}>Сумма</th>
        </tr>
      </thead>
      <tbody>
        {estimate.items.map((item, i) => (
          <tr key={item.componentId ?? `custom-${i}`}>
            <td data-label="Позиция">
              <span className={styles.name}>{item.name}</span>
              {(item.isCustom || item.isNonStandard) && (
                <span className={styles.badges}>
                  {item.isCustom && <Badge>своя позиция</Badge>}
                  {item.isNonStandard && <Badge variant="purple">нестандарт</Badge>}
                </span>
              )}
              {item.complexity !== 1 && (
                <span className={styles.meta}>сложность ×{item.complexity.toLocaleString('ru-RU')}</span>
              )}
            </td>
            <td data-label="Кол-во" className={styles.num}>
              {item.qty.toLocaleString('ru-RU')} {item.unit}
            </td>
            <td data-label="Цена за ед." className={styles.num}>{formatRub(item.unitPrice)}</td>
            <td data-label="Сумма" className={`${styles.num} ${styles.total}`}>{formatRub(item.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Допущения расчёта — как их отдаёт calc-service; расчёт предварительный */
export function Assumptions({ estimate }: { estimate: EstimateResponse }) {
  return (
    <div className={styles.assumptions}>
      <p className={styles.preliminary}>Расчёт предварительный.</p>
      {estimate.assumptions.length > 0 && (
        <ul className={styles.assumptionList}>
          {estimate.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
