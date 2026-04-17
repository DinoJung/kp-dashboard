import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Coins, Megaphone, MousePointerClick, ShoppingBag, Target, TrendingUp, Users } from 'lucide-react'
import { getDashboardLoadErrorMessage, supabase } from '../../lib/supabase'
import { buildPresetRange, clampDateRange, presetLabel, type DateRangePreset } from './datePresets'

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

type IcebiscuitDailyRow = {
  report_date: string
  account_id: string | null
  account_name: string | null
  campaign_name: string | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  ad_spend: number | null
  purchase_count: number | null
  purchase_value: number | null
  purchase_rate: number | null
  roas: number | null
}

type IcebiscuitCreativeRow = {
  report_month: string
  campaign_group: string | null
  ad_id: string | null
  ad_name: string | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  ad_spend: number | null
  purchase_count: number | null
  purchase_value: number | null
  purchase_rate: number | null
  roas: number | null
}

type IcebiscuitPayload = {
  overview: IcebiscuitOverviewRow[]
  campaigns: IcebiscuitCampaignRow[]
  daily: IcebiscuitDailyRow[]
  creatives: IcebiscuitCreativeRow[]
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

type ViewMode = 'campaign' | 'creative' | 'daily'

type AggregateMetrics = {
  impressions: number
  clicks: number
  adSpend: number
  purchaseCount: number
  purchaseValue: number
}

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
const ratioPercentFormatter2 = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const ratioPercentFormatter0 = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  maximumFractionDigits: 0,
})
const campaignDisplayOrder = ['ASC', '리타겟팅', '전환(패션관심)', '참여 캠페인 / 게시물참여'] as const
const presets: DateRangePreset[] = ['this-week', 'last-week', 'this-month', 'last-month', 'same-month-last-year', 'previous-month-last-year']

function monthLabel(value: string) {
  return value.slice(0, 7)
}

function dayLabel(value: string) {
  return value.slice(0, 10)
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return numberFormatter.format(value)
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return currencyFormatter.format(Math.round(value))
}

function formatRatio(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return ratioPercentFormatter.format(value)
}

function formatRatioFixed(value: number | null | undefined, digits: 0 | 2 = 2) {
  if (value === null || value === undefined) return '-'
  return digits === 0 ? ratioPercentFormatter0.format(value) : ratioPercentFormatter2.format(value)
}

function formatObjectiveLabel(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  if (!normalized) return '-'

  const lower = normalized.toLowerCase()
  if (lower.includes('sales') || lower.includes('purchase')) return '구매전환'
  if (lower.includes('traffic')) return '트래픽'
  if (lower.includes('awareness') || lower.includes('reach')) return '도달'
  if (lower.includes('engagement')) return '게시물참여'
  if (lower.includes('lead')) return '리드'

  return normalized
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatCampaignName(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  if (!normalized) return '-'
  if (campaignDisplayOrder.includes(normalized as (typeof campaignDisplayOrder)[number])) return normalized
  if (normalized === 'ASC_전체 라인업 캠페인') return 'ASC'
  if (normalized === '리타겟팅 캠페인') return '리타겟팅'
  if (normalized === '전환 캠페인(패션 관심사)') return '전환(패션관심)'
  return normalized
}

function formatCampaignDisplayName(row: Pick<IcebiscuitCampaignRow, 'campaign_name' | 'objective'>) {
  const baseName = formatCampaignName(row.campaign_name)
  if (campaignDisplayOrder.includes(baseName as (typeof campaignDisplayOrder)[number])) return baseName
  const objectiveLabel = formatObjectiveLabel(row.objective)
  if (objectiveLabel === '게시물참여') return `${baseName} / 게시물참여`
  return baseName
}

function campaignSortRank(name: string | null | undefined) {
  const label = formatCampaignName(name)
  const index = campaignDisplayOrder.indexOf(label as (typeof campaignDisplayOrder)[number])
  return index === -1 ? campaignDisplayOrder.length : index
}

function formatTableNumber(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return '-'
  return numberFormatter.format(value)
}

function formatTableCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return '-'
  return currencyFormatter.format(Math.round(value))
}

