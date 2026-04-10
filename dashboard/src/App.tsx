import { useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  BellRing,
  ChevronDown,
  ChevronUp,
  Coins,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Settings,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import './App.css'
import thekaryPointLogo from '../assets/thekary-point-logo-reference.jpg'

type MonthlyOverviewRow = {
  report_month: string
  new_members: number | null
  app_downloads: number | null
  withdrawals: number | null
  net_growth: number | null
  cumulative_conversion_eom: number | null
  active_members_eom: number | null
  reported_mau: number | null
  sms_opt_in_members: number | null
  push_opt_in_members: number | null
  event_participant_count: number | null
  total_points_issued: number | null
  points_used: number | null
  point_usage_rate: number | null
  linked_sales_amount: number | null
  impressions: number | null
  clicks: number | null
  cpc: number | null
  ctr: number | null
  conversions: number | null
  conversion_rate: number | null
  ad_revenue: number | null
  ad_spend_markup_vat_exclusive: number | null
  roas_markup_vat_exclusive: number | null
}

type PromotionRow = {
  report_month: string
  promotion_type: string
  point_amount: number | null
  participant_count: number | null
  probability: number | null
  total_points_issued: number | null
  points_used: number | null
  point_usage_rate: number | null
  linked_sales_amount: number | null
}

type AdCampaignRow = {
  report_month: string
  media: string | null
  placement_name: string | null
  period_text: string | null
  campaign_goal: string | null
  impressions: number | null
  clicks: number | null
  cpc: number | null
  ctr: number | null
  conversions: number | null
  conversion_rate: number | null
  revenue: number | null
  average_order_value: number | null
  ad_spend_vat_inclusive: number | null
  ad_spend_vat_exclusive: number | null
  ad_spend_markup_vat_exclusive: number | null
  roas_vat_exclusive: number | null
  roas_markup_vat_exclusive: number | null
  creative_text: string | null
  note: string | null
}

type DailyMemberRow = {
  report_date: string
  report_month: string
  member_count: number | null
  app_downloads: number | null
  withdrawals: number | null
  net_growth: number | null
  cumulative_conversion: number | null
  active_members: number | null
  is_month_end: boolean | null
  issue_note: string | null
}

type ActivityDailyRow = {
  report_date: string
  report_month: string
  dau: number | null
}

type DashboardPayload = {
  overview: MonthlyOverviewRow[]
  promotions: PromotionRow[]
  campaigns: AdCampaignRow[]
  memberDaily: DailyMemberRow[]
  activityDaily: ActivityDailyRow[]
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

const MEMBER_TARGET_2026 = 280_000
const APP_DOWNLOAD_TARGET_2026 = 130_000

const DASHBOARD_PASSWORD = 'thekary'
const DASHBOARD_AUTH_KEY = 'thekary-dashboard-authenticated'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const sourceSheetUrl = import.meta.env.VITE_SOURCE_SHEET_URL as string | undefined

const REPORT_STEPS = [
  { key: 'summary', label: 'SUMMARY' },
  { key: 'exposure', label: '노출' },
  { key: 'ad', label: 'AD' },
  { key: 'next-plan', label: 'NEXT PLAN' },
] as const

const REPORT_AD_IMAGES: Record<string, Array<{ label: string; src: string }>> = {
  '2026-01': [
    { label: '트래픽', src: '/report-ad/2026-01-traffic.jpg' },
    { label: '구매전환', src: '/report-ad/2026-01-purchase.jpg' },
  ],
  '2026-02': [
    { label: '트래픽', src: '/report-ad/2026-02-traffic.jpg' },
    { label: '구매전환', src: '/report-ad/2026-02-purchase.jpg' },
  ],
  '2026-03': [
    { label: '트래픽', src: '/report-ad/2026-03-traffic.jpg' },
    { label: '구매전환', src: '/report-ad/2026-03-purchase.jpg' },
  ],
  '2026-04': [
    { label: '트래픽', src: '/report-ad/2026-04-traffic.jpg' },
    { label: '구매전환', src: '/report-ad/2026-04-purchase.jpg' },
  ],
}

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

function monthEndLabel(value: string) {
  const [yearText, monthText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}.${String(month).padStart(2, '0')}.${String(lastDay).padStart(2, '0')}`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return numberFormatter.format(value)
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return currencyFormatter.format(value)
}

function formatRatio(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return ratioPercentFormatter.format(value)
}

function formatSigned(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined) return '데이터 없음'
  const sign = value > 0 ? '+' : ''
  return `${sign}${numberFormatter.format(value)}${suffix}`
}

function calculateDelta(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null
  }
  return current - previous
}

function summarizeChange(current: number | null | undefined, previous: number | null | undefined, unit = '') {
  const delta = calculateDelta(current, previous)
  if (delta === null) return '전월 비교 데이터 없음'
  if (delta === 0) return `전월과 동일${unit ? ` (${unit})` : ''}`
  return `전월 대비 ${formatSigned(delta, unit)}`
}

function achievementText(current: number | null | undefined, target: number) {
  if (current === null || current === undefined) return `목표 ${formatNumber(target)} 기준 데이터 없음`
  const ratio = current / target
  return `${formatNumber(current)} / ${formatNumber(target)} (${ratioPercentFormatter.format(ratio)})`
}

function achievementRatio(current: number | null | undefined, target: number) {
  if (current === null || current === undefined) return '-'
  return ratioPercentFormatter.format(current / target)
}

function monthlyAverageDau(rows: ActivityDailyRow[], reportMonth: string) {
  const monthlyRows = rows.filter((row) => row.report_month === reportMonth && row.dau !== null)
  if (!monthlyRows.length) return null
  const sum = monthlyRows.reduce((accumulator, row) => accumulator + (row.dau ?? 0), 0)
  return Math.round(sum / monthlyRows.length)
}

function summarizePercentChange(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) {
    return '전월 비교 데이터 없음'
  }
  const changeRate = (current - previous) / previous
  if (changeRate === 0) return '전월과 동일 (0%)'
  const sign = changeRate > 0 ? '+' : ''
  return `전월 대비 ${sign}${ratioPercentFormatter.format(changeRate)}`
}

function formatRoasPercent(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return '-'
  return `${numberFormatter.format(Math.round(value * 100))}%`
}

function formatNullableNumber(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return '-'
  return formatNumber(value)
}

function formatNullableRatio(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return '-'
  return formatRatio(value)
}

function formatNullableCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return '-'
  return formatCurrency(value)
}

function campaignSortRank(name: string | null | undefined, goal: string | null | undefined) {
  const normalizedName = name?.trim() ?? ''
  const normalizedGoal = goal?.trim() ?? ''
  if (normalizedName.includes('CV') || normalizedGoal.includes('CV')) return 0
  if (normalizedName.includes('TR') || normalizedGoal.includes('TR')) return 1
  if (normalizedName.includes('전월소재') || normalizedGoal.includes('전월소재')) return 2
  return 3
}

function formatCampaignLabel(name: string | null | undefined) {
  const normalizedName = name?.trim() ?? ''
  if (normalizedName.startsWith('CV_')) return '구매전환'
  if (normalizedName.startsWith('TR_')) return '트래픽'
  return normalizedName || '-'
}

function MetricCard({ title, value, delta, helper, accent, icon, valueSize = 'default' }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${accent}`}>
      <div className="metric-card__header">
        <span className="metric-card__icon">{icon}</span>
        <span className="metric-card__title">{title}</span>
      </div>
      <strong className={`metric-card__value metric-card__value--${valueSize}`}>{value}</strong>
      {delta ? <p className="metric-card__delta">{delta}</p> : null}
      {helper ? <p className="metric-card__helper">{helper}</p> : null}
    </article>
  )
}

