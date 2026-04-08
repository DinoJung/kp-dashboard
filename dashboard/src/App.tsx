import { useEffect, useMemo, useState } from 'react'
import {
  BellRing,
  Coins,
  Download,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const sourceSheetUrl = import.meta.env.VITE_SOURCE_SHEET_URL as string | undefined

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
  if (value === null || value === undefined) return '-'
  return `${numberFormatter.format(Math.round(value * 100))}%`
}

function MetricCard({ title, value, delta, helper, accent, icon, valueSize = 'default' }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${accent}`}>
      <div className="metric-card__header">
        <span className="metric-card__icon">{icon}</span>
        <span className="metric-card__title">{title}</span>
      </div>
      <strong className={`metric-card__value metric-card__value--${valueSize}`}>{value}</strong>
      <p className="metric-card__delta">{delta}</p>
      <p className="metric-card__helper">{helper}</p>
    </article>
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

  useEffect(() => {
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
  }, [])

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

  const previousRow = useMemo(() => {
    if (!currentRow) return undefined
    const currentIndex = meaningfulOverview.findIndex((row) => row.report_month === currentRow.report_month)
    return currentIndex > 0 ? meaningfulOverview[currentIndex - 1] : undefined
  }, [currentRow, meaningfulOverview])

  const latestSixMonths = useMemo(() => meaningfulOverview.slice(-6), [meaningfulOverview])

  const promotionsForMonth = useMemo(
    () => data?.promotions.filter((row) => row.report_month === currentRow?.report_month) ?? [],
    [currentRow?.report_month, data?.promotions],
  )

  const campaignsForMonth = useMemo(
    () => data?.campaigns.filter((row) => row.report_month === currentRow?.report_month) ?? [],
    [currentRow?.report_month, data?.campaigns],
  )

  const currentAverageDau = useMemo(
    () => (currentRow ? monthlyAverageDau(data?.activityDaily ?? [], currentRow.report_month) : null),
    [currentRow, data?.activityDaily],
  )

  const previousAverageDau = useMemo(
    () => (previousRow ? monthlyAverageDau(data?.activityDaily ?? [], previousRow.report_month) : null),
    [previousRow, data?.activityDaily],
  )

  const currentMau = currentRow?.reported_mau ?? null
  const previousMau = previousRow?.reported_mau ?? null

  const currentIndex = currentRow
    ? meaningfulOverview.findIndex((row) => row.report_month === currentRow.report_month)
    : -1

  const cumulativeNetMembers = currentIndex >= 0
    ? meaningfulOverview.slice(0, currentIndex + 1).reduce((sum, row) => sum + (row.net_growth ?? 0), 0)
    : null

  const cumulativeAppDownloads = currentIndex >= 0
    ? meaningfulOverview.slice(0, currentIndex + 1).reduce((sum, row) => sum + (row.app_downloads ?? 0), 0)
    : null

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
          {sourceSheetUrl ? (
            <a className="primary-button" href={sourceSheetUrl} target="_blank" rel="noreferrer">
              원본 시트 열기
            </a>
          ) : (
            <span className="hint-chip">Google Sheets 링크 연결 대기</span>
          )}
        </div>
      </header>

      <section className="metrics-grid metrics-grid--seven">
        <MetricCard
          title="회원수"
          value={`${formatNumber(currentRow.new_members)}명`}
          delta={summarizeChange(currentRow.new_members, previousRow?.new_members, '명')}
          helper={`누적 가입자 ${achievementText(cumulativeNetMembers, MEMBER_TARGET_2026)}`}
          accent="slate"
          icon={<Users size={18} />}
        />
        <MetricCard
          title="앱다운로드"
          value={`${formatNumber(currentRow.app_downloads)}건`}
          delta={summarizeChange(currentRow.app_downloads, previousRow?.app_downloads, '건')}
          helper={`26Y KPI · ${achievementText(cumulativeAppDownloads, APP_DOWNLOAD_TARGET_2026)}`}
          accent="amber"
          icon={<Download size={18} />}
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
        <MetricCard
          title="수신동의수"
          value={currentRow.sms_opt_in_members || currentRow.push_opt_in_members ? `${formatNumber((currentRow.sms_opt_in_members ?? 0) + (currentRow.push_opt_in_members ?? 0))}명` : '연동 대기'}
          delta="Google Sheets opt-in 시트 연결 후 자동 계산"
          helper={`SMS ${formatNumber(currentRow.sms_opt_in_members)} / PUSH ${formatNumber(currentRow.push_opt_in_members)}`}
          accent="gray"
          icon={<BellRing size={18} />}
        />
      </section>

      <section className="content-grid">
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

        <article className="panel">
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
              <p className="panel__eyebrow">월별 비교</p>
              <h2>사용자 · 매출 요약 테이블</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>월</th>
                  <th>누적 회원수</th>
                  <th>신규회원</th>
                  <th>앱다운로드</th>
                  <th>MAU</th>
                  <th>포인트 연계매출</th>
                  <th>광고 기여매출</th>
                </tr>
              </thead>
              <tbody>
                {latestSixMonths.map((row) => (
                  <tr key={row.report_month} className={row.report_month === currentRow.report_month ? 'is-selected' : ''}>
                    <td>{monthLabel(row.report_month)}</td>
                    <td>{formatNumber(row.cumulative_conversion_eom)}</td>
                    <td>{formatNumber(row.new_members)}</td>
                    <td>{formatNumber(row.app_downloads)}</td>
                    <td>{formatNumber(row.reported_mau)}</td>
                    <td>{formatCurrency(row.linked_sales_amount)}</td>
                    <td>{formatCurrency(row.ad_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">선택 월 프로모션</p>
              <h2>포인트 지급 현황</h2>
            </div>
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
                {promotionsForMonth.map((row) => (
                  <tr key={`${row.report_month}-${row.promotion_type}-${row.point_amount}-${row.total_points_issued}`}>
                    <td>{row.promotion_type}</td>
                    <td>{formatNumber(row.participant_count)}</td>
                    <td>{row.point_amount ? `${formatNumber(row.point_amount)}P` : '-'}</td>
                    <td>{row.total_points_issued ? `${formatNumber(row.total_points_issued)}P` : '-'}</td>
                  </tr>
                ))}
              </tbody>
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
          <div className="chart-wrap chart-wrap--compact">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={campaignsForMonth.map((row) => ({
                  name: row.placement_name ?? '기타',
                  광고비: row.ad_spend_markup_vat_exclusive ?? 0,
                  광고매출: row.revenue ?? 0,
                }))}
                margin={{ top: 8, right: 24, left: 12, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickMargin={8} />
                <YAxis width={76} tick={{ fontSize: 12 }} tickFormatter={(value) => numberFormatter.format(Number(value ?? 0))} />
                <Tooltip formatter={(value) => currencyFormatter.format(Number(value ?? 0))} />
                <Legend />
                <Bar dataKey="광고비" fill="#0f172a" radius={[8, 8, 0, 0]} />
                <Bar dataKey="광고매출" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-wrap">
            <table>
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
                  <tr key={`${row.report_month}-${row.placement_name}-${row.campaign_goal}`}> 
                    <td>{row.placement_name ?? '-'}</td>
                    <td>{formatCurrency(row.ad_spend_markup_vat_exclusive)}</td>
                    <td>{formatCurrency(row.revenue)}</td>
                    <td>{formatRoasPercent(row.roas_markup_vat_exclusive)}</td>
                    <td>{formatRatio(row.ctr)}</td>
                    <td>{formatNumber(row.impressions)}</td>
                    <td>{formatNumber(row.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  )
}

export default App