function formatTableRatio(value: number | null | undefined, digits: 0 | 2 = 2) {
  if (value === null || value === undefined || value === 0) return '-'
  return formatRatioFixed(value, digits)
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10)
}

function startOfMonthIso(value: string) {
  return `${value.slice(0, 7)}-01`
}

function endOfMonthIso(value: string) {
  const [year, month] = value.slice(0, 7).split('-').map(Number)
  return toDateInputValue(new Date(year, month, 0))
}

function aggregateMetrics(rows: Array<{ impressions: number | null; clicks: number | null; ad_spend: number | null; purchase_count: number | null; purchase_value: number | null }>): AggregateMetrics {
  return rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + (row.impressions ?? 0),
      clicks: acc.clicks + (row.clicks ?? 0),
      adSpend: acc.adSpend + (row.ad_spend ?? 0),
      purchaseCount: acc.purchaseCount + (row.purchase_count ?? 0),
      purchaseValue: acc.purchaseValue + (row.purchase_value ?? 0),
    }),
    { impressions: 0, clicks: 0, adSpend: 0, purchaseCount: 0, purchaseValue: 0 },
  )
}

async function fetchIcebiscuitDashboardData() {
  if (!supabase) {
    throw new Error('Supabase env is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  const [overviewResult, campaignResult, dailyResult, creativeResult] = await Promise.all([
    supabase.from('dashboard_icebiscuit_monthly_overview').select('*').order('report_month', { ascending: false }),
    supabase.from('dashboard_icebiscuit_ad_campaign_breakdown').select('*').order('report_month', { ascending: false }),
    supabase.from('dashboard_icebiscuit_daily_breakdown').select('*').order('report_date', { ascending: false }),
    supabase.from('dashboard_icebiscuit_ad_creative_breakdown').select('*').order('report_month', { ascending: false }),
  ])

  if (overviewResult.error) throw overviewResult.error
  if (campaignResult.error) throw campaignResult.error
  if (dailyResult.error) throw dailyResult.error
  if (creativeResult.error) throw creativeResult.error

  return {
    overview: overviewResult.data as IcebiscuitOverviewRow[],
    campaigns: campaignResult.data as IcebiscuitCampaignRow[],
    daily: dailyResult.data as IcebiscuitDailyRow[],
    creatives: creativeResult.data as IcebiscuitCreativeRow[],
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
      {delta ? <p className="metric-card__delta">{delta}</p> : null}
      {helper ? <p className="metric-card__helper">{helper}</p> : null}
    </article>
  )
}

