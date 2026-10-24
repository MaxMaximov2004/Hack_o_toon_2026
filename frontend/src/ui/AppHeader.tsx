import { Link, useLocation } from 'react-router-dom'
import { ProfileMenu } from './ProfileMenu'
import styles from './AppHeader.module.css'

interface AppHeaderProps {
  userName: string
  onLogout: () => void
}

export function AppHeader({ userName, onLogout }: AppHeaderProps) {
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        <div className={styles.logo}>Ростелеком</div>
        <nav className={styles.nav}>
          <Link
            to="/"
            className={`${styles.navLink} ${currentPath === '/' ? styles.navLinkActive : ''}`}
          >
            Радар присутствия
          </Link>
          <span className={styles.navSeparator}>|</span>
          <Link
            to="/navigator"
            className={`${styles.navLink} ${currentPath === '/navigator' ? styles.navLinkActive : ''}`}
          >
            Навигатор
          </Link>
        </nav>
        <div className={styles.headerActions}>
          <span className={styles.userNameDesktop}>{userName}</span>
          <button onClick={onLogout} className={styles.logoutButtonDesktop}>
            Выйти
          </button>
          <div className={styles.profileMenuMobile}>
            <ProfileMenu userName={userName} onLogout={onLogout} />
          </div>
        </div>
      </div>
    </header>
  )
}