function ReportStepNav({ active }: { active: (typeof REPORT_STEPS)[number]['key'] }) {
  return (
    <div className="report-step-nav" aria-label="report sections">
      {REPORT_STEPS.map((step) => (
        <span key={step.key} className={`report-step-nav__item${step.key === active ? ' is-active' : ''}`}>
          {step.label}
        </span>
      ))}
    </div>
  )
}

async function fetchDashboardData() {
  if (!supabase) {
    throw new Error('Supabase env is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  const [overviewResult, promotionResult, campaignResult, memberDailyResult, activityDailyResult] = await Promise.all([
    supabase.from('dashboard_monthly_overview').select('*').order('report_month', { ascending: false }),
    supabase.from('dashboard_promotion_breakdown').select('*').order('report_month', { ascending: false }),
    supabase.from('dashboard_ad_campaign_breakdown').select('*').order('report_month', { ascending: false }),
    supabase.from('dashboard_member_daily').select('*').order('report_date', { ascending: false }),
    supabase.from('dashboard_activity_daily').select('*').order('report_date', { ascending: false }),
  ])

  if (overviewResult.error) throw overviewResult.error
  if (promotionResult.error) throw promotionResult.error
  if (campaignResult.error) throw campaignResult.error
  if (memberDailyResult.error) throw memberDailyResult.error
  if (activityDailyResult.error) throw activityDailyResult.error

  return {
    overview: overviewResult.data as MonthlyOverviewRow[],
    promotions: promotionResult.data as PromotionRow[],
    campaigns: campaignResult.data as AdCampaignRow[],
    memberDaily: memberDailyResult.data as DailyMemberRow[],
    activityDaily: activityDailyResult.data as ActivityDailyRow[],
  } satisfies DashboardPayload
}

