import { useState } from 'react'
import './App.css'
import IcebiscuitDashboard from './brands/icebiscuit/IcebiscuitDashboard'
import ThekaryPointDashboard from './brands/thekarypoint/ThekaryPointDashboard'

type BrandKey = 'thekarypoint' | 'icebiscuit'

type BrandTab = {
  key: BrandKey
  label: string
}

const BRAND_TABS: BrandTab[] = [
  { key: 'thekarypoint', label: 'KP' },
  { key: 'icebiscuit', label: 'IB' },
]

export default function App() {
  const [activeBrand, setActiveBrand] = useState<BrandKey>('thekarypoint')
  const [showBrandTabs, setShowBrandTabs] = useState(false)

  return (
    <div className="dashboard-shell dashboard-shell--brand-tabs">
      {showBrandTabs ? (
        <nav className="brand-tabs" aria-label="브랜드 선택">
          <div className="brand-tabs__list" role="tablist" aria-label="브랜드 선택">
            {BRAND_TABS.map((tab, index) => {
              const isActive = tab.key === activeBrand
              return (
                <div key={tab.key} className="brand-tabs__item">
                  <button
                    className={`brand-tab${isActive ? ' is-active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`brand-panel-${tab.key}`}
                    id={`brand-tab-${tab.key}`}
                    onClick={() => setActiveBrand(tab.key)}
                  >
                    {tab.label}
                  </button>
                  {index < BRAND_TABS.length - 1 ? <span className="brand-tabs__divider">|</span> : null}
                </div>
              )
            })}
          </div>
        </nav>
      ) : null}

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
  )
}
