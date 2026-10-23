import type { ClientFilter } from './types'
import styles from './ClientToggle.module.css'

interface ClientToggleProps {
  value: ClientFilter
  onChange: (value: ClientFilter) => void
}

export function ClientToggle({ value, onChange }: ClientToggleProps) {
  const options: Array<{ value: ClientFilter; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'ours', label: 'Наши' },
    { value: 'others', label: 'Не наши' },
  ]

  return (
    <div className={styles.toggle}>
      {options.map((option) => (
        <button
          key={option.value}
          className={`${styles.option} ${value === option.value ? styles.active : ''}`}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
