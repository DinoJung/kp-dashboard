import { lazy, Suspense, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import './App.css'
import ThekaryPointDashboard from './brands/thekarypoint/ThekaryPointDashboard'

const IcebiscuitDashboard = lazy(() => import('./brands/icebiscuit/IcebiscuitDashboard'))

type BrandKey = 'thekarypoint' | 'icebiscuit'

type BrandTab = {
  key: BrandKey
  code: string
  label: string
}

const BRAND_TABS: BrandTab[] = [
  {
    key: 'thekarypoint',
    code: 'KP',
    label: 'THEKARY Point',
  },
  {
    key: 'icebiscuit',
    code: 'IB',
    label: 'Icebiscuit META',
  },
]

export default function App() {
  const [activeBrand, setActiveBrand] = useState<BrandKey>('thekarypoint')
  const [showBrandTabs, setShowBrandTabs] = useState(false)
  const [sidebarPinnedOpen, setSidebarPinnedOpen] = useState(false)
  const [sidebarHovered, setSidebarHovered] = useState(false)

  const sidebarExpanded = sidebarPinnedOpen || sidebarHovered

  return (
    <div className={`dashboard-shell dashboard-shell--brand-tabs${showBrandTabs ? ' dashboard-shell--workspace' : ''}`}>
      {showBrandTabs ? (
        <div className={`dashboard-workspace-shell${sidebarExpanded ? ' is-sidebar-expanded' : ''}`}>
          <aside
            className={`brand-sidebar${sidebarExpanded ? ' is-expanded' : ''}`}
            aria-label="브랜드 사이드바"
            onMouseEnter={() => setSidebarHovered(true)}
            onMouseLeave={() => setSidebarHovered(false)}
          >
            <div className="brand-sidebar__surface">
              <div className="brand-sidebar__header">
                <button
                  className="brand-sidebar__toggle brand-sidebar__toggle--primary"
                  type="button"
                  aria-label={sidebarPinnedOpen ? '사이드바 접기' : '사이드바 고정 펼치기'}
                  onClick={() => setSidebarPinnedOpen((current) => !current)}
                >
                  {sidebarPinnedOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
                </button>

                <nav className="brand-tabs" aria-label="브랜드 선택">
                  <div className="brand-tabs__list" role="tablist" aria-label="브랜드 선택">
                    {BRAND_TABS.map((tab) => {
                      const isActive = tab.key === activeBrand
                      return (
                        <button
                          key={tab.key}
                          className={`brand-tab${isActive ? ' is-active' : ''}${sidebarExpanded ? ' is-expanded' : ''}`}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          aria-controls={`brand-panel-${tab.key}`}
                          id={`brand-tab-${tab.key}`}
                          onClick={() => setActiveBrand(tab.key)}
                        >
                          <span className="brand-tab__code">{tab.code}</span>
                          <span className={`brand-tab__body${sidebarExpanded ? ' is-visible' : ''}`}>
                            <strong>{tab.label}</strong>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </nav>
              </div>
            </div>
          </aside>

          <section className="dashboard-workspace">
            <div className="dashboard-workspace__surface">
              <section
                className="brand-panel"
                role="tabpanel"
                id={`brand-panel-${activeBrand}`}
                aria-labelledby={`brand-tab-${activeBrand}`}
              >
                {activeBrand === 'thekarypoint' ? (
                  <ThekaryPointDashboard onAuthStateChange={setShowBrandTabs} />
                ) : (
                  <Suspense fallback={<div className="brand-placeholder">IB 대시보드를 불러오는 중입니다.</div>}>
                    <IcebiscuitDashboard />
                  </Suspense>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : (
        <section
          className="brand-panel"
          role="tabpanel"
          id={`brand-panel-${activeBrand}`}
          aria-labelledby={`brand-tab-${activeBrand}`}
        >
          <ThekaryPointDashboard onAuthStateChange={setShowBrandTabs} />
        </section>
      )}
    </div>
  )
}
