import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.buttons}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Отмена
          </button>
          <button className={styles.confirmButton} onClick={onConfirm}>
            Скачать
          </button>
        </div>
      </div>
    </div>
  )
}
