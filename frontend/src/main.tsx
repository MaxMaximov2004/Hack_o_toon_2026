import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/global.css'

async function enableMocking() {
  const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

  if (!useMocks) {
    return
  }

  const { worker } = await import('./mocks/browser')

  // Явно ждём запуска worker
  await worker.start({
    onUnhandledRequest: 'bypass', // Пропускаем запросы которые не перехватываем
  })
}

// Рендерим ТОЛЬКО после запуска MSW
enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
