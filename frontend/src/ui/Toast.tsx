import { useEffect } from 'react'
import styles from './Toast.module.css'

interface ToastProps {
  message: string
  type?: 'error' | 'success' | 'info'
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = 'error', onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  return (
    <div className={`${styles.toast} ${styles[type]}`} onClick={onClose}>
      <div className={styles.message}>{message}</div>
      <button className={styles.close} onClick={onClose}>×</button>
    </div>
  )
}
