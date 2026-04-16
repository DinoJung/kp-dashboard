import { useState } from 'react'
import './App.css'
import IcebiscuitDashboard from './brands/icebiscuit/IcebiscuitDashboard'
import ThekaryPointDashboard from './brands/thekarypoint/ThekaryPointDashboard'

type BrandKey = 'thekarypoint' | 'icebiscuit'

type BrandTab = {
  key: BrandKey
  label: string
  description: string
}

const BRAND_TABS: BrandTab[] = [
  {
    key: 'thekarypoint',
    label: 'Thekary Point',
    description: '기존 KP 대시보드',
  },
  {
    key: 'icebiscuit',
    label: 'Icebiscuit',
    description: 'META 광고 API 연결 준비',
  },
]

export default function App() {
  const [activeBrand, setActiveBrand] = useState<BrandKey>('thekarypoint')

  return (
    <div className="dashboard-shell dashboard-shell--brand-tabs">
      <header className="brand-tabs" aria-label="브랜드 대시보드 탭">
        <div className="brand-tabs__copy">
          <p className="eyebrow">THEKARY DASHBOARD</p>
          <h1>브랜드 대시보드</h1>
          <p className="brand-tabs__description">Thekary Point는 기존 화면을 유지하고 Icebiscuit는 별도 탭에서 확장한다.</p>
        </div>
        <div className="brand-tabs__list" role="tablist" aria-label="브랜드 선택">
          {BRAND_TABS.map((tab) => {
            const isActive = tab.key === activeBrand
            return (
              <button
                key={tab.key}
                className={`brand-tab${isActive ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`brand-panel-${tab.key}`}
                id={`brand-tab-${tab.key}`}
                onClick={() => setActiveBrand(tab.key)}
              >
                <strong>{tab.label}</strong>
                <span>{tab.description}</span>
              </button>
            )
          })}
        </div>
      </header>

      <section
        className="brand-panel"
        role="tabpanel"
        id={`brand-panel-${activeBrand}`}
        aria-labelledby={`brand-tab-${activeBrand}`}
      >
        {activeBrand === 'thekarypoint' ? <ThekaryPointDashboard /> : <IcebiscuitDashboard />}
      </section>
    </div>
  )
}
