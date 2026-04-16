import { useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import PptxGenJS from 'pptxgenjs'
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
import thekaryPointLogo from '../../../assets/thekary-point-logo-reference.jpg'
import { generateEditableReportPpt } from '../../pptEditableReport'

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

type InsightContent = {
  status: 'collecting' | 'ready'
  collectedThrough: string | null
  resultAnalysis: string[]
  improvementPlan: string[]
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

type ReportExportMode = 'pdf' | 'ppt' | 'ppt2'

const MEMBER_TARGET_2026 = 280_000
const APP_DOWNLOAD_TARGET_2026 = 130_000

const DASHBOARD_PASSWORD = 'thekary'
const DASHBOARD_AUTH_KEY = 'thekary-dashboard-authenticated'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const sourceSheetUrl = import.meta.env.VITE_SOURCE_SHEET_URL as string | undefined

const REPORT_STEPS = [
  { key: 'summary', label: 'SUMMARY' },
  { key: 'exposure', label: 'EXPOSURE' },
  { key: 'ad', label: 'AD' },
  { key: 'next-plan', label: 'NEXT PLAN' },
] as const

const REPORT_AD_IMAGES: Record<string, Array<{ label: string; images: string[] }>> = {
  '2026-01': [
    { label: '트래픽', images: ['/report-ad/2026-01-traffic-1.jpg', '/report-ad/2026-01-traffic-2.jpg'] },
    { label: '구매전환', images: ['/report-ad/2026-01-purchase-1.jpg', '/report-ad/2026-01-purchase-2.jpg'] },
  ],
  '2026-02': [
    { label: '트래픽', images: ['/report-ad/2026-02-traffic-1.jpg', '/report-ad/2026-02-traffic-2.jpg'] },
    { label: '구매전환', images: ['/report-ad/2026-02-purchase-1.jpg', '/report-ad/2026-02-purchase-2.jpg'] },
  ],
  '2026-03': [
    { label: '트래픽', images: ['/report-ad/2026-03-traffic-1.jpg', '/report-ad/2026-03-traffic-2.jpg'] },
    { label: '구매전환', images: ['/report-ad/2026-03-purchase-1.jpg', '/report-ad/2026-03-purchase-2.jpg'] },
  ],
  '2026-04': [
    { label: '트래픽', images: ['/report-ad/2026-04-traffic-1.jpg', '/report-ad/2026-04-traffic-2.jpg'] },
    { label: '구매전환', images: ['/report-ad/2026-04-purchase-1.jpg', '/report-ad/2026-04-purchase-2.jpg'] },
  ],
}

const MONTHLY_INSIGHT_OVERRIDES: Record<string, Pick<InsightContent, 'resultAnalysis' | 'improvementPlan'>> = {
  '2026-03': {
    resultAnalysis: [
      '봄피크닉 및 앱 다운로드 프로모션을 바탕으로 신규가입 5,825명, 앱다운로드 2,123건을 확보하며 전월 대비 유입 규모가 확대되었습니다.',
      '프로모션 참여자는 2,719명, 총 지급 포인트는 893.9만P로 운영 규모는 커졌지만 사용률은 31.1%로 전월 대비 하락해 적립 이후 사용 전환 관리가 추가로 필요합니다.',
      'META 캠페인은 광고비 154.4만 원 수준을 유지한 가운데 CTR 3.49%, 광고 기여매출 1.05억 원, ROAS 67.7로 효율이 개선되었고 구매전환 캠페인이 성과를 주도했습니다.',
    ],
    improvementPlan: [
      '유입 이후 실제 포인트 사용까지 이어질 수 있도록 적립 직후 사용처 안내와 혜택 소진 유도 메시지를 강화합니다.',
      'META는 구매전환 중심 운영 기조를 유지하되 트래픽 캠페인은 도달·리마케팅 역할을 분리해 반복 노출을 관리하고 효율 저하를 방지합니다.',
    ],
  },
}

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

const numberFormatter = new Intl.NumberFormat('ko-KR')
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

function nextMonthLabel(value: string) {
  const [yearText, monthText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const next = new Date(year, month, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function getFirstBusinessDayLabel(value: string) {
  const [yearText, monthText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  let day = 1

  while (true) {
    const date = new Date(year, month - 1, day)
    const weekday = date.getDay()
    if (weekday !== 0 && weekday !== 6) {
      const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토']
      return `${month}/${day}(${weekdayLabels[weekday]})`
    }
    day += 1
  }
}

function getKoreanHolidaySet(monthKey: string) {
  const holidaysByMonth: Record<string, number[]> = {
    '2026-01': [1],
    '2026-02': [16, 17, 18],
    '2026-03': [1, 2],
    '2026-05': [5],
    '2026-06': [6],
    '2026-08': [15],
    '2026-09': [24, 25, 26],
    '2026-10': [3, 9],
    '2026-12': [25],
  }

  return new Set(holidaysByMonth[monthKey] ?? [])
}

function buildMonthCalendar(value: string) {
  const [yearText, monthText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const firstDay = new Date(year, month - 1, 1)
  const lastDate = new Date(year, month, 0).getDate()
  const startWeekday = firstDay.getDay()
  const weeks: Array<Array<number | null>> = []
  const holidays = getKoreanHolidaySet(value)
  let currentWeek = Array.from({ length: 7 }, () => null as number | null)

  for (let day = 1; day <= lastDate; day += 1) {
    const weekday = (startWeekday + day - 1) % 7
    currentWeek[weekday] = day
    if (weekday === 6 || day === lastDate) {
      weeks.push(currentWeek)
      currentWeek = Array.from({ length: 7 }, () => null as number | null)
    }
  }

  return {
    monthKey: value,
    monthLabel: monthLabelKorean(value),
    weeks,
    holidays,
  }
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return numberFormatter.format(value)
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return `₩ ${numberFormatter.format(Math.round(value))}`
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

function getMonthLastDay(reportMonth: string) {
  const [yearText, monthText] = reportMonth.split('-')
  return new Date(Number(yearText), Number(monthText), 0).getDate()
}

function getLatestCollectedDate(rows: DailyMemberRow[], reportMonth: string) {
  const validRows = rows.filter((row) => {
    if (row.report_month !== reportMonth) return false
    return [row.member_count, row.app_downloads, row.withdrawals, row.cumulative_conversion, row.active_members].some(
      (value) => value !== null,
    ) || (row.net_growth !== null && row.net_growth !== 0)
  })

  if (!validRows.length) return null
  return validRows.reduce((latest, row) => (row.report_date > latest ? row.report_date : latest), validRows[0].report_date)
}

function isMonthEndInsightReady(rows: DailyMemberRow[], reportMonth: string) {
  const latestCollectedDate = getLatestCollectedDate(rows, reportMonth)
  if (!latestCollectedDate) return false
  return Number(latestCollectedDate.slice(8, 10)) === getMonthLastDay(reportMonth)
}

function formatCollectedThrough(dateText: string | null) {
  if (!dateText) return '데이터 수집중'
  const [, monthText, dayText] = dateText.split('-')
  return `${Number(monthText)}월 ${Number(dayText)}일 기준`
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

export default function ThekaryPointDashboard() {
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
  const [reportExportMode, setReportExportMode] = useState<ReportExportMode>('pdf')
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
        points_used: row.points_used,
        point_usage_rate: row.point_usage_rate,
        point_display: row.point_amount ? `${formatNumber(row.point_amount)}P` : '-',
        displayPromotionType: index === 0 || promotionsForMonth[index - 1]?.promotion_type !== row.promotion_type,
        key: `${row.report_month}-${row.promotion_type}-${row.point_amount}-${row.total_points_issued}`,
      })),
    [promotionsForMonth],
  )

  const collapsedPromotionRows = useMemo(() => {
    const groupedRows = new Map<string, {
      promotion_type: string
      participant_count: number
      total_points_issued: number
      points_used: number
      min_point: number | null
      max_point: number | null
      key: string
    }>()

    promotionsForMonth.forEach((row) => {
      const existing = groupedRows.get(row.promotion_type)
      const pointAmount = row.point_amount ?? null
      if (existing) {
        existing.participant_count += row.participant_count ?? 0
        existing.total_points_issued += row.total_points_issued ?? 0
        existing.points_used += row.points_used ?? 0
        existing.min_point = pointAmount === null ? existing.min_point : existing.min_point === null ? pointAmount : Math.min(existing.min_point, pointAmount)
        existing.max_point = pointAmount === null ? existing.max_point : existing.max_point === null ? pointAmount : Math.max(existing.max_point, pointAmount)
      } else {
        groupedRows.set(row.promotion_type, {
          promotion_type: row.promotion_type,
          participant_count: row.participant_count ?? 0,
          total_points_issued: row.total_points_issued ?? 0,
          points_used: row.points_used ?? 0,
          min_point: pointAmount,
          max_point: pointAmount,
          key: `${row.report_month}-${row.promotion_type}`,
        })
      }
    })

    return Array.from(groupedRows.values()).map((row) => ({
      ...row,
      point_usage_rate: row.total_points_issued > 0 ? row.points_used / row.total_points_issued : null,
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
    () => {
      const participantCount = promotionsForMonth.reduce((sum, row) => sum + (row.participant_count ?? 0), 0)
      const totalPointsIssued = promotionsForMonth.reduce((sum, row) => sum + (row.total_points_issued ?? 0), 0)
      const pointsUsed = promotionsForMonth.reduce((sum, row) => sum + (row.points_used ?? 0), 0)
      return {
        participantCount,
        totalPointsIssued,
        pointsUsed,
        pointUsageRate: totalPointsIssued > 0 ? pointsUsed / totalPointsIssued : null,
      }
    },
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
  const nextPlanCalendar = currentRow ? buildMonthCalendar(nextMonthLabel(currentRow.report_month)) : null
  const exposureFirstBusinessDay = currentRow ? getFirstBusinessDayLabel(currentRow.report_month) : ''
  const calendarWeekdays = ['일', '월', '화', '수', '목', '금', '토']

  function renderWeeklySchedulePlaceholder(weekIndex: number) {
    if (weekIndex === 0) {
      return (
        <div className="report-weekly-placeholder report-weekly-placeholder--start" aria-hidden="true">
          <div className="report-weekly-placeholder__row">
            <div className="report-weekly-placeholder__chip report-weekly-placeholder__chip--blue"><span>&nbsp;</span></div>
            <div className="report-weekly-placeholder__arrow report-weekly-placeholder__arrow--blue" />
          </div>
          <div className="report-weekly-placeholder__row">
            <div className="report-weekly-placeholder__chip report-weekly-placeholder__chip--green"><span>&nbsp;</span></div>
            <div className="report-weekly-placeholder__arrow report-weekly-placeholder__arrow--green" />
          </div>
          <div className="report-weekly-placeholder__row">
            <div className="report-weekly-placeholder__chip report-weekly-placeholder__chip--orange"><span>&nbsp;</span></div>
            <div className="report-weekly-placeholder__arrow report-weekly-placeholder__arrow--orange" />
          </div>
        </div>
      )
    }

    if (weekIndex === 3) {
      return (
        <div className="report-weekly-placeholder report-weekly-placeholder--note" aria-hidden="true">
          <div className="report-weekly-placeholder__note"><span>&nbsp;</span></div>
        </div>
      )
    }

    if (weekIndex === 4) {
      return (
        <div className="report-weekly-placeholder report-weekly-placeholder--end" aria-hidden="true">
          <div className="report-weekly-placeholder__row report-weekly-placeholder__row--reverse">
            <div className="report-weekly-placeholder__arrow report-weekly-placeholder__arrow--blue report-weekly-placeholder__arrow--left" />
            <div className="report-weekly-placeholder__chip report-weekly-placeholder__chip--blue"><span>&nbsp;</span></div>
          </div>
          <div className="report-weekly-placeholder__row report-weekly-placeholder__row--reverse">
            <div className="report-weekly-placeholder__arrow report-weekly-placeholder__arrow--green report-weekly-placeholder__arrow--left" />
            <div className="report-weekly-placeholder__chip report-weekly-placeholder__chip--green"><span>&nbsp;</span></div>
          </div>
          <div className="report-weekly-placeholder__row report-weekly-placeholder__row--reverse">
            <div className="report-weekly-placeholder__arrow report-weekly-placeholder__arrow--orange report-weekly-placeholder__arrow--left" />
            <div className="report-weekly-placeholder__chip report-weekly-placeholder__chip--orange"><span>&nbsp;</span></div>
          </div>
        </div>
      )
    }

    return null
  }

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

  const insightContent = useMemo<InsightContent>(() => {
    if (!currentRow) {
      return {
        status: 'collecting',
        collectedThrough: null,
        resultAnalysis: [],
        improvementPlan: [],
      }
    }

    const monthKey = monthLabel(currentRow.report_month)
    const memberDailyRows = data?.memberDaily ?? []
    const collectedThrough = getLatestCollectedDate(memberDailyRows, currentRow.report_month)

    if (!isMonthEndInsightReady(memberDailyRows, currentRow.report_month)) {
      return {
        status: 'collecting',
        collectedThrough,
        resultAnalysis: [],
        improvementPlan: [],
      }
    }

    const override = MONTHLY_INSIGHT_OVERRIDES[monthKey]
    if (override) {
      return {
        status: 'ready',
        collectedThrough,
        resultAnalysis: override.resultAnalysis,
        improvementPlan: override.improvementPlan,
      }
    }

    const resultAnalysis = [
      `신규가입 ${formatNumber(currentRow.new_members)}명, 앱다운로드 ${formatNumber(currentRow.app_downloads)}건으로 유입 흐름을 확인했으며 각각 ${summarizeChange(currentRow.new_members, previousRow?.new_members, '명')}, ${summarizeChange(currentRow.app_downloads, previousRow?.app_downloads, '건')}입니다.`,
      `포인트 운영은 참여자 ${formatNumber(currentRow.event_participant_count)}명, 총 지급 ${formatNumber(currentRow.total_points_issued)}P, 사용률 ${formatRatio(currentRow.point_usage_rate)} 기준으로 집계되었습니다.`,
      `광고 성과는 광고 기여매출 ${formatCurrency(currentRow.ad_revenue)}, 광고비 ${formatCurrency(currentRow.ad_spend_markup_vat_exclusive)}, ROAS ${formatRoasPercent(currentRow.roas_markup_vat_exclusive)}이며 DAU는 월평균 ${currentAverageDau ? `${formatNumber(currentAverageDau)}명` : '집계 없음'}입니다.`,
    ]

    const improvementPlan = [
      '유입 이후 실제 포인트 사용과 구매 전환까지 이어질 수 있도록 적립 직후 사용 유도 메시지와 랜딩 동선을 함께 점검합니다.',
      campaignsForMonth.some((row) => (row.placement_name ?? '').includes('TR'))
        ? '광고는 구매전환 캠페인을 중심으로 유지하고 트래픽 캠페인은 도달·리마케팅 역할을 분리해 반복 노출을 관리합니다.'
        : '광고는 성과가 확인된 캠페인 구조를 유지하되 예산 변동 시 전환 효율이 먼저 흔들리지 않도록 우선순위를 관리합니다.',
    ]

    return {
      status: 'ready',
      collectedThrough,
      resultAnalysis,
      improvementPlan,
    }
  }, [campaignsForMonth, currentAverageDau, currentRow, data?.memberDaily, previousRow])

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
    const insightRow = document.createElement('div')
    const analysisCard = document.createElement('section')
    const improvementCard = document.createElement('section')
    const arrow = document.createElement('div')
    const analysisTitle = document.createElement('div')
    const improvementTitle = document.createElement('div')
    const analysisBox = document.createElement('div')
    const improvementBox = document.createElement('div')

    metricsClone.classList.add('report-dom-clone__metrics')
    summaryClone.classList.add('report-dom-clone__panel', 'report-dom-clone__panel--summary')
    promotionClone.classList.add('report-dom-clone__panel', 'report-dom-clone__panel--promotion')
    bottomRow.className = 'report-dashboard-clone__bottom'
    insightRow.className = 'report-dashboard-clone__insight-flow'
    analysisCard.className = 'report-dashboard-clone__insight-card'
    improvementCard.className = 'report-dashboard-clone__insight-card'
    arrow.className = 'report-dashboard-clone__insight-arrow'
    arrow.setAttribute('aria-hidden', 'true')
    arrow.textContent = '→'
    analysisTitle.className = 'report-dashboard-clone__insight-title'
    analysisTitle.textContent = '결과 분석'
    improvementTitle.className = 'report-dashboard-clone__insight-title'
    improvementTitle.textContent = '개선안'
    analysisBox.className = 'report-dashboard-clone__insight-box'
    analysisBox.textContent = '분석을 입력해주세요.'
    improvementBox.className = 'report-dashboard-clone__insight-box'
    improvementBox.textContent = '개선안을 입력해주세요.'

    promotionClone.querySelectorAll('.icon-toggle-button').forEach((node) => node.remove())

    analysisCard.append(analysisTitle, analysisBox)
    improvementCard.append(improvementTitle, improvementBox)
    insightRow.append(analysisCard, arrow, improvementCard)
    bottomRow.append(summaryClone, promotionClone)
    mount.append(metricsClone, bottomRow, insightRow)
  }

  async function handleGenerateReport(mode: ReportExportMode) {
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

      const refs = [reportPage1Ref, reportPage2Ref, reportPage3Ref, reportPage4Ref, reportPage5Ref]
      const images: string[] = []

      for (const ref of refs) {
        images.push(await captureReportPage(ref.current))
      }

      if (mode === 'pdf') {
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080] })
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const margin = 0

        for (const [index, imageData] of images.entries()) {
          if (index > 0) pdf.addPage()
          pdf.addImage(imageData, 'JPEG', margin, margin, pageWidth - margin * 2, pageHeight - margin * 2)
        }

        pdf.save(`thekary-point-report-${monthLabel(currentRow.report_month)}.pdf`)
        return
      }

      if (mode === 'ppt') {
        const pptx = new PptxGenJS()
        pptx.layout = 'LAYOUT_WIDE'
        pptx.author = 'Hermes'
        pptx.company = 'Thekary'
        pptx.subject = `Thekary Point ${monthLabel(currentRow.report_month)} report`
        pptx.title = `Thekary Point Report ${monthLabel(currentRow.report_month)}`

        images.forEach((imageData) => {
          const slide = pptx.addSlide()
          slide.background = { color: 'FFFFFF' }
          slide.addImage({ data: imageData, x: 0, y: 0, w: 13.333, h: 7.5 })
        })

        await pptx.writeFile({ fileName: `thekary-point-report-${monthLabel(currentRow.report_month)}.pptx` })
        return
      }

      await generateEditableReportPpt({
        reportMonthKey: monthLabel(currentRow.report_month),
        monthLabelKorean: monthLabelKorean(currentRow.report_month),
        monthEndLabel: monthEndLabel(currentRow.report_month),
        exposureFirstBusinessDay,
        logoSrc: thekaryPointLogo,
        coverTitle: `${monthLabel(currentRow.report_month).slice(5).replace('-', '')}월 운영 결과 보고서`,
        resultMetricCards: [
          {
            title: '회원수',
            value: `${formatNumber(currentRow.new_members)}명`,
            delta: `누적 ${formatNumber(cumulativeNetMembers)} (${memberKpiRatio})`,
            helper: `26Y KPI ${formatNumber(MEMBER_TARGET_2026)}`,
            accent: '94A3B8',
          },
          {
            title: '앱다운로드',
            value: `${formatNumber(currentRow.app_downloads)}건`,
            delta: `누적 ${formatNumber(cumulativeAppDownloads)} (${appDownloadKpiRatio})`,
            helper: `26Y KPI ${formatNumber(APP_DOWNLOAD_TARGET_2026)}`,
            accent: 'F59E0B',
          },
          {
            title: '수신동의수',
            value: currentOptInCount !== null ? `${formatNumber(currentOptInCount)}건` : '연동 대기',
            delta: `누적 ${formatNumber(cumulativeOptInCount)}건`,
            helper: '',
            accent: '9CA3AF',
          },
          {
            title: '포인트 연계매출',
            value: formatCurrency(currentRow.linked_sales_amount),
            delta: summarizePercentChange(currentRow.linked_sales_amount, previousRow?.linked_sales_amount),
            helper: `포인트 사용률 ${formatRatio(currentRow.point_usage_rate)}`,
            accent: '10B981',
          },
          {
            title: '광고 기여매출',
            value: formatCurrency(currentRow.ad_revenue),
            delta: summarizePercentChange(currentRow.ad_revenue, previousRow?.ad_revenue),
            helper: `ROAS ${formatRoasPercent(currentRow.roas_markup_vat_exclusive)}`,
            accent: '8B5CF6',
          },
          {
            title: 'MAU',
            value: currentMau ? `${formatNumber(currentMau)}명` : '집계 없음',
            delta: summarizeChange(currentMau, previousMau, '명'),
            helper: currentMau ? '' : '월별 MAU 데이터 없음',
            accent: '0EA5E9',
          },
          {
            title: 'DAU',
            value: currentAverageDau ? `${formatNumber(currentAverageDau)}명` : '집계 없음',
            delta: summarizeChange(currentAverageDau, previousAverageDau, '명'),
            helper: currentAverageDau ? '월평균 기준' : '2026-02-24 이전 데이터 없음',
            accent: 'F43F5E',
          },
        ],
        sixMonthTableRows: [
          ['월', '회원수', '앱다운로드', '수신동의수', '포인트 연계매출', '광고 기여매출', 'MAU', 'DAU'],
          ...sixMonthRows.slice().reverse().map((row) => [
            monthLabel(row.report_month),
            formatNumber(row.new_members),
            formatNumber(row.app_downloads),
            formatNumber(row.opt_in_count),
            formatCurrency(row.linked_sales_amount),
            formatCurrency(row.ad_revenue),
            formatNumber(row.reported_mau),
            formatNumber(row.average_dau),
          ]),
        ],
        promotionRows: [
          ['프로모션', '지급 인원', '지급 포인트', '총 지급 포인트', '사용포인트', '사용률'],
          ...collapsedPromotionRows.map((row) => [
            row.promotion_type,
            formatNumber(row.participant_count),
            row.point_display,
            row.total_points_issued ? `${formatNumber(row.total_points_issued)}P` : '-',
            row.points_used ? `${formatNumber(row.points_used)}P` : '-',
            formatRatio(row.point_usage_rate),
          ]),
          [
            'Total',
            formatNumber(promotionTotals.participantCount),
            '-',
            `${formatNumber(promotionTotals.totalPointsIssued)}P`,
            `${formatNumber(promotionTotals.pointsUsed)}P`,
            formatRatio(promotionTotals.pointUsageRate),
          ],
        ],
        adMetricCards: [
          { title: '광고비(마크업, vat-)', value: formatCurrency(campaignTotals.adSpend), accent: 'F59E0B' },
          { title: '노출수', value: formatNumber(campaignTotals.impressions), accent: '64748B' },
          { title: '클릭수', value: formatNumber(campaignTotals.clicks), accent: '10B981' },
          { title: 'CTR', value: formatRatio(campaignTotals.ctr), accent: '9CA3AF' },
          { title: 'ROAS', value: formatRoasPercent(campaignTotals.roas), accent: '8B5CF6' },
        ],
        campaignRows: [
          ['캠페인', '광고비', '광고 기여매출', 'ROAS', 'CTR', '노출', '클릭'],
          ...campaignsForMonth.map((row) => [
            formatCampaignLabel(row.placement_name),
            formatNullableCurrency(row.ad_spend_markup_vat_exclusive),
            formatNullableCurrency(row.revenue),
            formatRoasPercent(row.roas_markup_vat_exclusive),
            formatNullableRatio(row.ctr),
            formatNullableNumber(row.impressions),
            formatNullableNumber(row.clicks),
          ]),
          [
            'Total',
            formatCurrency(campaignTotals.adSpend),
            formatCurrency(campaignTotals.revenue),
            formatRoasPercent(campaignTotals.roas),
            formatRatio(campaignTotals.ctr),
            formatNumber(campaignTotals.impressions),
            formatNumber(campaignTotals.clicks),
          ],
        ],
        adSourceCards: reportAdImages,
        nextPlanCalendar,
        calendarWeekdays,
      })
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
                <button
                  className="settings-menu__item"
                  type="button"
                  onClick={() => {
                    setReportExportMode('pdf')
                    setIsReportConfirmOpen(true)
                  }}
                >
                  <FileText size={16} /> {isGeneratingReport && reportExportMode === 'pdf' ? 'PDF 리포트 생성 중…' : 'PDF 리포트 생성'}
                </button>
                <button
                  className="settings-menu__item"
                  type="button"
                  onClick={() => {
                    setReportExportMode('ppt2')
                    setIsReportConfirmOpen(true)
                  }}
                >
                  <FileText size={16} /> {isGeneratingReport && reportExportMode === 'ppt2' ? 'PPT 리포트 생성 중…' : 'PPT 리포트 생성'}
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
          delta={`누적 ${formatNumber(cumulativeNetMembers)} (${memberKpiRatio})`}
          helper={`26Y KPI ${formatNumber(MEMBER_TARGET_2026)}`}
          accent="slate"
          icon={<Users size={18} />}
        />
        <MetricCard
          title="앱다운로드"
          value={`${formatNumber(currentRow.app_downloads)}건`}
          delta={`누적 ${formatNumber(cumulativeAppDownloads)} (${appDownloadKpiRatio})`}
          helper={`26Y KPI ${formatNumber(APP_DOWNLOAD_TARGET_2026)}`}
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
                  <th>총 지급 포인트</th>
                  <th>사용포인트</th>
                  <th>사용률</th>
                </tr>
              </thead>
              <tbody>
                {promotionTableRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.displayPromotionType ? row.promotion_type : ''}</td>
                    <td>{formatNumber(row.participant_count)}</td>
                    <td>{row.point_display}</td>
                    <td>{row.total_points_issued ? `${formatNumber(row.total_points_issued)}P` : '-'}</td>
                    <td>{row.points_used ? `${formatNumber(row.points_used)}P` : '-'}</td>
                    <td>{formatRatio(row.point_usage_rate)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{formatNumber(promotionTotals.participantCount)}</td>
                  <td>-</td>
                  <td>{`${formatNumber(promotionTotals.totalPointsIssued)}P`}</td>
                  <td>{`${formatNumber(promotionTotals.pointsUsed)}P`}</td>
                  <td>{formatRatio(promotionTotals.pointUsageRate)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>

        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">광고상세</p>
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
              <p className="panel__eyebrow">월 마감 요약</p>
              <h2>결과 인사이트</h2>
            </div>
          </div>
          {insightContent.status === 'collecting' ? (
            <div className="insight-empty-state">
              <strong>데이터 수집중</strong>
              <p>
                {monthLabelKorean(currentRow.report_month)} 결과 인사이트는 말일 데이터가 모두 채워진 뒤 업데이트됩니다.
                현재 반영 기준은 {formatCollectedThrough(insightContent.collectedThrough)}입니다.
              </p>
            </div>
          ) : (
            <div className="insight-flow">
              <section className="insight-card">
                <div className="insight-card__title">결과 분석</div>
                <ul className="insight-list">
                  {insightContent.resultAnalysis.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              <div className="insight-flow__arrow" aria-hidden="true">→</div>
              <section className="insight-card">
                <div className="insight-card__title">개선안</div>
                <ul className="insight-list">
                  {insightContent.improvementPlan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          )}
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
            <h2>
              {reportExportMode === 'pdf'
                ? 'PDF 리포트 생성'
                : 'PPT 리포트 생성'}
            </h2>
            <p>
              {reportExportMode === 'pdf'
                ? `${monthLabelKorean(currentRow.report_month)} 기준 PDF 리포트를 생성합니다.`
                : `${monthLabelKorean(currentRow.report_month)} 기준 PPT 리포트를 생성합니다.`}
            </p>
            <div className="confirm-modal__actions">
              <button className="ghost-button" type="button" onClick={() => setIsReportConfirmOpen(false)}>
                취소
              </button>
              <button className="primary-button" type="button" onClick={() => void handleGenerateReport(reportExportMode)}>
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
              <span className="report-cover__title-gray">더캐리포인트</span>
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
              <h2>{`${monthLabelKorean(currentRow.report_month)} RESULT`}</h2>
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
              <h2>{`${monthLabelKorean(currentRow.report_month)} 브랜드 사이트 팝업`}</h2>
              <ReportStepNav active="exposure" />
            </div>
            <section className="report-exposure-panel">
              <div className="report-exposure-panel__copy">
                <strong>{`더캐리포인트 가입 유도 팝업 | ${exposureFirstBusinessDay} 10:00`}</strong>
                <p>이벤트페이지(KP), 브랜드 홈페이지 메인홈(BP, BPU, IB, KR), 마이페이지(KR)</p>
              </div>
              <div className="report-exposure-panel__frame" />
            </section>
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
            <section className="report-ad-focus-grid" aria-label="AD 핵심 지표">
              <article className="metric-card metric-card--amber report-focus-card">
                <div className="metric-card__header">
                  <span className="metric-card__icon"><Coins size={18} /></span>
                  <span className="metric-card__title">광고비(마크업, vat-)</span>
                </div>
                <strong className="metric-card__value metric-card__value--compact">{formatCurrency(campaignTotals.adSpend)}</strong>
              </article>
              <article className="metric-card metric-card--slate report-focus-card">
                <div className="metric-card__header">
                  <span className="metric-card__icon"><Megaphone size={18} /></span>
                  <span className="metric-card__title">노출수</span>
                </div>
                <strong className="metric-card__value metric-card__value--compact">{formatNumber(campaignTotals.impressions)}</strong>
              </article>
              <article className="metric-card metric-card--emerald report-focus-card">
                <div className="metric-card__header">
                  <span className="metric-card__icon"><MousePointerClick size={18} /></span>
                  <span className="metric-card__title">클릭수</span>
                </div>
                <strong className="metric-card__value metric-card__value--compact">{formatNumber(campaignTotals.clicks)}</strong>
              </article>
              <article className="metric-card metric-card--gray report-focus-card">
                <div className="metric-card__header">
                  <span className="metric-card__icon"><RefreshCw size={18} /></span>
                  <span className="metric-card__title">CTR</span>
                </div>
                <strong className="metric-card__value metric-card__value--compact">{formatRatio(campaignTotals.ctr)}</strong>
              </article>
              <article className="metric-card metric-card--violet report-focus-card">
                <div className="metric-card__header">
                  <span className="metric-card__icon"><TrendingUp size={18} /></span>
                  <span className="metric-card__title">ROAS</span>
                </div>
                <strong className="metric-card__value metric-card__value--compact">{formatRoasPercent(campaignTotals.roas)}</strong>
              </article>
            </section>
            <article className="report-panel report-panel--ad-table">
              <div className="report-panel__header">
                <div>
                  <span>광고상세</span>
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
                    <article key={image.label} className={`report-panel report-panel--ad-image report-panel--ad-image--${imageKey}`}>
                      <div className="report-panel__body report-panel__body--ad">
                        <div className="report-ad-gallery__meta">
                          <span>AD SOURCE</span>
                          <h3>{image.label}</h3>
                        </div>
                        <div className={`report-ad-gallery__frame report-ad-gallery__frame--${imageKey}`}>
                          <div className="report-ad-gallery__pair">
                            {image.images.map((src, index) => (
                              <div key={src} className={`report-ad-gallery__slot report-ad-gallery__slot--${index === 0 ? 'primary' : 'secondary'}`}>
                                <img
                                  className={`report-ad-gallery__image report-ad-gallery__image--${imageKey}`}
                                  src={src}
                                  alt={`${monthLabelKorean(currentRow.report_month)} ${image.label} 광고 이미지 ${index + 1}`}
                                />
                              </div>
                            ))}
                          </div>
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
            <section className="report-next-plan-layout">
              <article className="report-panel report-next-plan-board">
                <div className="report-panel__header">
                  <div>
                    <span>다음달 일정</span>
                    <h3>{nextPlanCalendar ? `${nextPlanCalendar.monthLabel} 캘린더` : '캘린더 준비 중'}</h3>
                  </div>
                </div>
                {nextPlanCalendar ? (
                  <div className="report-calendar-board">
                    <div className="report-calendar-board__header">
                      {calendarWeekdays.map((weekday, index) => (
                        <span key={weekday} className={`report-calendar__weekday${index === 0 ? ' is-sunday' : ''}`}>{weekday}</span>
                      ))}
                      <span className="report-calendar__weekday report-calendar__weekday--weekly">주요일정</span>
                    </div>
                    <div className="report-calendar-board__body">
                      {nextPlanCalendar.weeks.map((week, weekIndex) => (
                        <div key={`${nextPlanCalendar.monthKey}-week-${weekIndex}`} className="report-calendar__week-row">
                          {week.map((day, dayIndex) => {
                            const isHoliday = day !== null && nextPlanCalendar.holidays.has(day)
                            const isSunday = dayIndex === 0
                            return (
                              <div
                                key={`${nextPlanCalendar.monthKey}-${weekIndex}-${dayIndex}`}
                                className={`report-calendar__cell${day === null ? ' is-empty' : ''}`}
                              >
                                {day !== null ? <span className={`report-calendar__date${isSunday || isHoliday ? ' is-holiday' : ''}`}>{day}</span> : null}
                              </div>
                            )
                          })}
                          <div className="report-weekly-item">{renderWeeklySchedulePlaceholder(weekIndex)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

