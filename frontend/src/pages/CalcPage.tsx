import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { AppHeader } from '../ui/AppHeader'
import { Tabs } from '../ui/Tabs'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import type { ApiError } from '../api/types'
import { getCalcCatalog } from '../calc/api'
import { useCalcParams } from '../calc/useCalcParams'
import { calcParamsToBody, calcParamsToQuery } from '../calc/calcParams'
import { hasPositions, useEstimate } from '../calc/useEstimate'
import { CalcParamsForm } from '../calc/CalcParamsForm'
import { EquipmentPicker } from '../calc/EquipmentPicker'
import { PricesPanel } from '../calc/PricesPanel'
import { CustomItems, type CustomItem } from '../calc/CustomItems'
import { Dashboard } from '../calc/Dashboard'
import { CalcExport } from '../calc/CalcExport'
import type { CustomItemInput } from '../calc/types'
import { formatRub } from '../utils/formatNumber'
import styles from './CalcPage.module.css'

const apiMessage = (err: unknown) => (err as ApiError | null)?.message ?? 'Произошла ошибка'

export function CalcPage() {
  const { user, logout } = useAuth()
  const { params, updateParams, resetParams } = useCalcParams()
  // Свои позиции (ПО, нестандарт) — только в состоянии страницы, в URL не пишем
  const [customItems, setCustomItems] = useState<CustomItem[]>([])
  const nextCustomId = useRef(1)
  // Телефон: вкладки «Параметры / Результат»
  const [activeTab, setActiveTab] = useState<'params' | 'result'>('params')

  const catalogQuery = useQuery({ queryKey: ['calc-catalog'], queryFn: getCalcCatalog, staleTime: Infinity })

  const body = useMemo(
    () => calcParamsToBody(params, customItems.map(({ id: _id, ...item }) => item)),
    [params, customItems]
  )
  const estimate = useEstimate(body)
  const empty = !hasPositions(body)
  const dirty = calcParamsToQuery(params) !== '' || customItems.length > 0

  const handleAddCustom = useCallback((item: CustomItemInput) => {
    setCustomItems((prev) => [...prev, { ...item, id: nextCustomId.current++ }])
  }, [])

  const handleRemoveCustom = useCallback((id: number) => {
    setCustomItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const handleReset = useCallback(() => {
    resetParams()
    setCustomItems([])
  }, [resetParams])

  const catalog = catalogQuery.data

  return (
    <ErrorBoundary>
      <div className={styles.container}>
        <AppHeader userName={user?.fullName || ''} onLogout={logout} />

        <div className={styles.mobileTabs}>
          <Tabs
            tabs={[
              { id: 'params', label: 'Параметры' },
              { id: 'result', label: 'Результат' },
            ]}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as 'params' | 'result')}
          />
        </div>

        <main className={styles.main}>
          <div className={`${styles.paramsPane} ${activeTab === 'params' ? styles.active : ''}`}>
            <div className={styles.paneHeader}>
              <h1 className={styles.title}>Калькулятор сделки</h1>
              {dirty && (
                <button type="button" className={styles.resetButton} onClick={handleReset}>
                  Сбросить
                </button>
              )}
            </div>

            {catalogQuery.isLoading && (
              <>
                <div className={styles.skeletonBlock} />
                <div className={styles.skeletonBlock} />
              </>
            )}
            {catalogQuery.error && (
              <div className={styles.errorBox} role="alert">
                <p>Не удалось загрузить справочники калькулятора: {apiMessage(catalogQuery.error)}</p>
                <button type="button" className={styles.secondaryButton} onClick={() => catalogQuery.refetch()}>
                  Повторить
                </button>
              </div>
            )}

            {catalog && (
              <>
                <section className={styles.card}>
                  <h2 className={styles.cardTitle}>Условия сделки</h2>
                  <CalcParamsForm catalog={catalog} params={params} onChange={updateParams} />
                </section>
                <section className={styles.card}>
                  <h2 className={styles.cardTitle}>Оборудование</h2>
                  <PricesPanel />
                  <EquipmentPicker catalog={catalog} items={params.items} onChange={(items) => updateParams({ items })} />
                </section>
                <section className={styles.card}>
                  <h2 className={styles.cardTitle}>ПО и нестандартное оборудование</h2>
                  <p className={styles.hint}>Позиции, которых нет в каталоге</p>
                  <CustomItems items={customItems} onAdd={handleAddCustom} onRemove={handleRemoveCustom} />
                </section>
              </>
            )}
          </div>

          <div className={`${styles.resultPane} ${activeTab === 'result' ? styles.active : ''}`}>
            <div className={styles.paneHeader}>
              <h2 className={styles.title}>Расчёт</h2>
              <CalcExport body={body} disabled={empty || !estimate.data} />
            </div>

            {empty && (
              <div className={styles.empty}>
                <p>Добавьте оборудование из каталога или свою позицию — расчёт появится сразу.</p>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.mobileOnly}`}
                  onClick={() => setActiveTab('params')}
                >
                  К параметрам
                </button>
              </div>
            )}

            {!empty && estimate.error && (
              <div className={styles.errorBox} role="alert">
                <p>{apiMessage(estimate.error)}</p>
              </div>
            )}

            {!empty && estimate.isLoading && (
              <>
                <div className={styles.skeletonTiles} />
                <div className={styles.skeletonBlock} />
                <div className={styles.skeletonBlock} />
              </>
            )}

            {!empty && estimate.data && (
              <div className={`${styles.results} ${estimate.isStale ? styles.stale : ''}`} aria-busy={estimate.isStale}>
                <Dashboard estimate={estimate.data} />
              </div>
            )}
          </div>
        </main>

        {/* Телефон, вкладка «Параметры»: итог всегда под рукой */}
        {activeTab === 'params' && !empty && estimate.data && (
          <button type="button" className={styles.resultButton} onClick={() => setActiveTab('result')}>
            Расчёт · {formatRub(estimate.data.price.optimal)}
          </button>
        )}
      </div>
    </ErrorBoundary>
  )
}
