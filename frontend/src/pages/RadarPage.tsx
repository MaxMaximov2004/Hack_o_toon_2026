import { useAuth } from '../auth/AuthProvider'
import styles from './RadarPage.module.css'

export function RadarPage() {
  const { user, logout } = useAuth()

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>Ростелеком</div>
          <h1 className={styles.title}>Радар присутствия</h1>
          <div className={styles.userSection}>
            <span className={styles.userName}>{user?.fullName}</span>
            <button onClick={logout} className={styles.logoutButton}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.placeholder}>
          <h2>Главная страница радара</h2>
          <p>Здесь будет карта и список компаний</p>
        </div>
      </main>
    </div>
  )
}
