import { useEffect, useMemo, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Coins, Megaphone, MousePointerClick, ShoppingBag, Target, Users } from 'lucide-react'

type IcebiscuitOverviewRow = {
  report_month: string
  account_id: string | null
  account_name: string | null
  impressions: number | null
  reach: number | null
  clicks: number | null
  inline_link_clicks: number | null
  landing_page_views: number | null
  ad_spend: number | null
  cpc: number | null
  ctr: number | null
  purchase_count: number | null
  purchase_value: number | null
  conversions: number | null
  conversion_value: number | null
  roas: number | null
}

type IcebiscuitCampaignRow = {
  report_month: string
  account_id: string | null
  account_name: string | null
  campaign_id: string | null
  campaign_name: string | null
  objective: string | null
  impressions: number | null
  reach: number | null
  clicks: number | null
  inline_link_clicks: number | null
  landing_page_views: number | null
  ad_spend: number | null
  cpc: number | null
  ctr: number | null
  purchase_count: number | null
  purchase_value: number | null
  conversions: number | null
  conversion_value: number | null
  roas: number | null
}

type IcebiscuitPayload = {
  overview: IcebiscuitOverviewRow[]
  campaigns: IcebiscuitCampaignRow[]
}

type MetricCardProps = {
  title: string
  value: string
  delta: string
  helper: string
  accent: 'amber' | 'slate' | 'emerald' | 'violet' | 'sky' | 'rose' | 'gray'
  icon: React.ReactNode
  valueSize?: 'default' | 'compact'
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

const numberFormatter = new Intl.NumberFormat('ko-KR')
const currencyFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})
const ratioPercentFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  maximumFractionDigits: 1,
})

function monthLabel(value: string) {
  return value.slice(0, 7)
}

function monthLabelKorean(value: string) {
  const [year, month] = value.split('-')
  return `${year}년 ${Number(month)}월`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return numberFormatter.format(value)
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return currencyFormatter.format(Math.round(value))
}

function formatNullableCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return '-'
  return currencyFormatter.format(Math.round(value))
}

function formatRatio(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return ratioPercentFormatter.format(value)
}

function formatNullableRatio(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return '-'
  return ratioPercentFormatter.format(value)
}

function formatSignedDelta(current: number | null | undefined, previous: number | null | undefined, formatter: (value: number) => string, empty = '전월 비교 데이터 없음') {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return empty
  }
  const diff = current - previous
  if (diff === 0) return '전월과 동일'
  const sign = diff > 0 ? '+' : ''
  return `${sign}${formatter(diff)}`
}

function formatPercentChange(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) {
    return '전월 비교 데이터 없음'
  }
  const change = (current - previous) / previous
  const sign = change > 0 ? '+' : ''
  return `${sign}${ratioPercentFormatter.format(change)}`
}

