import { useState } from 'react'
import { LayoutGrid, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react'
import './App.css'
import IcebiscuitDashboard from './brands/icebiscuit/IcebiscuitDashboard'
import ThekaryPointDashboard from './brands/thekarypoint/ThekaryPointDashboard'

type BrandKey = 'thekarypoint' | 'icebiscuit'

type BrandTab = {
  key: BrandKey
  code: string
  label: string
  description: string
}

const BRAND_TABS: BrandTab[] = [
  {
    key: 'thekarypoint',
    code: 'KP',
    label: 'Thekary Point',
    description: '리포트/멤버십 운영 대시보드',
  },
  {
    key: 'icebiscuit',
    code: 'IB',
    label: 'Icebiscuit META',
    description: '브랜드 광고 성과 대시보드',
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
        <>
          <aside
            className={`brand-sidebar${sidebarExpanded ? ' is-expanded' : ''}`}
            aria-label="브랜드 사이드바"
            onMouseEnter={() => setSidebarHovered(true)}
            onMouseLeave={() => setSidebarHovered(false)}
          >
            <div className="brand-sidebar__surface">
              <div className="brand-sidebar__header">
                <div className="brand-sidebar__brandmark" aria-hidden="true">
                  <Sparkles size={14} />
                </div>
                <div className={`brand-sidebar__brandcopy${sidebarExpanded ? ' is-visible' : ''}`}>
                  <p className="brand-sidebar__eyebrow">THEKARY</p>
                  <strong>Dashboard</strong>
                </div>
                <button
                  className="brand-sidebar__toggle"
                  type="button"
                  aria-label={sidebarPinnedOpen ? '사이드바 접기' : '사이드바 고정 펼치기'}
                  onClick={() => setSidebarPinnedOpen((current) => !current)}
                >
                  {sidebarPinnedOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                </button>
              </div>

              <div className={`brand-sidebar__search${sidebarExpanded ? ' is-expanded' : ''}`} aria-hidden="true">
                <LayoutGrid size={16} />
                <span>Brand switch</span>
              </div>

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
                          <small>{tab.description}</small>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </nav>

              <div className={`brand-sidebar__footer${sidebarExpanded ? ' is-visible' : ''}`}>
                <p>Hover reveal inspired shell</p>
                <strong>좌측에서 KP / IB를 빠르게 전환</strong>
              </div>
            </div>
          </aside>

          <section className="dashboard-workspace">
            <div className="dashboard-workspace__surface">
              <div className="dashboard-workspace__toolbar">
                <button
                  className="dashboard-workspace__toolbar-button"
                  type="button"
                  aria-label={sidebarPinnedOpen ? '사이드바 접기' : '사이드바 펼치기'}
                  onClick={() => setSidebarPinnedOpen((current) => !current)}
                >
                  {sidebarPinnedOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                </button>
                <div className="dashboard-workspace__toolbar-copy">
                  <p>Brand workspace</p>
                  <strong>{BRAND_TABS.find((tab) => tab.key === activeBrand)?.label}</strong>
                </div>
              </div>

              <section
                className="brand-panel"
                role="tabpanel"
                id={`brand-panel-${activeBrand}`}
                aria-labelledby={`brand-tab-${activeBrand}`}
              >
                {activeBrand === 'thekarypoint' ? (
                  <ThekaryPointDashboard onAuthStateChange={setShowBrandTabs} />
                ) : (
                  <IcebiscuitDashboard />
                )}
              </section>
            </div>
          </section>
        </>
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