export default function IcebiscuitDashboard() {
  const [data, setData] = useState<IcebiscuitPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activePreset, setActivePreset] = useState<DateRangePreset | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('campaign')
  const [expandedCampaigns, setExpandedCampaigns] = useState<string[]>([])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const payload = await fetchIcebiscuitDashboardData()
        if (!active) return
        setData(payload)

        const latestDailyDate = payload.daily[0]?.report_date?.slice(0, 10) ?? ''
        const latestMonth = payload.overview[0]?.report_month ?? ''
        if (!startDate || !endDate) {
          if (latestDailyDate) {
            const latestDate = new Date(latestDailyDate)
            const range = {
              start: `${latestDailyDate.slice(0, 7)}-01`,
              end: toDateInputValue(latestDate),
            }
            setStartDate(range.start)
            setEndDate(range.end)
          } else if (latestMonth) {
            setStartDate(startOfMonthIso(latestMonth))
            setEndDate(endOfMonthIso(latestMonth))
          }
        }
      } catch (loadError) {
        if (!active) return
        setError(getDashboardLoadErrorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [endDate, startDate])

  const normalizedRange = useMemo(() => clampDateRange(startDate, endDate), [startDate, endDate])

  const orderedOverview = useMemo(
    () => (data?.overview ?? []).slice().sort((a, b) => a.report_month.localeCompare(b.report_month)),
    [data],
  )

  const orderedCampaigns = useMemo(
    () => (data?.campaigns ?? []).slice().sort((a, b) => a.report_month.localeCompare(b.report_month)),
    [data],
  )

  const orderedDaily = useMemo(
    () => (data?.daily ?? []).slice().sort((a, b) => a.report_date.localeCompare(b.report_date)),
    [data],
  )

  const orderedCreatives = useMemo(
    () => (data?.creatives ?? []).slice().sort((a, b) => a.report_month.localeCompare(b.report_month)),
    [data],
  )

  const filteredOverview = useMemo(
    () =>
      orderedOverview.filter((row) => {
        const monthStart = startOfMonthIso(row.report_month)
        const monthEnd = endOfMonthIso(row.report_month)
        return (!normalizedRange.start || monthEnd >= normalizedRange.start) && (!normalizedRange.end || monthStart <= normalizedRange.end)
      }),
    [normalizedRange.end, normalizedRange.start, orderedOverview],
  )

  const filteredCampaigns = useMemo(
    () =>
      orderedCampaigns.filter((row) => {
        const monthStart = startOfMonthIso(row.report_month)
        const monthEnd = endOfMonthIso(row.report_month)
        return (!normalizedRange.start || monthEnd >= normalizedRange.start) && (!normalizedRange.end || monthStart <= normalizedRange.end)
      }),
    [normalizedRange.end, normalizedRange.start, orderedCampaigns],
  )

  const filteredDaily = useMemo(
    () =>
      orderedDaily.filter(
        (row) => (!normalizedRange.start || row.report_date >= normalizedRange.start) && (!normalizedRange.end || row.report_date <= normalizedRange.end),
      ),
    [normalizedRange.end, normalizedRange.start, orderedDaily],
  )

  const filteredCreatives = useMemo(
    () =>
      orderedCreatives.filter((row) => {
        const monthStart = startOfMonthIso(row.report_month)
        const monthEnd = endOfMonthIso(row.report_month)
        return (!normalizedRange.start || monthEnd >= normalizedRange.start) && (!normalizedRange.end || monthStart <= normalizedRange.end)
      }),
    [normalizedRange.end, normalizedRange.start, orderedCreatives],
  )

  const campaignTableRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        campaign_name: string
        objective: string | null
        impressions: number
        clicks: number
        ad_spend: number
        purchase_count: number
        purchase_value: number
      }
    >()

    filteredCampaigns.forEach((row) => {
      const key = formatCampaignDisplayName(row)
      const current = grouped.get(key) ?? {
        campaign_name: key,
        objective: row.objective,
        impressions: 0,
        clicks: 0,
        ad_spend: 0,
        purchase_count: 0,
        purchase_value: 0,
      }
      current.impressions += row.impressions ?? 0
      current.clicks += row.clicks ?? 0
      current.ad_spend += row.ad_spend ?? 0
      current.purchase_count += row.purchase_count ?? 0
      current.purchase_value += row.purchase_value ?? 0
      grouped.set(key, current)
    })

    return Array.from(grouped.values()).sort((a, b) => {
      const rankDiff = campaignSortRank(a.campaign_name) - campaignSortRank(b.campaign_name)
      if (rankDiff !== 0) return rankDiff
      return a.campaign_name.localeCompare(b.campaign_name, 'ko')
    })
  }, [filteredCampaigns])

  const creativeTableRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        campaign_group: string
        ad_id: string
        ad_name: string
        impressions: number
        clicks: number
        ad_spend: number
        purchase_count: number
        purchase_value: number
      }
    >()

    filteredCreatives.forEach((row) => {
      const adId = row.ad_id ?? row.ad_name ?? 'unknown'
      const adName = row.ad_name ?? '소재명 없음'
      const campaignGroup = formatCampaignName(row.campaign_group)
      const key = `${campaignGroup}::${adId}`
      const current = grouped.get(key) ?? {
        campaign_group: campaignGroup,
        ad_id: adId,
        ad_name: adName,
        impressions: 0,
        clicks: 0,
        ad_spend: 0,
        purchase_count: 0,
        purchase_value: 0,
      }
      current.impressions += row.impressions ?? 0
      current.clicks += row.clicks ?? 0
      current.ad_spend += row.ad_spend ?? 0
      current.purchase_count += row.purchase_count ?? 0
      current.purchase_value += row.purchase_value ?? 0
      grouped.set(key, current)
    })

    return Array.from(grouped.values()).sort((a, b) => {
      const rankDiff = campaignSortRank(a.campaign_group) - campaignSortRank(b.campaign_group)
      if (rankDiff !== 0) return rankDiff
      return a.ad_name.localeCompare(b.ad_name, 'ko')
    })
  }, [filteredCreatives])

  const creativeRowsByCampaign = useMemo(() => {
    const grouped = new Map<string, typeof creativeTableRows>()
    creativeTableRows.forEach((row) => {
      const current = grouped.get(row.campaign_group) ?? []
      current.push(row)
      grouped.set(row.campaign_group, current)
    })
    return grouped
  }, [creativeTableRows])

  const campaignTotals = useMemo(
    () =>
      campaignTableRows.reduce(
        (acc, row) => ({
          impressions: acc.impressions + row.impressions,
          clicks: acc.clicks + row.clicks,
          adSpend: acc.adSpend + row.ad_spend,
          purchaseCount: acc.purchaseCount + row.purchase_count,
          purchaseValue: acc.purchaseValue + row.purchase_value,
        }),
        { impressions: 0, clicks: 0, adSpend: 0, purchaseCount: 0, purchaseValue: 0 },
      ),
    [campaignTableRows],
  )

  const dailyTotals = useMemo(() => aggregateMetrics(filteredDaily), [filteredDaily])
  const overviewTotals = useMemo(() => aggregateMetrics(filteredOverview), [filteredOverview])

  const activeMetrics = viewMode === 'daily' ? dailyTotals : overviewTotals
  const activeCtr = activeMetrics.impressions > 0 ? activeMetrics.clicks / activeMetrics.impressions : null
  const activeRoas = activeMetrics.adSpend > 0 ? activeMetrics.purchaseValue / activeMetrics.adSpend : null

  const summaryRows = useMemo(() => {
    if (viewMode === 'daily') {
      return filteredDaily.map((row) => ({
        key: `${row.report_date}-${row.campaign_name}`,
        label: dayLabel(row.report_date),
        secondary: row.campaign_name ?? '-',
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
        ctr: row.ctr,
        adSpend: row.ad_spend ?? 0,
        purchaseCount: row.purchase_count ?? 0,
        purchaseValue: row.purchase_value ?? 0,
        roas: row.roas,
      }))
    }

    return filteredOverview
      .slice()
      .reverse()
      .map((row) => ({
        key: row.report_month,
        label: monthLabel(row.report_month),
        secondary: '',
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
        ctr: row.ctr,
        adSpend: row.ad_spend ?? 0,
        purchaseCount: row.purchase_count ?? 0,
        purchaseValue: row.purchase_value ?? 0,
        roas: row.roas,
      }))
  }, [filteredDaily, filteredOverview, viewMode])

  const activeTableTitle = viewMode === 'daily' ? '일별 핵심 지표 요약' : '선택 기간 월별 핵심 지표 요약'
  const activeTableEyebrow = viewMode === 'daily' ? '선택 기간 일별' : '선택 기간 월별'
  const periodLabel = normalizedRange.start && normalizedRange.end ? `${normalizedRange.start} ~ ${normalizedRange.end}` : '기간 선택 필요'

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

  if (!orderedOverview.length) {
    return (
      <section className="brand-placeholder" aria-live="polite">
        <div className="brand-placeholder__badge">ICEBISCUIT</div>
        <h2>아직 표시할 데이터가 없어</h2>
        <p>META API 적재 후 public.dashboard_icebiscuit_monthly_overview에 데이터가 생기면 이 탭에 KPI가 표시돼.</p>
      </section>
    )
  }

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = buildPresetRange(preset)
    setStartDate(range.start)
    setEndDate(range.end)
    setActivePreset(preset)
  }

  const handleStartDateChange = (value: string) => {
    const next = clampDateRange(value, normalizedRange.end)
    setStartDate(next.start)
    setEndDate(next.end)
    setActivePreset(null)
  }

  const handleEndDateChange = (value: string) => {
    const next = clampDateRange(normalizedRange.start, value)
    setStartDate(next.start)
    setEndDate(next.end)
    setActivePreset(null)
  }

  const toggleCampaignExpansion = (campaignName: string) => {
    setExpandedCampaigns((current) =>
      current.includes(campaignName) ? current.filter((item) => item !== campaignName) : [...current, campaignName],
    )
  }

  return (
    <div className="dashboard-shell icebiscuit-dashboard">
      <header className="topbar topbar--brand">
        <div>
          <p className="eyebrow">ICEBISCUIT META</p>
          <h1 className="icebiscuit-dashboard__title">광고 성과 대시보드</h1>
        </div>
        <div className="topbar__actions icebiscuit-dashboard__actions">
          <div className="icebiscuit-dashboard__date-controls">
            <label className="month-selector icebiscuit-dashboard__date-field">
              시작일
              <input type="date" value={normalizedRange.start} onChange={(event) => handleStartDateChange(event.target.value)} />
            </label>
            <label className="month-selector icebiscuit-dashboard__date-field">
              종료일
              <input type="date" value={normalizedRange.end} onChange={(event) => handleEndDateChange(event.target.value)} />
            </label>
          </div>
          <div className="icebiscuit-dashboard__preset-row">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`icebiscuit-dashboard__preset-button${activePreset === preset ? ' is-active' : ''}`}
                onClick={() => handlePresetClick(preset)}
              >
                {presetLabel(preset)}
              </button>
            ))}
          </div>
          <div className="icebiscuit-dashboard__view-modes" role="tablist" aria-label="META 조회 단위">
            <button
              type="button"
              className={`icebiscuit-dashboard__view-mode${viewMode === 'campaign' ? ' is-active' : ''}`}
              onClick={() => setViewMode('campaign')}
            >
              캠페인 단위
            </button>
            <button
              type="button"
              className={`icebiscuit-dashboard__view-mode${viewMode === 'creative' ? ' is-active' : ''}`}
              onClick={() => setViewMode('creative')}
            >
              소재 단위
            </button>
            <button
              type="button"
              className={`icebiscuit-dashboard__view-mode${viewMode === 'daily' ? ' is-active' : ''}`}
              onClick={() => setViewMode('daily')}
            >
              Daily 단위
            </button>
          </div>
          <span className="hint-chip">
            <CalendarDays size={14} />
            {periodLabel}
          </span>
        </div>
      </header>

      <section className="metrics-grid metrics-grid--seven">
        <MetricCard title="노출" value={formatNumber(activeMetrics.impressions)} delta="" helper={viewMode === 'daily' ? '선택 기간 일별 합계' : '선택 기간 합계'} accent="slate" icon={<Megaphone size={18} />} />
        <MetricCard title="클릭" value={formatNumber(activeMetrics.clicks)} delta="" helper={viewMode === 'daily' ? 'daily 기준 클릭' : '기간 총 클릭'} accent="emerald" icon={<MousePointerClick size={18} />} />
        <MetricCard title="CTR" value={formatRatioFixed(activeCtr, 2)} delta="" helper="노출 대비 클릭률" accent="gray" icon={<Target size={18} />} />
        <MetricCard title="광고비" value={formatCurrency(activeMetrics.adSpend)} delta="" helper="광고비 (마크업, vat-)" accent="amber" icon={<Coins size={18} />} valueSize="compact" />
        <MetricCard title="구매" value={formatNumber(activeMetrics.purchaseCount)} delta="" helper="기간 총 구매" accent="rose" icon={<ShoppingBag size={18} />} />
        <MetricCard title="금액" value={formatCurrency(activeMetrics.purchaseValue)} delta="" helper="기여매출" accent="violet" icon={<Users size={18} />} valueSize="compact" />
        <MetricCard title="ROAS" value={formatRatioFixed(activeRoas, 0)} delta="" helper="광고비 대비 기여매출" accent="sky" icon={<TrendingUp size={18} />} />
      </section>

      <section className="content-grid">
        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">{activeTableEyebrow}</p>
              <h2>{activeTableTitle}</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="icebiscuit-dashboard__equal-table icebiscuit-dashboard__equal-table--summary">
              <thead>
                <tr>
                  <th>{viewMode === 'daily' ? '일자' : '월'}</th>
                  <th>{viewMode === 'daily' ? '분류' : '노출'}</th>
                  <th>{viewMode === 'daily' ? '노출' : '클릭'}</th>
                  <th>{viewMode === 'daily' ? '클릭' : 'CTR'}</th>
                  <th>{viewMode === 'daily' ? 'CTR' : '광고비'}</th>
                  <th>{viewMode === 'daily' ? '광고비' : '구매'}</th>
                  <th>{viewMode === 'daily' ? '구매' : '금액'}</th>
                  <th>{viewMode === 'daily' ? '금액' : 'ROAS'}</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.length ? (
                  summaryRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{viewMode === 'daily' ? row.secondary : formatTableNumber(row.impressions)}</td>
                      <td>{viewMode === 'daily' ? formatTableNumber(row.impressions) : formatTableNumber(row.clicks)}</td>
                      <td>{viewMode === 'daily' ? formatTableNumber(row.clicks) : formatTableRatio(row.ctr, 2)}</td>
                      <td>{viewMode === 'daily' ? formatTableRatio(row.ctr, 2) : formatTableCurrency(row.adSpend)}</td>
                      <td>{viewMode === 'daily' ? formatTableCurrency(row.adSpend) : formatTableNumber(row.purchaseCount)}</td>
                      <td>{viewMode === 'daily' ? formatTableNumber(row.purchaseCount) : formatTableCurrency(row.purchaseValue)}</td>
                      <td>{viewMode === 'daily' ? formatTableCurrency(row.purchaseValue) : formatTableRatio(row.roas, 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="icebiscuit-dashboard__empty-cell">
                      {viewMode === 'creative' ? '소재 데이터는 다음 단계에서 연결할 예정이야.' : '선택한 기간 데이터가 아직 없어.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">조회 단위</p>
              <h2>
                {viewMode === 'campaign'
                  ? 'META 캠페인 성과'
                  : viewMode === 'daily'
                    ? 'META Daily 성과'
                    : 'META 소재 성과'}
              </h2>
            </div>
          </div>
          <div className="table-wrap">
            {viewMode === 'campaign' ? (
              <table className="icebiscuit-dashboard__equal-table icebiscuit-dashboard__equal-table--campaign">
                <thead>
                  <tr>
                    <th>캠페인</th>
                    <th>노출</th>
                    <th>클릭</th>
                    <th>CTR</th>
                    <th>광고비</th>
                    <th>구매</th>
                    <th>기여매출</th>
                    <th>구매율</th>
                    <th>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignTableRows.length ? (
                    campaignTableRows.flatMap((row) => {
                      const childRows = creativeRowsByCampaign.get(row.campaign_name) ?? []
                      const isExpanded = expandedCampaigns.includes(row.campaign_name)
                      const parentRow = (
                        <tr key={row.campaign_name}>
                          <td>
                            <div className="icebiscuit-dashboard__campaign-cell">
                              {childRows.length ? (
                                <button
                                  type="button"
                                  className="icebiscuit-dashboard__row-toggle"
                                  onClick={() => toggleCampaignExpansion(row.campaign_name)}
                                  aria-label={`${row.campaign_name} 소재 ${isExpanded ? '접기' : '펼치기'}`}
                                  title={`${row.campaign_name} 소재 ${isExpanded ? '접기' : '펼치기'}`}
                                >
                                  {isExpanded ? '−' : '+'}
                                </button>
                              ) : (
                                <span className="icebiscuit-dashboard__row-toggle icebiscuit-dashboard__row-toggle--placeholder">·</span>
                              )}
                              <span>{row.campaign_name}</span>
                            </div>
                          </td>
                          <td>{formatTableNumber(row.impressions)}</td>
                          <td>{formatTableNumber(row.clicks)}</td>
                          <td>{formatTableRatio(row.impressions > 0 ? row.clicks / row.impressions : null, 2)}</td>
                          <td>{formatTableCurrency(row.ad_spend)}</td>
                          <td>{formatTableNumber(row.purchase_count)}</td>
                          <td>{formatTableCurrency(row.purchase_value)}</td>
                          <td>{formatTableRatio(row.clicks > 0 ? row.purchase_count / row.clicks : null, 2)}</td>
                          <td>{formatTableRatio(row.ad_spend > 0 ? row.purchase_value / row.ad_spend : null, 0)}</td>
                        </tr>
                      )

                      if (!isExpanded || !childRows.length) {
                        return [parentRow]
                      }

                      return [
                        parentRow,
                        ...childRows.map((child) => (
                          <tr key={`${row.campaign_name}-${child.ad_id}`} className="icebiscuit-dashboard__child-row">
                            <td>
                              <div className="icebiscuit-dashboard__child-label">
                                <span className="icebiscuit-dashboard__child-prefix">소재</span>
                                <span>{child.ad_name}</span>
                              </div>
                            </td>
                            <td>{formatTableNumber(child.impressions)}</td>
                            <td>{formatTableNumber(child.clicks)}</td>
                            <td>{formatTableRatio(child.impressions > 0 ? child.clicks / child.impressions : null, 2)}</td>
                            <td>{formatTableCurrency(child.ad_spend)}</td>
                            <td>{formatTableNumber(child.purchase_count)}</td>
                            <td>{formatTableCurrency(child.purchase_value)}</td>
                            <td>{formatTableRatio(child.clicks > 0 ? child.purchase_count / child.clicks : null, 2)}</td>
                            <td>{formatTableRatio(child.ad_spend > 0 ? child.purchase_value / child.ad_spend : null, 0)}</td>
                          </tr>
                        )),
                      ]
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="icebiscuit-dashboard__empty-cell">선택한 기간 캠페인 데이터가 아직 없어.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{formatTableNumber(campaignTotals.impressions)}</td>
                    <td>{formatTableNumber(campaignTotals.clicks)}</td>
                    <td>{formatTableRatio(campaignTotals.impressions > 0 ? campaignTotals.clicks / campaignTotals.impressions : null, 2)}</td>
                    <td>{formatTableCurrency(campaignTotals.adSpend)}</td>
                    <td>{formatTableNumber(campaignTotals.purchaseCount)}</td>
                    <td>{formatTableCurrency(campaignTotals.purchaseValue)}</td>
                    <td>{formatTableRatio(campaignTotals.clicks > 0 ? campaignTotals.purchaseCount / campaignTotals.clicks : null, 2)}</td>
                    <td>{formatTableRatio(campaignTotals.adSpend > 0 ? campaignTotals.purchaseValue / campaignTotals.adSpend : null, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            ) : viewMode === 'daily' ? (
              <table className="icebiscuit-dashboard__equal-table icebiscuit-dashboard__equal-table--campaign">
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>캠페인</th>
                    <th>노출</th>
                    <th>클릭</th>
                    <th>CTR</th>
                    <th>광고비</th>
                    <th>구매</th>
                    <th>기여매출</th>
                    <th>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDaily.length ? (
                    filteredDaily.map((row) => (
                      <tr key={`${row.report_date}-${row.campaign_name}`}>
                        <td>{dayLabel(row.report_date)}</td>
                        <td>{formatCampaignName(row.campaign_name)}</td>
                        <td>{formatTableNumber(row.impressions)}</td>
                        <td>{formatTableNumber(row.clicks)}</td>
                        <td>{formatTableRatio(row.ctr, 2)}</td>
                        <td>{formatTableCurrency(row.ad_spend)}</td>
                        <td>{formatTableNumber(row.purchase_count)}</td>
                        <td>{formatTableCurrency(row.purchase_value)}</td>
                        <td>{formatTableRatio(row.roas, 0)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="icebiscuit-dashboard__empty-cell">선택한 기간의 daily 데이터가 아직 없어.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td>{formatTableNumber(dailyTotals.impressions)}</td>
                    <td>{formatTableNumber(dailyTotals.clicks)}</td>
                    <td>{formatTableRatio(activeCtr, 2)}</td>
                    <td>{formatTableCurrency(dailyTotals.adSpend)}</td>
                    <td>{formatTableNumber(dailyTotals.purchaseCount)}</td>
                    <td>{formatTableCurrency(dailyTotals.purchaseValue)}</td>
                    <td>{formatTableRatio(activeRoas, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <table className="icebiscuit-dashboard__equal-table icebiscuit-dashboard__equal-table--campaign">
                <thead>
                  <tr>
                    <th>소재</th>
                    <th>상위 캠페인</th>
                    <th>노출</th>
                    <th>클릭</th>
                    <th>CTR</th>
                    <th>광고비</th>
                    <th>구매</th>
                    <th>기여매출</th>
                    <th>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {creativeTableRows.length ? (
                    creativeTableRows.map((row) => (
                      <tr key={`${row.campaign_group}-${row.ad_id}`}>
                        <td>{row.ad_name}</td>
                        <td>{row.campaign_group}</td>
                        <td>{formatTableNumber(row.impressions)}</td>
                        <td>{formatTableNumber(row.clicks)}</td>
                        <td>{formatTableRatio(row.impressions > 0 ? row.clicks / row.impressions : null, 2)}</td>
                        <td>{formatTableCurrency(row.ad_spend)}</td>
                        <td>{formatTableNumber(row.purchase_count)}</td>
                        <td>{formatTableCurrency(row.purchase_value)}</td>
                        <td>{formatTableRatio(row.ad_spend > 0 ? row.purchase_value / row.ad_spend : null, 0)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="icebiscuit-dashboard__empty-cell">선택한 기간의 소재 데이터가 아직 없어.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
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
            <strong>{periodLabel}</strong>
            <p>캠페인 단위는 기간에 포함되는 월별 집계를 합산해 보여주고, daily 단위는 2026년 이후 raw daily view를 기준으로 보여줘.</p>
            <p>소재 단위는 2026년 이후 ad-level raw 적재 데이터를 기준으로 연결했다. adname 표기는 소재로 통일한다.</p>
            <p>캠페인 표에서 토글을 열면 같은 그룹 아래 소재 행을 펼쳐볼 수 있어.</p>
            <p>현재 총 CTR은 {formatRatio(activeCtr)}, 총 ROAS는 {formatRatio(activeRoas)}로 재계산했다.</p>
          </div>
        </article>
      </section>
    </div>
  )
}