function formatObjectiveLabel(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  if (!normalized) return '-'
  return normalized
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function campaignSortRank(row: IcebiscuitCampaignRow) {
  const objective = (row.objective ?? '').toLowerCase()
  const name = (row.campaign_name ?? '').toLowerCase()
  if (objective.includes('sales') || objective.includes('purchase') || name.includes('purchase')) return 0
  if (objective.includes('traffic') || name.includes('traffic')) return 1
  if (objective.includes('awareness')) return 2
  return 3
}

async function fetchIcebiscuitDashboardData() {
  if (!supabase) {
    throw new Error('Supabase env is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  const [overviewResult, campaignResult] = await Promise.all([
    supabase.from('dashboard_icebiscuit_monthly_overview').select('*').order('report_month', { ascending: false }),
    supabase.from('dashboard_icebiscuit_ad_campaign_breakdown').select('*').order('report_month', { ascending: false }),
  ])

  if (overviewResult.error) throw overviewResult.error
  if (campaignResult.error) throw campaignResult.error

  return {
    overview: overviewResult.data as IcebiscuitOverviewRow[],
    campaigns: campaignResult.data as IcebiscuitCampaignRow[],
  } satisfies IcebiscuitPayload
}

function MetricCard({ title, value, delta, helper, accent, icon, valueSize = 'default' }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${accent}`}>
      <div className="metric-card__header">
        <span className="metric-card__icon">{icon}</span>
        <span className="metric-card__title">{title}</span>
      </div>
      <strong className={`metric-card__value${valueSize === 'compact' ? ' metric-card__value--compact' : ''}`}>{value}</strong>
      <p className="metric-card__delta">{delta}</p>
      <p className="metric-card__helper">{helper}</p>
    </article>
  )
}

export default function IcebiscuitDashboard() {
  const [data, setData] = useState<IcebiscuitPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const payload = await fetchIcebiscuitDashboardData()
        if (!active) return
        setData(payload)
        setSelectedMonth((current) => current || payload.overview[0]?.report_month || '')
      } catch (loadError) {
        if (!active) return
        const message = loadError instanceof Error ? loadError.message : 'Unknown error'
        setError(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const orderedOverview = useMemo(
    () => (data?.overview ?? []).slice().sort((a, b) => a.report_month.localeCompare(b.report_month)),
    [data],
  )

  const monthOptions = useMemo(() => orderedOverview.map((row) => row.report_month).reverse(), [orderedOverview])

  const currentRow = useMemo(
    () => orderedOverview.find((row) => row.report_month === selectedMonth) ?? orderedOverview.at(-1),
    [orderedOverview, selectedMonth],
  )

  const currentIndex = currentRow
    ? orderedOverview.findIndex((row) => row.report_month === currentRow.report_month)
    : -1

  const previousRow = useMemo(() => {
    if (currentIndex < 1) return undefined
    return orderedOverview[currentIndex - 1]
  }, [currentIndex, orderedOverview])

  const recentMonths = useMemo(() => {
    if (currentIndex < 0) return []
    return orderedOverview.slice(Math.max(0, currentIndex - 5), currentIndex + 1)
  }, [currentIndex, orderedOverview])

  const campaignsForMonth = useMemo(
    () =>
      (data?.campaigns.filter((row) => row.report_month === currentRow?.report_month) ?? [])
        .slice()
        .sort((a, b) => {
          const rankDiff = campaignSortRank(a) - campaignSortRank(b)
          if (rankDiff !== 0) return rankDiff
          return (a.campaign_name ?? '').localeCompare(b.campaign_name ?? '', 'ko')
        }),
    [currentRow?.report_month, data?.campaigns],
  )

  const campaignTotals = useMemo(() => {
    return campaignsForMonth.reduce(
      (acc, row) => ({
        adSpend: acc.adSpend + (row.ad_spend ?? 0),
        impressions: acc.impressions + (row.impressions ?? 0),
        reach: acc.reach + (row.reach ?? 0),
        clicks: acc.clicks + (row.clicks ?? 0),
        landingPageViews: acc.landingPageViews + (row.landing_page_views ?? 0),
        purchaseCount: acc.purchaseCount + (row.purchase_count ?? 0),
        purchaseValue: acc.purchaseValue + (row.purchase_value ?? 0),
      }),
      {
        adSpend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        landingPageViews: 0,
        purchaseCount: 0,
        purchaseValue: 0,
      },
    )
  }, [campaignsForMonth])

  const totalCtr = campaignTotals.impressions > 0 ? campaignTotals.clicks / campaignTotals.impressions : null
  const totalRoas = campaignTotals.adSpend > 0 ? campaignTotals.purchaseValue / campaignTotals.adSpend : null

  if (loading) {
    return (
      <section className="brand-placeholder" aria-live="polite">
        <div className="brand-placeholder__badge">ICEBISCUIT</div>
        <h2>데이터를 불러오는 중</h2>
        <p>Icebiscuit META 대시보드 데이터를 조회하고 있어.</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="brand-placeholder brand-placeholder--error" aria-live="polite">
        <div className="brand-placeholder__badge">ICEBISCUIT</div>
        <h2>연결 오류</h2>
        <p>{error}</p>
        <ul className="brand-placeholder__list">
          <li>public.dashboard_icebiscuit_* view 생성 여부 확인</li>
          <li>VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 확인</li>
          <li>Icebiscuit META raw 적재 여부 확인</li>
        </ul>
      </section>
    )
  }

  if (!currentRow) {
    return (
      <section className="brand-placeholder" aria-live="polite">
        <div className="brand-placeholder__badge">ICEBISCUIT</div>
        <h2>아직 표시할 데이터가 없어</h2>
        <p>META API 적재 후 public.dashboard_icebiscuit_monthly_overview에 데이터가 생기면 이 탭에 KPI가 표시돼.</p>
      </section>
    )
  }

  return (
    <div className="dashboard-shell icebiscuit-dashboard">
      <header className="topbar topbar--brand">
        <div>
          <p className="eyebrow">ICEBISCUIT META</p>
          <h2 className="icebiscuit-dashboard__title">광고 성과 대시보드</h2>
          <p className="icebiscuit-dashboard__description">
            {currentRow.account_name ?? 'Icebiscuit'} 기준 META 월간 광고 성과를 분리해 본다.
          </p>
        </div>
        <div className="topbar__actions">
          <label className="month-selector">
            기준월
            <select value={currentRow.report_month} onChange={(event) => setSelectedMonth(event.target.value)}>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </label>
          <span className="hint-chip">{campaignsForMonth.length}개 캠페인</span>
        </div>
      </header>

      <section className="metrics-grid metrics-grid--six">
        <MetricCard
          title="광고비"
          value={formatCurrency(currentRow.ad_spend)}
          delta={formatPercentChange(currentRow.ad_spend, previousRow?.ad_spend)}
          helper="월간 총 spend"
          accent="amber"
          icon={<Coins size={18} />}
          valueSize="compact"
        />
        <MetricCard
          title="노출수"
          value={formatNumber(currentRow.impressions)}
          delta={formatSignedDelta(currentRow.impressions, previousRow?.impressions, (value) => numberFormatter.format(value))}
          helper={`도달 ${formatNumber(currentRow.reach)}`}
          accent="slate"
          icon={<Megaphone size={18} />}
        />
        <MetricCard
          title="클릭수"
          value={formatNumber(currentRow.clicks)}
          delta={formatSignedDelta(currentRow.clicks, previousRow?.clicks, (value) => numberFormatter.format(value))}
          helper={`랜딩페이지뷰 ${formatNumber(currentRow.landing_page_views)}`}
          accent="emerald"
          icon={<MousePointerClick size={18} />}
        />
        <MetricCard
          title="CTR"
          value={formatRatio(currentRow.ctr)}
          delta={formatPercentChange(currentRow.ctr, previousRow?.ctr)}
          helper={`CPC ${formatCurrency(currentRow.cpc)}`}
          accent="gray"
          icon={<Target size={18} />}
        />
        <MetricCard
          title="구매건수"
          value={formatNumber(currentRow.purchase_count)}
          delta={formatSignedDelta(currentRow.purchase_count, previousRow?.purchase_count, (value) => numberFormatter.format(value))}
          helper={`전환수 ${formatNumber(currentRow.conversions)}`}
          accent="rose"
          icon={<ShoppingBag size={18} />}
        />
        <MetricCard
          title="구매금액 / ROAS"
          value={formatCurrency(currentRow.purchase_value)}
          delta={formatPercentChange(currentRow.purchase_value, previousRow?.purchase_value)}
          helper={`ROAS ${formatRatio(currentRow.roas)}`}
          accent="violet"
          icon={<Users size={18} />}
          valueSize="compact"
        />
      </section>

      <section className="content-grid">
        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">최근 6개월</p>
              <h2>월별 핵심 지표 요약</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>월</th>
                  <th>광고비</th>
                  <th>노출</th>
                  <th>클릭</th>
                  <th>CTR</th>
                  <th>구매건수</th>
                  <th>구매금액</th>
                  <th>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {recentMonths.slice().reverse().map((row) => (
                  <tr key={row.report_month} className={row.report_month === currentRow.report_month ? 'is-selected' : ''}>
                    <td>{monthLabel(row.report_month)}</td>
                    <td>{formatCurrency(row.ad_spend)}</td>
                    <td>{formatNumber(row.impressions)}</td>
                    <td>{formatNumber(row.clicks)}</td>
                    <td>{formatRatio(row.ctr)}</td>
                    <td>{formatNumber(row.purchase_count)}</td>
                    <td>{formatCurrency(row.purchase_value)}</td>
                    <td>{formatRatio(row.roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">캠페인 상세</p>
              <h2>META 캠페인 Breakdown</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>캠페인</th>
                  <th>목표</th>
                  <th>광고비</th>
                  <th>노출</th>
                  <th>클릭</th>
                  <th>랜딩페이지뷰</th>
                  <th>구매건수</th>
                  <th>구매금액</th>
                  <th>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {campaignsForMonth.length ? (
                  campaignsForMonth.map((row) => (
                    <tr key={`${row.report_month}-${row.campaign_id}-${row.campaign_name}`}>
                      <td>{row.campaign_name ?? '-'}</td>
                      <td>{formatObjectiveLabel(row.objective)}</td>
                      <td>{formatNullableCurrency(row.ad_spend)}</td>
                      <td>{formatNumber(row.impressions)}</td>
                      <td>{formatNumber(row.clicks)}</td>
                      <td>{formatNumber(row.landing_page_views)}</td>
                      <td>{formatNumber(row.purchase_count)}</td>
                      <td>{formatNullableCurrency(row.purchase_value)}</td>
                      <td>{formatNullableRatio(row.roas)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="icebiscuit-dashboard__empty-cell">선택한 월 캠페인 데이터가 아직 없어.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>-</td>
                  <td>{formatCurrency(campaignTotals.adSpend)}</td>
                  <td>{formatNumber(campaignTotals.impressions)}</td>
                  <td>{formatNumber(campaignTotals.clicks)}</td>
                  <td>{formatNumber(campaignTotals.landingPageViews)}</td>
                  <td>{formatNumber(campaignTotals.purchaseCount)}</td>
                  <td>{formatCurrency(campaignTotals.purchaseValue)}</td>
                  <td>{formatRatio(totalRoas)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>

        <article className="panel panel--wide icebiscuit-dashboard__meta-panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">운영 메모</p>
              <h2>현재 데이터 기준</h2>
            </div>
          </div>
          <div className="insight-empty-state insight-empty-state--brand">
            <strong>{monthLabelKorean(currentRow.report_month)} 기준</strong>
            <p>
              현재 Icebiscuit 탭은 META API 기반 광고 KPI와 캠페인 breakdown만 분리해서 보여준다.
              Thekary Point view/export 로직에는 연결하지 않고, 이 탭 안에서만 신규 public view를 조회한다.
            </p>
            <p>
              총 CTR은 {formatRatio(totalCtr)}, 총 ROAS는 {formatRatio(totalRoas)}로 재계산했다.
            </p>
          </div>
        </article>
      </section>
    </div>
  )
}
