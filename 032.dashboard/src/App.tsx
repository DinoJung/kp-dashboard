import { useState } from 'react'
import './App.css'
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

function IcebiscuitPlaceholder() {
  return (
    <section className="brand-placeholder" aria-labelledby="icebiscuit-placeholder-title">
      <div className="brand-placeholder__badge">ICEBISCUIT</div>
      <h2 id="icebiscuit-placeholder-title">META 광고 대시보드 연결 준비 중</h2>
      <p>
        이 탭은 Icebiscuit 전용 META 광고 API 파이프라인을 별도로 연결한 뒤 붙일 예정이야.
        기존 Thekary Point 페이지와 공개 view 계약은 그대로 유지하고, 이 영역에만 신규 데이터 경로를 추가해.
      </p>
      <ul className="brand-placeholder__list">
        <li>1. Icebiscuit META raw/schema 신규 생성</li>
        <li>2. 월별 summary/public view 분리</li>
        <li>3. 광고 KPI와 캠페인 breakdown 화면 연결</li>
      </ul>
    </section>
  )
}

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
        {activeBrand === 'thekarypoint' ? <ThekaryPointDashboard /> : <IcebiscuitPlaceholder />}
      </section>
    </div>
  )
}