function App() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [isPromotionExpanded, setIsPromotionExpanded] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isReportConfirmOpen, setIsReportConfirmOpen] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const reportPage1Ref = useRef<HTMLDivElement | null>(null)
  const reportPage2Ref = useRef<HTMLDivElement | null>(null)
  const reportPage2ContentRef = useRef<HTMLDivElement | null>(null)
  const reportPage3Ref = useRef<HTMLDivElement | null>(null)
  const reportPage4Ref = useRef<HTMLDivElement | null>(null)
  const reportPage5Ref = useRef<HTMLDivElement | null>(null)
  const metricsSectionRef = useRef<HTMLElement | null>(null)
  const summaryPanelRef = useRef<HTMLElement | null>(null)
  const promotionPanelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const savedAuth = window.sessionStorage.getItem(DASHBOARD_AUTH_KEY)
    setIsAuthenticated(savedAuth === 'true')
    setAuthChecked(true)
  }, [])

  useEffect(() => {
    if (!authChecked) return
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    let active = true

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const payload = await fetchDashboardData()
        if (!active) return

        const meaningfulMonths = payload.overview
          .filter((row) => row.cumulative_conversion_eom !== null)
          .map((row) => row.report_month)

        setData(payload)
        setSelectedMonth((current) => current || meaningfulMonths[0] || payload.overview[0]?.report_month || '')
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
  }, [authChecked, isAuthenticated])

  function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (passwordInput.trim() !== DASHBOARD_PASSWORD) {
      setPasswordError('비밀번호가 올바르지 않습니다.')
      return
    }
    window.sessionStorage.setItem(DASHBOARD_AUTH_KEY, 'true')
    setPasswordError(null)
    setIsAuthenticated(true)
    setLoading(true)
  }

  const meaningfulOverview = useMemo(() => {
    if (!data) return []
    return data.overview
      .filter((row) => row.cumulative_conversion_eom !== null)
      .slice()
      .sort((a, b) => a.report_month.localeCompare(b.report_month))
  }, [data])

  const monthOptions = useMemo(() => meaningfulOverview.map((row) => row.report_month).reverse(), [meaningfulOverview])

  const currentRow = useMemo(
    () => meaningfulOverview.find((row) => row.report_month === selectedMonth) ?? meaningfulOverview.at(-1),
    [meaningfulOverview, selectedMonth],
  )

  const currentIndex = currentRow
    ? meaningfulOverview.findIndex((row) => row.report_month === currentRow.report_month)
    : -1

  const previousRow = useMemo(() => {
    if (currentIndex < 1) return undefined
    return meaningfulOverview[currentIndex - 1]
  }, [currentIndex, meaningfulOverview])

  const latestSixMonths = useMemo(() => {
    if (currentIndex < 0) return []
    const startIndex = Math.max(0, currentIndex - 5)
    return meaningfulOverview.slice(startIndex, currentIndex + 1)
  }, [currentIndex, meaningfulOverview])

  const optInOverview = useMemo(() => {
    if (!data) return []
    return data.overview
      .filter((row) => row.sms_opt_in_members !== null || row.push_opt_in_members !== null)
      .slice()
      .sort((a, b) => a.report_month.localeCompare(b.report_month))
  }, [data])

  const currentOptInCount = useMemo(() => {
    if (!currentRow) return null
    return currentRow.push_opt_in_members ?? currentRow.sms_opt_in_members
  }, [currentRow])

  const cumulativeOptInCount = useMemo(() => {
    if (!currentRow) return 0
    return optInOverview.reduce((sum, row) => {
      if (row.report_month > currentRow.report_month) return sum
      const monthlyValue = row.push_opt_in_members ?? row.sms_opt_in_members ?? 0
      return sum + monthlyValue
    }, 0)
  }, [currentRow, optInOverview])

  const promotionsForMonth = useMemo(
    () =>
      (data?.promotions.filter(
        (row) => row.report_month === currentRow?.report_month && Boolean(row.promotion_type?.trim()),
      ) ?? []).slice().sort((a, b) => {
        const promotionCompare = a.promotion_type.localeCompare(b.promotion_type, 'ko')
        if (promotionCompare !== 0) return promotionCompare
        return (a.point_amount ?? Number.MAX_SAFE_INTEGER) - (b.point_amount ?? Number.MAX_SAFE_INTEGER)
      }),
    [currentRow?.report_month, data?.promotions],
  )

  const expandedPromotionRows = useMemo(
    () =>
      promotionsForMonth.map((row, index) => ({
        promotion_type: row.promotion_type,
        participant_count: row.participant_count,
        total_points_issued: row.total_points_issued,
        point_display: row.point_amount ? `${formatNumber(row.point_amount)}P` : '-',
        displayPromotionType: index === 0 || promotionsForMonth[index - 1]?.promotion_type !== row.promotion_type,
        key: `${row.report_month}-${row.promotion_type}-${row.point_amount}-${row.total_points_issued}`,
      })),
    [promotionsForMonth],
  )

  const collapsedPromotionRows = useMemo(() => {
    const groupedRows = new Map<string, { promotion_type: string; participant_count: number; total_points_issued: number; min_point: number | null; max_point: number | null; key: string }>()

    promotionsForMonth.forEach((row) => {
      const existing = groupedRows.get(row.promotion_type)
      const pointAmount = row.point_amount ?? null
      if (existing) {
        existing.participant_count += row.participant_count ?? 0
        existing.total_points_issued += row.total_points_issued ?? 0
        existing.min_point = pointAmount === null ? existing.min_point : existing.min_point === null ? pointAmount : Math.min(existing.min_point, pointAmount)
        existing.max_point = pointAmount === null ? existing.max_point : existing.max_point === null ? pointAmount : Math.max(existing.max_point, pointAmount)
      } else {
        groupedRows.set(row.promotion_type, {
          promotion_type: row.promotion_type,
          participant_count: row.participant_count ?? 0,
          total_points_issued: row.total_points_issued ?? 0,
          min_point: pointAmount,
          max_point: pointAmount,
          key: `${row.report_month}-${row.promotion_type}`,
        })
      }
    })

    return Array.from(groupedRows.values()).map((row) => ({
      ...row,
      point_display:
        row.min_point === null || row.max_point === null
          ? '-'
          : row.min_point === row.max_point
            ? `${formatNumber(row.min_point)}P`
            : `${formatNumber(row.min_point)} ~ ${formatNumber(row.max_point)}P`,
      displayPromotionType: true,
    }))
  }, [promotionsForMonth])

  const promotionTableRows = isPromotionExpanded ? expandedPromotionRows : collapsedPromotionRows

  const campaignsForMonth = useMemo(
    () =>
      (data?.campaigns.filter((row) => row.report_month === currentRow?.report_month) ?? []).slice().sort((a, b) => {
        const goalCompare = campaignSortRank(a.placement_name, a.campaign_goal) - campaignSortRank(b.placement_name, b.campaign_goal)
        if (goalCompare !== 0) return goalCompare
        return (a.placement_name ?? '').localeCompare(b.placement_name ?? '', 'ko')
      }),
    [currentRow?.report_month, data?.campaigns],
  )

  const promotionTotals = useMemo(
    () => ({
      participantCount: promotionsForMonth.reduce((sum, row) => sum + (row.participant_count ?? 0), 0),
      totalPointsIssued: promotionsForMonth.reduce((sum, row) => sum + (row.total_points_issued ?? 0), 0),
    }),
    [promotionsForMonth],
  )

  const campaignTotals = useMemo(() => {
    const adSpend = campaignsForMonth.reduce((sum, row) => sum + (row.ad_spend_markup_vat_exclusive ?? 0), 0)
    const revenue = campaignsForMonth.reduce((sum, row) => sum + (row.revenue ?? 0), 0)
    const impressions = campaignsForMonth.reduce((sum, row) => sum + (row.impressions ?? 0), 0)
    const clicks = campaignsForMonth.reduce((sum, row) => sum + (row.clicks ?? 0), 0)
    return {
      adSpend,
      revenue,
      roas: adSpend > 0 ? revenue / adSpend : null,
      ctr: impressions > 0 ? clicks / impressions : null,
      impressions,
      clicks,
    }
  }, [campaignsForMonth])

  const currentAverageDau = useMemo(
    () => (currentRow ? monthlyAverageDau(data?.activityDaily ?? [], currentRow.report_month) : null),
    [currentRow, data?.activityDaily],
  )

  const sixMonthRows = useMemo(
    () =>
      latestSixMonths.map((row) => ({
        ...row,
        opt_in_count: row.push_opt_in_members ?? row.sms_opt_in_members,
        average_dau: monthlyAverageDau(data?.activityDaily ?? [], row.report_month),
      })),
    [data?.activityDaily, latestSixMonths],
  )

  const previousAverageDau = useMemo(
    () => (previousRow ? monthlyAverageDau(data?.activityDaily ?? [], previousRow.report_month) : null),
    [previousRow, data?.activityDaily],
  )

  const currentMau = currentRow?.reported_mau ?? null
  const previousMau = previousRow?.reported_mau ?? null

  const cumulativeNetMembers = currentIndex >= 0
    ? meaningfulOverview.slice(0, currentIndex + 1).reduce((sum, row) => sum + (row.net_growth ?? 0), 0)
    : null

  const cumulativeAppDownloads = currentIndex >= 0
    ? meaningfulOverview.slice(0, currentIndex + 1).reduce((sum, row) => sum + (row.app_downloads ?? 0), 0)
    : null

  const memberKpiRatio = achievementRatio(cumulativeNetMembers, MEMBER_TARGET_2026)
  const appDownloadKpiRatio = achievementRatio(cumulativeAppDownloads, APP_DOWNLOAD_TARGET_2026)
  const reportMonthKey = currentRow ? monthLabel(currentRow.report_month) : ''
  const reportAdImages = reportMonthKey ? REPORT_AD_IMAGES[reportMonthKey] ?? [] : []

  const chartData = useMemo(
    () =>
      latestSixMonths.map((row) => ({
        month: monthLabel(row.report_month),
        신규회원: row.new_members ?? 0,
        앱다운로드: row.app_downloads ?? 0,
        포인트연계매출: row.linked_sales_amount ?? 0,
        광고기여매출: row.ad_revenue ?? 0,
      })),
    [latestSixMonths],
  )

  const insightItems = useMemo(() => {
    if (!currentRow) return []

    return [
      `${monthLabel(currentRow.report_month)} 누적 가입자는 ${formatNumber(cumulativeNetMembers)}명으로 ${achievementText(cumulativeNetMembers, MEMBER_TARGET_2026)} 상태.`,
      `앱다운로드는 ${formatNumber(currentRow.app_downloads)}건, 누적 기준은 ${achievementText(cumulativeAppDownloads, APP_DOWNLOAD_TARGET_2026)}.`,
      `포인트 연계매출은 ${formatCurrency(currentRow.linked_sales_amount)}이며 광고 기여매출은 ${formatCurrency(currentRow.ad_revenue)}.`,
      `MAU는 ${formatNumber(currentMau)}명, DAU는 ${currentAverageDau ? `${formatNumber(currentAverageDau)}명` : '집계 없음'}으로 표시했어. DAU는 월평균 기준이며 2026-02-24부터 제공된 일별 실데이터를 사용해.`,
    ]
  }, [cumulativeAppDownloads, cumulativeNetMembers, currentAverageDau, currentMau, currentRow])

  async function captureReportPage(element: HTMLDivElement | null) {
    if (!element) throw new Error('리포트 페이지를 찾을 수 없습니다.')
    const canvas = await html2canvas(element, {
      scale: 1.5,
      backgroundColor: '#ffffff',
      useCORS: true,
    })
    return canvas.toDataURL('image/jpeg', 0.86)
  }

  function syncReportSummaryDom() {
    const mount = reportPage2ContentRef.current
    const metrics = metricsSectionRef.current
    const summary = summaryPanelRef.current
    const promotion = promotionPanelRef.current

    if (!mount || !metrics || !summary || !promotion) {
      throw new Error('대시보드 섹션을 찾을 수 없습니다.')
    }

    mount.innerHTML = ''

    const metricsClone = metrics.cloneNode(true) as HTMLElement
    const summaryClone = summary.cloneNode(true) as HTMLElement
    const promotionClone = promotion.cloneNode(true) as HTMLElement
    const bottomRow = document.createElement('div')

    metricsClone.classList.add('report-dom-clone__metrics')
    summaryClone.classList.add('report-dom-clone__panel', 'report-dom-clone__panel--summary')
    promotionClone.classList.add('report-dom-clone__panel', 'report-dom-clone__panel--promotion')
    bottomRow.className = 'report-dashboard-clone__bottom'

    promotionClone.querySelectorAll('.icon-toggle-button').forEach((node) => node.remove())

    bottomRow.append(summaryClone, promotionClone)
    mount.append(metricsClone, bottomRow)
  }

  async function handleGenerateReport() {
    if (!currentRow || isGeneratingReport) return

    const previousExpanded = isPromotionExpanded

    try {
      setIsGeneratingReport(true)
      setIsReportConfirmOpen(false)
      setIsSettingsOpen(false)

      if (previousExpanded) {
        setIsPromotionExpanded(false)
        await new Promise((resolve) => window.setTimeout(resolve, 120))
      }

      syncReportSummaryDom()
      await new Promise((resolve) => window.setTimeout(resolve, 50))

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080] })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 0
      const refs = [reportPage1Ref, reportPage2Ref, reportPage3Ref, reportPage4Ref, reportPage5Ref]

      for (const [index, ref] of refs.entries()) {
        const imageData = await captureReportPage(ref.current)
        if (index > 0) pdf.addPage()
        pdf.addImage(imageData, 'JPEG', margin, margin, pageWidth - margin * 2, pageHeight - margin * 2)
      }

      pdf.save(`thekary-point-report-${monthLabel(currentRow.report_month)}.pdf`)
    } catch (reportError) {
      const message = reportError instanceof Error ? reportError.message : '리포트 생성 중 오류가 발생했습니다.'
      window.alert(message)
    } finally {
      if (previousExpanded) {
        setIsPromotionExpanded(true)
      }
      setIsGeneratingReport(false)
    }
  }

  if (!authChecked) {
    return <div className="status-screen">접근 상태를 확인하는 중…</div>
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={handlePasswordSubmit}>
          <div className="auth-card__icon">
            <Lock size={20} />
          </div>
          <p className="eyebrow">THEKARY POINT DASHBOARD</p>
          <h1>암호를 입력해주세요.</h1>
          <input
            className="auth-card__input"
            type="password"
            value={passwordInput}
            onChange={(event) => {
              setPasswordInput(event.target.value)
              if (passwordError) setPasswordError(null)
            }}
            placeholder="비밀번호 입력"
          />
          {passwordError ? <p className="auth-card__error">{passwordError}</p> : null}
          <button className="primary-button auth-card__button" type="submit">
            확인
          </button>
        </form>
      </div>
    )
  }

  if (loading) {
    return <div className="status-screen">대시보드 데이터를 불러오는 중…</div>
  }

  if (error) {
    return (
      <div className="status-screen status-screen--error">
        <h1>연결 오류</h1>
        <p>{error}</p>
        <p>dashboard/.env.local 에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 넣어줘.</p>
      </div>
    )
  }

  if (!currentRow) {
    return <div className="status-screen">표시할 데이터가 아직 없어.</div>
  }

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">THEKARY POINT DASHBOARD</p>
          <h1>월간 통합 성과 대시보드</h1>
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
          <button className="ghost-button" type="button" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> 새로고침
          </button>
          <div className="settings-menu">
            <button
              className="ghost-button settings-menu__trigger"
              type="button"
              onClick={() => setIsSettingsOpen((current) => !current)}
              aria-label="대시보드 메뉴 열기"
            >
              <Settings size={16} />
            </button>
            {isSettingsOpen ? (
              <div className="settings-menu__panel">
                {sourceSheetUrl ? (
                  <a className="settings-menu__item" href={sourceSheetUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} /> 원본 시트 열기
                  </a>
                ) : (
                  <span className="settings-menu__item settings-menu__item--disabled">
                    <ExternalLink size={16} /> 원본 시트 열기
                  </span>
                )}
                <button className="settings-menu__item" type="button" onClick={() => setIsReportConfirmOpen(true)}>
                  <FileText size={16} /> {isGeneratingReport ? '리포트 생성 중…' : '리포트 만들기'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="metrics-grid metrics-grid--seven" ref={metricsSectionRef}>
        <MetricCard
          title="회원수"
          value={`${formatNumber(currentRow.new_members)}명`}
          delta={`누적 ${formatNumber(cumulativeNetMembers)} /`}
          helper={`26Y KPI ${formatNumber(MEMBER_TARGET_2026)} (${memberKpiRatio})`}
          accent="slate"
          icon={<Users size={18} />}
        />
        <MetricCard
          title="앱다운로드"
          value={`${formatNumber(currentRow.app_downloads)}건`}
          delta={`누적 ${formatNumber(cumulativeAppDownloads)} /`}
          helper={`26Y KPI ${formatNumber(APP_DOWNLOAD_TARGET_2026)} (${appDownloadKpiRatio})`}
          accent="amber"
          icon={<Download size={18} />}
        />
        <MetricCard
          title="수신동의수"
          value={currentOptInCount !== null ? `${formatNumber(currentOptInCount)}건` : '연동 대기'}
          delta={`누적 ${formatNumber(cumulativeOptInCount)}건`}
          helper=""
          accent="gray"
          icon={<BellRing size={18} />}
        />
        <MetricCard
          title="포인트 연계매출"
          value={formatCurrency(currentRow.linked_sales_amount)}
          delta={summarizePercentChange(currentRow.linked_sales_amount, previousRow?.linked_sales_amount)}
          helper={`포인트 사용률 ${formatRatio(currentRow.point_usage_rate)}`}
          accent="emerald"
          icon={<Coins size={18} />}
          valueSize="compact"
        />
        <MetricCard
          title="광고 기여매출"
          value={formatCurrency(currentRow.ad_revenue)}
          delta={summarizePercentChange(currentRow.ad_revenue, previousRow?.ad_revenue)}
          helper={`ROAS ${formatRoasPercent(currentRow.roas_markup_vat_exclusive)}`}
          accent="violet"
          icon={<Megaphone size={18} />}
          valueSize="compact"
        />
        <MetricCard
          title="MAU"
          value={currentMau ? `${formatNumber(currentMau)}명` : '집계 없음'}
          delta={summarizeChange(currentMau, previousMau, '명')}
          helper={currentMau ? '' : '월별 MAU 데이터 없음'}
          accent="sky"
          icon={<TrendingUp size={18} />}
        />
        <MetricCard
          title="DAU"
          value={currentAverageDau ? `${formatNumber(currentAverageDau)}명` : '집계 없음'}
          delta={summarizeChange(currentAverageDau, previousAverageDau, '명')}
          helper={currentAverageDau ? '월평균 기준' : '2026-02-24 이전 데이터 없음'}
          accent="rose"
          icon={<MousePointerClick size={18} />}
        />
      </section>

      <section className="content-grid">
        <article className="panel panel--wide" ref={summaryPanelRef}>
          <div className="panel__header">
            <div>
              <h2>최근 6개월 핵심 지표 추이</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>월</th>
                  <th>회원수</th>
                  <th>앱다운로드</th>
                  <th>수신동의수</th>
                  <th>포인트 연계매출</th>
                  <th>광고 기여매출</th>
                  <th>MAU</th>
                  <th>DAU</th>
                </tr>
              </thead>
              <tbody>
                {sixMonthRows.slice().reverse().map((row) => (
                  <tr key={row.report_month} className={row.report_month === currentRow.report_month ? 'is-selected' : ''}>
                    <td>{monthLabel(row.report_month)}</td>
                    <td>{formatNumber(row.new_members)}</td>
                    <td>{formatNumber(row.app_downloads)}</td>
                    <td>{formatNumber(row.opt_in_count)}</td>
                    <td>{formatCurrency(row.linked_sales_amount)}</td>
                    <td>{formatCurrency(row.ad_revenue)}</td>
                    <td>{formatNumber(row.reported_mau)}</td>
                    <td>{formatNumber(row.average_dau)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel panel--wide" ref={promotionPanelRef}>
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">프로모션</p>
              <h2>포인트현황</h2>
            </div>
            <button
              className="icon-toggle-button"
              type="button"
              onClick={() => setIsPromotionExpanded((current) => !current)}
              aria-label={isPromotionExpanded ? 'variation 접기' : 'variation 펼치기'}
              title={isPromotionExpanded ? 'variation 접기' : 'variation 펼치기'}
            >
              {isPromotionExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>프로모션</th>
                  <th>지급 인원</th>
                  <th>지급 포인트</th>
                  <th>총 지급</th>
                </tr>
              </thead>
              <tbody>
                {promotionTableRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.displayPromotionType ? row.promotion_type : ''}</td>
                    <td>{formatNumber(row.participant_count)}</td>
                    <td>{row.point_display}</td>
                    <td>{row.total_points_issued ? `${formatNumber(row.total_points_issued)}P` : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{formatNumber(promotionTotals.participantCount)}</td>
                  <td>-</td>
                  <td>{`${formatNumber(promotionTotals.totalPointsIssued)}P`}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>

        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">광고 상세</p>
              <h2>META 캠페인 성과</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>캠페인</th>
                  <th>광고비 (마크업, vat-)</th>
                  <th>광고 기여매출</th>
                  <th>ROAS</th>
                  <th>CTR</th>
                  <th>노출</th>
                  <th>클릭</th>
                </tr>
              </thead>
              <tbody>
                {campaignsForMonth.map((row) => (
                  <tr key={`${row.report_month}-${row.placement_name}-${row.campaign_goal}`}> 
                    <td>{formatCampaignLabel(row.placement_name)}</td>
                    <td>{formatNullableCurrency(row.ad_spend_markup_vat_exclusive)}</td>
                    <td>{formatNullableCurrency(row.revenue)}</td>
                    <td>{formatRoasPercent(row.roas_markup_vat_exclusive)}</td>
                    <td>{formatNullableRatio(row.ctr)}</td>
                    <td>{formatNullableNumber(row.impressions)}</td>
                    <td>{formatNullableNumber(row.clicks)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{formatCurrency(campaignTotals.adSpend)}</td>
                  <td>{formatCurrency(campaignTotals.revenue)}</td>
                  <td>{formatRoasPercent(campaignTotals.roas)}</td>
                  <td>{formatRatio(campaignTotals.ctr)}</td>
                  <td>{formatNumber(campaignTotals.impressions)}</td>
                  <td>{formatNumber(campaignTotals.clicks)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>

        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">자동 요약</p>
              <h2>결과 인사이트</h2>
            </div>
          </div>
          <ul className="insight-list">
            {insightItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">최근 6개월</p>
              <h2>핵심 지표 추이</h2>
            </div>
            <div className="panel__legend">
              <span><TrendingUp size={14} /> 회원/다운로드</span>
              <span><TrendingDown size={14} /> 매출 계열</span>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 8, right: 24, left: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickMargin={8} />
                <YAxis
                  yAxisId="left"
                  width={56}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => numberFormatter.format(Number(value ?? 0))}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  width={76}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => numberFormatter.format(Number(value ?? 0))}
                />
                <Tooltip formatter={(value) => numberFormatter.format(Number(value ?? 0))} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="신규회원" stroke="#0f172a" strokeWidth={3} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="앱다운로드" stroke="#f59e0b" strokeWidth={3} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="포인트연계매출" stroke="#10b981" strokeWidth={3} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="광고기여매출" stroke="#8b5cf6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      {isReportConfirmOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsReportConfirmOpen(false)}>
          <div className="confirm-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2>리포트 만들기</h2>
            <p>{`${monthLabelKorean(currentRow.report_month)} 기준 리포트를 생성합니다.`}</p>
            <div className="confirm-modal__actions">
              <button className="ghost-button" type="button" onClick={() => setIsReportConfirmOpen(false)}>
                취소
              </button>
              <button className="primary-button" type="button" onClick={() => void handleGenerateReport()}>
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="report-stage" aria-hidden="true">
        <div className="report-page report-page--cover" ref={reportPage1Ref}>
          <div className="report-cover__center">
            <p className="report-cover__eyebrow">THEKARY POINT REPORT</p>
            <h1 className="report-cover__title">
              <span className="report-cover__title-gray">더캐리포인트</span>{' '}
              <span className="report-cover__title-accent">{monthLabel(currentRow.report_month).slice(5).replace('-', '')}월 운영 결과 보고서</span>
            </h1>
            <div className="report-cover__meta report-cover__meta--center">
              <span>마케팅 2팀</span>
              <span>{monthEndLabel(currentRow.report_month)}</span>
            </div>
          </div>
          <div className="report-cover__logo-wrap report-cover__logo-wrap--bottom">
            <img className="report-logo-image report-logo-image--cover" src={thekaryPointLogo} alt="Thekary Point logo" />
          </div>
        </div>

        <div className="report-page" ref={reportPage2Ref}>
          <div className="report-page__logo-corner">
            <img className="report-logo-image report-logo-image--corner" src={thekaryPointLogo} alt="Thekary Point logo" />
          </div>
          <div className="report-page__scale report-page__scale--dashboard">
            <div className="report-page__header">
              <p>THEKARY POINT REPORT</p>
              <h2>{`${monthLabelKorean(currentRow.report_month)} 요약`}</h2>
              <ReportStepNav active="summary" />
            </div>
            <div className="report-dashboard-clone" ref={reportPage2ContentRef} />
          </div>
        </div>

        <div className="report-page" ref={reportPage3Ref}>
          <div className="report-page__logo-corner">
            <img className="report-logo-image report-logo-image--corner" src={thekaryPointLogo} alt="Thekary Point logo" />
          </div>
          <div className="report-page__scale">
            <div className="report-page__header">
              <p>THEKARY POINT REPORT</p>
              <h2>{`${monthLabelKorean(currentRow.report_month)} 노출`}</h2>
              <ReportStepNav active="exposure" />
            </div>
            <div className="report-placeholder-panel report-placeholder-panel--wide">
              <strong>노출 페이지 구성 예정</strong>
              <p>현재는 섹션 위치 확인용 페이지야. 다음 단계에서 노출·트래픽 중심 지표와 시각화를 연결할 수 있게 자리만 먼저 잡아뒀어.</p>
            </div>
          </div>
        </div>

        <div className="report-page" ref={reportPage4Ref}>
          <div className="report-page__logo-corner">
            <img className="report-logo-image report-logo-image--corner" src={thekaryPointLogo} alt="Thekary Point logo" />
          </div>
          <div className="report-page__scale report-page__scale--ad">
            <div className="report-page__header">
              <p>THEKARY POINT REPORT</p>
              <h2>{`${monthLabelKorean(currentRow.report_month)} AD`}</h2>
              <ReportStepNav active="ad" />
            </div>
            <article className="report-panel report-panel--ad-table">
              <div className="report-panel__header">
                <div>
                  <span>광고 상세</span>
                  <h3>META 캠페인 성과</h3>
                </div>
              </div>
              <div className="report-table-wrap report-table-wrap--ad">
                <table className="report-table report-table--ad">
                  <thead>
                    <tr>
                      <th>캠페인</th>
                      <th>광고비</th>
                      <th>광고 기여매출</th>
                      <th>ROAS</th>
                      <th>CTR</th>
                      <th>노출</th>
                      <th>클릭</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignsForMonth.map((row) => (
                      <tr key={`report-${row.report_month}-${row.placement_name}-${row.campaign_goal}`}>
                        <td>{formatCampaignLabel(row.placement_name)}</td>
                        <td>{formatNullableCurrency(row.ad_spend_markup_vat_exclusive)}</td>
                        <td>{formatNullableCurrency(row.revenue)}</td>
                        <td>{formatRoasPercent(row.roas_markup_vat_exclusive)}</td>
                        <td>{formatNullableRatio(row.ctr)}</td>
                        <td>{formatNullableNumber(row.impressions)}</td>
                        <td>{formatNullableNumber(row.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td>{formatCurrency(campaignTotals.adSpend)}</td>
                      <td>{formatCurrency(campaignTotals.revenue)}</td>
                      <td>{formatRoasPercent(campaignTotals.roas)}</td>
                      <td>{formatRatio(campaignTotals.ctr)}</td>
                      <td>{formatNumber(campaignTotals.impressions)}</td>
                      <td>{formatNumber(campaignTotals.clicks)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </article>
            <div className="report-ad-gallery">
              {reportAdImages.length ? (
                reportAdImages.map((image) => {
                  const imageKey = image.label === '트래픽' ? 'traffic' : image.label === '구매전환' ? 'purchase' : 'default'

                  return (
                    <article key={image.src} className={`report-panel report-panel--ad-image report-panel--ad-image--${imageKey}`}>
                      <div className="report-panel__body report-panel__body--ad">
                        <div className="report-ad-gallery__meta">
                          <span>AD SOURCE</span>
                          <h3>{image.label}</h3>
                        </div>
                        <div className={`report-ad-gallery__frame report-ad-gallery__frame--${imageKey}`}>
                          <img
                            className={`report-ad-gallery__image report-ad-gallery__image--${imageKey}`}
                            src={image.src}
                            alt={`${monthLabelKorean(currentRow.report_month)} ${image.label} 광고 이미지`}
                          />
                        </div>
                      </div>
                    </article>
                  )
                })
              ) : (
                <article className="report-panel report-panel--ad-empty">
                  <div className="report-panel__header">
                    <div>
                      <span>AD SOURCE</span>
                      <h3>이미지 준비 중</h3>
                    </div>
                  </div>
                  <p>해당 월 AD_source 이미지를 찾지 못했어.</p>
                </article>
              )}
            </div>
          </div>
        </div>

        <div className="report-page" ref={reportPage5Ref}>
          <div className="report-page__logo-corner">
            <img className="report-logo-image report-logo-image--corner" src={thekaryPointLogo} alt="Thekary Point logo" />
          </div>
          <div className="report-page__scale">
            <div className="report-page__header">
              <p>THEKARY POINT REPORT</p>
              <h2>{`${monthLabelKorean(currentRow.report_month)} NEXT PLAN`}</h2>
              <ReportStepNav active="next-plan" />
            </div>
            <div className="report-placeholder-panel report-placeholder-panel--wide">
              <strong>다음 액션 페이지 구성 예정</strong>
              <p>다음 단계에서 월간 실행 계획과 개선 과제를 정리할 수 있게 자리만 먼저 잡아뒀어.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
