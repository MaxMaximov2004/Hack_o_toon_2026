import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ProfileMenu.module.css'

interface ProfileMenuProps {
  userName: string
  onLogout: () => void
}

export function ProfileMenu({ userName, onLogout }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={styles.container}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Меню профиля"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.menu}>
            <div className={styles.userName}>{userName}</div>
            <Link to="/subscriptions" className={styles.menuLink} onClick={() => setIsOpen(false)}>
              Подписки и Telegram
            </Link>
            <button className={styles.logoutButton} onClick={onLogout}>
              Выйти
            </button>
          </div>
        </>
      )}
    </div>
  )
}
