import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { LoginPage } from './auth/LoginPage'
import { TwoFactorPage } from './auth/TwoFactorPage'
import { RadarPage } from './pages/RadarPage'

// Lazy load Navigator page для code-splitting
const NavigatorPage = lazy(() =>
  import('./pages/NavigatorPage').then((module) => ({ default: module.NavigatorPage }))
)

const SubscriptionsPage = lazy(() =>
  import('./pages/SubscriptionsPage').then((module) => ({ default: module.SubscriptionsPage }))
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/2fa" element={<TwoFactorPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <RadarPage />
                </RequireAuth>
              }
            />
            <Route
              path="/navigator"
              element={
                <RequireAuth>
                  <Suspense fallback={<div>Загрузка...</div>}>
                    <NavigatorPage />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route
              path="/subscriptions"
              element={
                <RequireAuth>
                  <Suspense fallback={<div>Загрузка...</div>}>
                    <SubscriptionsPage />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
