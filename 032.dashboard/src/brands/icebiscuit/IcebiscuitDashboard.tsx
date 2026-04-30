import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Coins, Download, Megaphone, MousePointerClick, ShoppingBag, Target, TrendingUp, Users } from 'lucide-react'
import { getDashboardLoadErrorMessage, supabase } from '../../lib/supabase'
import { buildPresetRange, clampDateRange, presetLabel, type DateRangePreset } from './datePresets'
import { MIN_SELECTABLE_DATE, clampToSelectableDate, shouldApplyDateRangeOnBlur, shouldApplyDateRangeOnKey } from './filterControls'
import {
  aggregateCampaignCreativeRowsForRange,
  aggregateCampaignRowsForRange,
  aggregateCreativeRowsForRange,
  aggregateMetrics,
  campaignSortRank,
  formatCampaignName,
  hasBoundaryCoverage,
  pickMetricsForCampaignCards,
  washCreativeName,
  type AggregatedCreativeRow as MetaAggregatedCreativeRow,
} from './metaRange'
import {
  buildSummaryRows,
  cycleColumnSort,
  formatSummaryDelta,
  sortMetricRows,
  type SortableMetricKey,
  type SummaryGranularity,
  type SummaryRow as DisplaySummaryRow,
  type SummarySortState,
} from './summaryTable'

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

type IcebiscuitDailyCreativeRow = {
  report_date: string
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
  dailyCreatives: IcebiscuitDailyCreativeRow[]
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

type CampaignSortRow = {
  label: string
  campaign_name: string
  impressions: number
  clicks: number
  ctr: number | null
  ad_spend: number
  purchase_count: number
  purchase_value: number
  purchase_rate: number | null
  roas: number | null
}

type CreativeSortRow = {
  label: string
  campaign_group: string
  ad_key: string
  ad_name: string
  impressions: number
  clicks: number
  ctr: number | null
  ad_spend: number
  purchase_count: number
  purchase_value: number
  purchase_rate: number | null
  roas: number | null
}

type AggregateMetrics = {
  impressions: number
  clicks: number
  adSpend: number
  purchaseCount: number
  purchaseValue: number
}

type AggregatedCreativeRow = MetaAggregatedCreativeRow

type SummaryRow = DisplaySummaryRow

type ExcelCellValue = string | number | null | undefined

type ExcelCell = {
  value: ExcelCellValue
  format?: string
}

type ExcelSheet = {
  name: string
  headers: string[]
  rows: ExcelCell[][]
}

const EXCEL_FORMATS = {
  count: '0"건"',
  integer: '#,##0',
  percent2: '0.00%',
  percent0: '0%',
  text: '@',
} as const

const campaignExportTypes = ['ASC', '리타겟팅', '전환(패션관심)', '참여 캠페인 / 게시물참여'] as const

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
const presets: DateRangePreset[] = ['this-week', 'last-week', 'this-month', 'last-month', 'same-month-last-year', 'previous-month-last-year']

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

function formatCampaignDisplayName(row: Pick<IcebiscuitCampaignRow, 'campaign_name' | 'objective'>) {
  const baseName = formatCampaignName(row.campaign_name)
  if (campaignSortRank(baseName) < 4) return baseName
  const objectiveLabel = formatObjectiveLabel(row.objective)
  if (objectiveLabel === '게시물참여') return `${baseName} / 게시물참여`
  return baseName
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

function excelCell(value: ExcelCellValue, format?: string): ExcelCell {
  return { value: value ?? '', format }
}

function escapeExcelHtml(value: ExcelCellValue) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeExcelAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function sanitizeSheetName(value: string) {
  return value.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Sheet1'
}

function serializeExcelWorkbook(sheets: ExcelSheet[]) {
  const worksheetHtml = sheets
    .map((sheet) => {
      const headers = sheet.headers.map((header) => `<th>${escapeExcelHtml(header)}</th>`).join('')
      const rows = sheet.rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => {
                const style = cell.format ? ` style="mso-number-format:'${escapeExcelAttribute(cell.format)}'"` : ''
                return `<td${style}>${escapeExcelHtml(cell.value)}</td>`
              })
              .join('')}</tr>`,
        )
        .join('')

      return `<h3>${escapeExcelHtml(sheet.name)}</h3><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table><br/>`
    })
    .join('')

  return `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>${sheets
    .map((sheet) => `<x:ExcelWorksheet><x:Name>${escapeExcelHtml(sanitizeSheetName(sheet.name))}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>`)
    .join('')}</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${worksheetHtml}</body></html>`
}

function downloadExcelWorkbook(filename: string, sheets: ExcelSheet[]) {
  const blob = new Blob([serializeExcelWorkbook(sheets)], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function normalizeExportCampaignGroup(value: string | null | undefined) {
  const label = formatCampaignName(value)
  if (label.includes('참여')) return '참여 캠페인 / 게시물참여'
  return label
}

function campaignGoalForExport(campaignGroup: string, adName?: string) {
  if (adName === '전월소재') return '전환'
  if (campaignGroup === 'ASC') return '전환_논타겟팅'
  if (campaignGroup === '리타겟팅') return '전환_리타겟팅'
  if (campaignGroup === '전환(패션관심)') return '전환_1849MF+관심사'
  if (campaignGroup.includes('참여')) return campaignGroup.includes('게시물') ? '게시물 참여' : '트래픽'
  return campaignGroup || '-'
}

function creativeNameForCampaignExport(campaignGroup: string, adName: string) {
  if (adName === '전월소재') return '전월소재'
  if (campaignGroup === '리타겟팅') return `RT_${adName}`
  if (campaignGroup.includes('참여')) return `TR_${adName}`
  return `CV_${adName}`
}

function renderSummaryMetric(valueText: string, deltaText: string, tone: 'up' | 'down' | 'flat') {
  return (
    <span className="icebiscuit-dashboard__summary-value">
      <span>{valueText}</span>
      <span className={`icebiscuit-dashboard__summary-delta icebiscuit-dashboard__summary-delta--${tone}`}>{deltaText}</span>
    </span>
  )
}

function sortIndicator(sortState: SummarySortState, key: SortableMetricKey) {
  if (!sortState || sortState.key !== key) return '↕'
  return sortState.direction === 'desc' ? '↓' : '↑'
}

function toCampaignSortRow(row: { campaign_name: string; impressions: number; clicks: number; ad_spend: number; purchase_count: number; purchase_value: number }): CampaignSortRow {
  return {
    label: row.campaign_name,
    campaign_name: row.campaign_name,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
    ad_spend: row.ad_spend,
    purchase_count: row.purchase_count,
    purchase_value: row.purchase_value,
    purchase_rate: row.clicks > 0 ? row.purchase_count / row.clicks : null,
    roas: row.ad_spend > 0 ? row.purchase_value / row.ad_spend : null,
  }
}

function toCreativeSortRow(row: AggregatedCreativeRow): CreativeSortRow {
  return {
    label: row.ad_name,
    campaign_group: row.campaign_group,
    ad_key: row.ad_key,
    ad_name: row.ad_name,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
    ad_spend: row.ad_spend,
    purchase_count: row.purchase_count,
    purchase_value: row.purchase_value,
    purchase_rate: row.clicks > 0 ? row.purchase_count / row.clicks : null,
    roas: row.ad_spend > 0 ? row.purchase_value / row.ad_spend : null,
  }
}

function toMetricsFromCreativeRows(rows: AggregatedCreativeRow[]): AggregateMetrics {
  return rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      adSpend: acc.adSpend + row.ad_spend,
      purchaseCount: acc.purchaseCount + row.purchase_count,
      purchaseValue: acc.purchaseValue + row.purchase_value,
    }),
    { impressions: 0, clicks: 0, adSpend: 0, purchaseCount: 0, purchaseValue: 0 },
  )
}

function emptyAggregateMetrics(): AggregateMetrics {
  return { impressions: 0, clicks: 0, adSpend: 0, purchaseCount: 0, purchaseValue: 0 }
}

function toMetricsFromDailyRows(rows: IcebiscuitDailyRow[]): AggregateMetrics {
  return aggregateMetrics(
    rows.map((row) => ({
      impressions: row.impressions,
      clicks: row.clicks,
      ad_spend: row.ad_spend,
      purchase_count: row.purchase_count,
      purchase_value: row.purchase_value,
    })),
  )
}

function toMetricsFromCreativeSortRows(rows: CreativeSortRow[]): AggregateMetrics {
  return rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      adSpend: acc.adSpend + row.ad_spend,
      purchaseCount: acc.purchaseCount + row.purchase_count,
      purchaseValue: acc.purchaseValue + row.purchase_value,
    }),
    emptyAggregateMetrics(),
  )
}

function toMetricsFromDailyTotalRows(rows: Array<{ impressions: number; clicks: number; adSpend: number; purchaseCount: number; purchaseValue: number }>): AggregateMetrics {
  return rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      adSpend: acc.adSpend + row.adSpend,
      purchaseCount: acc.purchaseCount + row.purchaseCount,
      purchaseValue: acc.purchaseValue + row.purchaseValue,
    }),
    emptyAggregateMetrics(),
  )
}

function toDailyTotalsByDate(rows: IcebiscuitDailyRow[]) {
  const grouped = new Map<string, AggregateMetrics>()

  rows.forEach((row) => {
    const current = grouped.get(row.report_date) ?? { impressions: 0, clicks: 0, adSpend: 0, purchaseCount: 0, purchaseValue: 0 }
    current.impressions += row.impressions ?? 0
    current.clicks += row.clicks ?? 0
    current.adSpend += row.ad_spend ?? 0
    current.purchaseCount += row.purchase_count ?? 0
    current.purchaseValue += row.purchase_value ?? 0
    grouped.set(row.report_date, current)
  })

  return Array.from(grouped.entries())
    .map(([reportDate, metrics]) => ({ reportDate, ...metrics }))
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate))
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

function monthKeyFromDate(value: string) {
  return value.slice(0, 7)
}

async function fetchIcebiscuitDashboardData() {
  if (!supabase) {
    throw new Error('Supabase env is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  const [overviewResult, campaignResult, dailyResult, creativeResult, dailyCreativeResult] = await Promise.all([
    supabase.from('dashboard_icebiscuit_monthly_overview').select('*').order('report_month', { ascending: false }),
    supabase.from('dashboard_icebiscuit_ad_campaign_breakdown').select('*').order('report_month', { ascending: false }),
    supabase.from('dashboard_icebiscuit_daily_breakdown').select('*').order('report_date', { ascending: false }),
    supabase.from('dashboard_icebiscuit_ad_creative_breakdown').select('*').order('report_month', { ascending: false }),
    supabase.from('dashboard_icebiscuit_daily_creative_breakdown').select('*').order('report_date', { ascending: false }),
  ])

  if (overviewResult.error) throw overviewResult.error
  if (campaignResult.error) throw campaignResult.error
  if (dailyResult.error) throw dailyResult.error
  if (creativeResult.error) throw creativeResult.error
  if (dailyCreativeResult.error) throw dailyCreativeResult.error

  return {
    overview: overviewResult.data as IcebiscuitOverviewRow[],
    campaigns: campaignResult.data as IcebiscuitCampaignRow[],
    daily: dailyResult.data as IcebiscuitDailyRow[],
    creatives: creativeResult.data as IcebiscuitCreativeRow[],
    dailyCreatives: dailyCreativeResult.data as IcebiscuitDailyCreativeRow[],
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
  const [appliedStartDate, setAppliedStartDate] = useState('')
  const [appliedEndDate, setAppliedEndDate] = useState('')
  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftEndDate, setDraftEndDate] = useState('')
  const [activePreset, setActivePreset] = useState<DateRangePreset | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('campaign')
  const [summaryGranularity, setSummaryGranularity] = useState<SummaryGranularity>('monthly')
  const [campaignSort, setCampaignSort] = useState<SummarySortState>(null)
  const [creativeSort, setCreativeSort] = useState<SummarySortState>(null)
  const [showCampaignCreatives, setShowCampaignCreatives] = useState(false)
  const [selectedCreativeKeys, setSelectedCreativeKeys] = useState<Set<string>>(() => new Set())
  const [selectedDailyDates, setSelectedDailyDates] = useState<Set<string>>(() => new Set())
  const didInitializeRange = useRef(false)

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
        if (!didInitializeRange.current && !appliedStartDate && !appliedEndDate) {
          if (latestDailyDate) {
            const latestDate = new Date(latestDailyDate)
            const range = {
              start: `${latestDailyDate.slice(0, 7)}-01`,
              end: toDateInputValue(latestDate),
            }
            didInitializeRange.current = true
            setAppliedStartDate(range.start)
            setAppliedEndDate(range.end)
            setDraftStartDate(range.start)
            setDraftEndDate(range.end)
          } else if (latestMonth) {
            const start = startOfMonthIso(latestMonth)
            const end = endOfMonthIso(latestMonth)
            didInitializeRange.current = true
            setAppliedStartDate(start)
            setAppliedEndDate(end)
            setDraftStartDate(start)
            setDraftEndDate(end)
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
  }, [appliedEndDate, appliedStartDate])

  const normalizedRange = useMemo(() => clampDateRange(appliedStartDate, appliedEndDate), [appliedEndDate, appliedStartDate])
  const normalizedDraftRange = useMemo(() => clampDateRange(draftStartDate, draftEndDate), [draftEndDate, draftStartDate])
  const hasPendingDateChange = normalizedDraftRange.start !== normalizedRange.start || normalizedDraftRange.end !== normalizedRange.end

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

  const orderedDailyCreatives = useMemo(
    () => (data?.dailyCreatives ?? []).slice().sort((a, b) => a.report_date.localeCompare(b.report_date)),
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

  const canUseExactCampaignRange = useMemo(
    () => Boolean(normalizedRange.start && normalizedRange.end && hasBoundaryCoverage(orderedDaily, normalizedRange)),
    [normalizedRange, orderedDaily],
  )

  const canUseExactCreativeRange = useMemo(
    () => Boolean(normalizedRange.start && normalizedRange.end && hasBoundaryCoverage(orderedDailyCreatives, normalizedRange)),
    [normalizedRange, orderedDailyCreatives],
  )

  const campaignTableRows = useMemo(() => {
    if (normalizedRange.start && normalizedRange.end && canUseExactCampaignRange) {
      return aggregateCampaignRowsForRange(orderedDaily, normalizedRange)
    }

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
  }, [canUseExactCampaignRange, filteredCampaigns, normalizedRange, orderedDaily])

  const campaignCreativeRows = useMemo(() => {
    if (normalizedRange.start && normalizedRange.end && canUseExactCreativeRange) {
      return aggregateCampaignCreativeRowsForRange(orderedDailyCreatives, normalizedRange)
    }

    const grouped = new Map<string, AggregatedCreativeRow>()

    filteredCreatives.forEach((row) => {
      const adName = washCreativeName(row.ad_name, row.report_month)
      const campaignGroup = formatCampaignName(row.campaign_group)
      const key = `${campaignGroup}::${adName}`
      const current = grouped.get(key) ?? {
        campaign_group: campaignGroup,
        ad_key: key,
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
      const nameDiff = a.ad_name.localeCompare(b.ad_name, 'ko')
      if (nameDiff !== 0) return nameDiff
      return campaignSortRank(a.campaign_group) - campaignSortRank(b.campaign_group)
    })
  }, [canUseExactCreativeRange, filteredCreatives, normalizedRange, orderedDailyCreatives])

  const creativeTableRows = useMemo(() => {
    if (normalizedRange.start && normalizedRange.end && canUseExactCreativeRange) {
      return aggregateCreativeRowsForRange(orderedDailyCreatives, normalizedRange)
    }

    const grouped = new Map<string, AggregatedCreativeRow>()

    filteredCreatives.forEach((row) => {
      const adName = washCreativeName(row.ad_name, row.report_month)
      const key = adName
      const current = grouped.get(key) ?? {
        campaign_group: '',
        ad_key: key,
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

    return Array.from(grouped.values()).sort((a, b) => a.ad_name.localeCompare(b.ad_name, 'ko'))
  }, [canUseExactCreativeRange, filteredCreatives, normalizedRange, orderedDailyCreatives])

  const campaignMetricRows = useMemo<CampaignSortRow[]>(() => campaignTableRows.map((row) => toCampaignSortRow(row)), [campaignTableRows])
  const sortedCampaignRows = useMemo(() => sortMetricRows(campaignMetricRows, campaignSort), [campaignMetricRows, campaignSort])

  const campaignCreativeMetricRows = useMemo<CreativeSortRow[]>(() => campaignCreativeRows.map((row) => toCreativeSortRow(row)), [campaignCreativeRows])
  const sortedCampaignCreativeRows = useMemo(
    () => sortMetricRows(campaignCreativeMetricRows, campaignSort),
    [campaignCreativeMetricRows, campaignSort],
  )

  const creativeMetricRows = useMemo<CreativeSortRow[]>(() => creativeTableRows.map((row) => toCreativeSortRow(row)), [creativeTableRows])
  const sortedCreativeRows = useMemo(() => sortMetricRows(creativeMetricRows, creativeSort), [creativeMetricRows, creativeSort])

  const creativeRowsByCampaign = useMemo(() => {
    const grouped = new Map<string, CreativeSortRow[]>()
    sortedCampaignCreativeRows.forEach((row) => {
      const current = grouped.get(row.campaign_group) ?? []
      current.push(row)
      grouped.set(row.campaign_group, current)
    })
    return grouped
  }, [sortedCampaignCreativeRows])

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

  const creativeTotals = useMemo(() => toMetricsFromCreativeRows(creativeTableRows), [creativeTableRows])
  const dailyRowsByDate = useMemo(() => toDailyTotalsByDate(filteredDaily), [filteredDaily])
  const dailyTotals = useMemo(() => toMetricsFromDailyRows(filteredDaily), [filteredDaily])
  const visibleCreativeKeys = useMemo(() => sortedCreativeRows.map((row) => row.ad_key), [sortedCreativeRows])
  const visibleDailyDates = useMemo(() => dailyRowsByDate.map((row) => row.reportDate), [dailyRowsByDate])
  const selectedCreativeRows = useMemo(
    () => sortedCreativeRows.filter((row) => selectedCreativeKeys.has(row.ad_key)),
    [selectedCreativeKeys, sortedCreativeRows],
  )
  const selectedDailyRows = useMemo(
    () => dailyRowsByDate.filter((row) => selectedDailyDates.has(row.reportDate)),
    [dailyRowsByDate, selectedDailyDates],
  )
  const selectedCreativeTotals = useMemo(() => toMetricsFromCreativeSortRows(selectedCreativeRows), [selectedCreativeRows])
  const selectedDailyTotals = useMemo(() => toMetricsFromDailyTotalRows(selectedDailyRows), [selectedDailyRows])
  const selectedCreativeCtr = selectedCreativeTotals.impressions > 0 ? selectedCreativeTotals.clicks / selectedCreativeTotals.impressions : null
  const selectedCreativeRoas = selectedCreativeTotals.adSpend > 0 ? selectedCreativeTotals.purchaseValue / selectedCreativeTotals.adSpend : null
  const selectedDailyCtr = selectedDailyTotals.impressions > 0 ? selectedDailyTotals.clicks / selectedDailyTotals.impressions : null
  const selectedDailyRoas = selectedDailyTotals.adSpend > 0 ? selectedDailyTotals.purchaseValue / selectedDailyTotals.adSpend : null
  const areAllVisibleCreativesSelected = visibleCreativeKeys.length > 0 && visibleCreativeKeys.every((key) => selectedCreativeKeys.has(key))
  const areAllVisibleDailyRowsSelected = visibleDailyDates.length > 0 && visibleDailyDates.every((date) => selectedDailyDates.has(date))
  const overviewTotals = useMemo(() => aggregateMetrics(filteredOverview), [filteredOverview])
  const campaignCardMetrics = useMemo(
    () =>
      normalizedRange.start && normalizedRange.end
        ? pickMetricsForCampaignCards({ dailyRows: orderedDaily, monthlyMetrics: overviewTotals, range: normalizedRange })
        : overviewTotals,
    [normalizedRange, orderedDaily, overviewTotals],
  )

  const activeMetrics = viewMode === 'daily' ? dailyTotals : viewMode === 'creative' ? creativeTotals : campaignCardMetrics
  const activeCtr = activeMetrics.impressions > 0 ? activeMetrics.clicks / activeMetrics.impressions : null
  const activeRoas = activeMetrics.adSpend > 0 ? activeMetrics.purchaseValue / activeMetrics.adSpend : null

  const summaryRows = useMemo<SummaryRow[]>(
    () =>
      buildSummaryRows({
        granularity: summaryGranularity,
        endDate: normalizedRange.end,
        overviewRows: orderedOverview,
        dailyRows: orderedDaily,
      }),
    [normalizedRange.end, orderedDaily, orderedOverview, summaryGranularity],
  )

  const activeTableTitle = '핵심 지표 요약'
  const activeTableEyebrow =
    summaryGranularity === 'weekly'
      ? normalizedRange.end
        ? `${normalizedRange.end} 종료일 기준 최근 6주`
        : '종료일 기준 최근 6주'
      : normalizedRange.end
        ? `${monthKeyFromDate(normalizedRange.end)} 종료월 기준 최근 6개월`
        : '종료월 기준 최근 6개월'
  const periodLabel = normalizedRange.start && normalizedRange.end ? `${normalizedRange.start} ~ ${normalizedRange.end}` : '기간 선택 필요'

  useEffect(() => {
    setSelectedCreativeKeys((current) => {
      const visible = new Set(visibleCreativeKeys)
      const next = new Set(Array.from(current).filter((key) => visible.has(key)))
      return next.size === current.size ? current : next
    })
  }, [visibleCreativeKeys])

  useEffect(() => {
    setSelectedDailyDates((current) => {
      const visible = new Set(visibleDailyDates)
      const next = new Set(Array.from(current).filter((date) => visible.has(date)))
      return next.size === current.size ? current : next
    })
  }, [visibleDailyDates])

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

  const handlePresetSelect = (value: string) => {
    if (!value) {
      setActivePreset(null)
      return
    }

    const preset = value as DateRangePreset
    const range = buildPresetRange(preset)
    const next = clampDateRange(clampToSelectableDate(range.start), clampToSelectableDate(range.end))
    setDraftStartDate(next.start)
    setDraftEndDate(next.end)
    setAppliedStartDate(next.start)
    setAppliedEndDate(next.end)
    setActivePreset(preset)
  }

  const handleStartDateChange = (value: string) => {
    const safeValue = clampToSelectableDate(value)
    const next = clampDateRange(safeValue, draftEndDate)
    setDraftStartDate(next.start)
    setDraftEndDate(next.end)
    setActivePreset(null)
  }

  const handleEndDateChange = (value: string) => {
    const safeValue = clampToSelectableDate(value)
    const next = clampDateRange(draftStartDate, safeValue)
    setDraftStartDate(next.start)
    setDraftEndDate(next.end)
    setActivePreset(null)
  }

  const handleApplyDateRange = () => {
    if (!normalizedDraftRange.start || !normalizedDraftRange.end) return
    setAppliedStartDate(normalizedDraftRange.start)
    setAppliedEndDate(normalizedDraftRange.end)
  }

  const handleDateKeyDown = (key: string) => {
    if (!shouldApplyDateRangeOnKey(key) || !hasPendingDateChange) return
    handleApplyDateRange()
  }

  const handleDateBlur = () => {
    if (!shouldApplyDateRangeOnBlur() || !hasPendingDateChange) return
    handleApplyDateRange()
  }

  const handleCampaignSort = (key: SortableMetricKey) => {
    setCampaignSort((current) => cycleColumnSort(current, key))
  }

  const handleCreativeSort = (key: SortableMetricKey) => {
    setCreativeSort((current) => cycleColumnSort(current, key))
  }

  const toggleCreativeSelection = (key: string) => {
    setSelectedCreativeKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleDailySelection = (date: string) => {
    setSelectedDailyDates((current) => {
      const next = new Set(current)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const toggleAllVisibleCreatives = () => {
    setSelectedCreativeKeys((current) => {
      const next = new Set(current)
      if (areAllVisibleCreativesSelected) {
        visibleCreativeKeys.forEach((key) => next.delete(key))
      } else {
        visibleCreativeKeys.forEach((key) => next.add(key))
      }
      return next
    })
  }

  const toggleAllVisibleDailyRows = () => {
    setSelectedDailyDates((current) => {
      const next = new Set(current)
      if (areAllVisibleDailyRowsSelected) {
        visibleDailyDates.forEach((date) => next.delete(date))
      } else {
        visibleDailyDates.forEach((date) => next.add(date))
      }
      return next
    })
  }

  const buildCampaignExpandedExportSheet = (): ExcelSheet => {
    const rows = campaignExportTypes.map((campaignGroup) => {
      const metrics = sortedCampaignRows.find((row) => normalizeExportCampaignGroup(row.campaign_name) === campaignGroup)
      const childRows = sortedCampaignCreativeRows.filter((row) => normalizeExportCampaignGroup(row.campaign_group) === campaignGroup)
      const adCount = childRows.filter((row) => row.ad_name !== '전월소재').length
      const impressions = metrics?.impressions ?? 0
      const clicks = metrics?.clicks ?? 0
      const adSpend = metrics?.ad_spend ?? 0
      const purchaseCount = metrics?.purchase_count ?? 0
      const purchaseValue = metrics?.purchase_value ?? 0

      return [
        excelCell(adCount, EXCEL_FORMATS.count),
        excelCell(campaignGroup.replace(' / ', '/'), EXCEL_FORMATS.text),
        excelCell(impressions, EXCEL_FORMATS.integer),
        excelCell(clicks, EXCEL_FORMATS.integer),
        excelCell(impressions > 0 ? clicks / impressions : 0, EXCEL_FORMATS.percent2),
        excelCell(adSpend, EXCEL_FORMATS.integer),
        excelCell(purchaseCount, EXCEL_FORMATS.integer),
        excelCell(purchaseValue, EXCEL_FORMATS.integer),
        excelCell(clicks > 0 ? purchaseCount / clicks : 0, EXCEL_FORMATS.percent2),
        excelCell(adSpend > 0 ? purchaseValue / adSpend : 0, EXCEL_FORMATS.percent0),
      ]
    })

    return {
      name: '캠페인_펼침',
      headers: ['광고 건 수', '광고 유형', '노출', '클릭', 'CTR', '광고비(마크업,vat-)', '구매', '기여매출', '구매율', 'ROAS'],
      rows,
    }
  }

  const buildCampaignCollapsedExportSheet = (): ExcelSheet => ({
    name: '캠페인_접힘',
    headers: ['소재', '캠페인 목표', '노출', '클릭', '구매', '매출', '광고비(마크업,vat-)'],
    rows: sortedCampaignCreativeRows.map((row) => {
      const campaignGroup = normalizeExportCampaignGroup(row.campaign_group)
      return [
        excelCell(creativeNameForCampaignExport(campaignGroup, row.ad_name), EXCEL_FORMATS.text),
        excelCell(campaignGoalForExport(campaignGroup, row.ad_name), EXCEL_FORMATS.text),
        excelCell(row.impressions, EXCEL_FORMATS.integer),
        excelCell(row.clicks, EXCEL_FORMATS.integer),
        excelCell(row.purchase_count, EXCEL_FORMATS.integer),
        excelCell(row.purchase_value, EXCEL_FORMATS.integer),
        excelCell(row.ad_spend, EXCEL_FORMATS.integer),
      ]
    }),
  })

  const buildCreativeExportSheet = (): ExcelSheet => ({
    name: '소재단위',
    headers: ['소재', '노출', '클릭', 'CTR', '광고비(마크업,vat-)', '구매', '기여매출', '구매율', 'ROAS'],
    rows: sortedCreativeRows.map((row) => [
      excelCell(row.ad_name, EXCEL_FORMATS.text),
      excelCell(row.impressions, EXCEL_FORMATS.integer),
      excelCell(row.clicks, EXCEL_FORMATS.integer),
      excelCell(row.ctr ?? 0, EXCEL_FORMATS.percent2),
      excelCell(row.ad_spend, EXCEL_FORMATS.integer),
      excelCell(row.purchase_count, EXCEL_FORMATS.integer),
      excelCell(row.purchase_value, EXCEL_FORMATS.integer),
      excelCell(row.purchase_rate ?? 0, EXCEL_FORMATS.percent2),
      excelCell(row.roas ?? 0, EXCEL_FORMATS.percent0),
    ]),
  })

  const buildDailyExportSheet = (): ExcelSheet => ({
    name: 'Daily단위',
    headers: ['일자', '노출', '클릭', 'CTR', '광고비(마크업,vat-)', '구매', '기여매출', 'ROAS'],
    rows: dailyRowsByDate.map((row) => [
      excelCell(dayLabel(row.reportDate), EXCEL_FORMATS.text),
      excelCell(row.impressions, EXCEL_FORMATS.integer),
      excelCell(row.clicks, EXCEL_FORMATS.integer),
      excelCell(row.impressions > 0 ? row.clicks / row.impressions : 0, EXCEL_FORMATS.percent2),
      excelCell(row.adSpend, EXCEL_FORMATS.integer),
      excelCell(row.purchaseCount, EXCEL_FORMATS.integer),
      excelCell(row.purchaseValue, EXCEL_FORMATS.integer),
      excelCell(row.adSpend > 0 ? row.purchaseValue / row.adSpend : 0, EXCEL_FORMATS.percent0),
    ]),
  })

  const handleDownloadExcel = () => {
    const modeLabel = viewMode === 'campaign' ? (showCampaignCreatives ? 'campaign-collapsed' : 'campaign-expanded') : viewMode
    const sheet = viewMode === 'campaign'
      ? showCampaignCreatives
        ? buildCampaignCollapsedExportSheet()
        : buildCampaignExpandedExportSheet()
      : viewMode === 'daily'
        ? buildDailyExportSheet()
        : buildCreativeExportSheet()

    downloadExcelWorkbook(`icebiscuit_meta_${modeLabel}_${normalizedRange.start}_${normalizedRange.end}.xls`, [sheet])
  }

  return (
    <div className="dashboard-shell icebiscuit-dashboard">
      <header className="topbar topbar--brand icebiscuit-dashboard__topbar">
        <div className="icebiscuit-dashboard__hero">
          <p className="eyebrow">ICEBISCUIT META</p>
          <h1 className="icebiscuit-dashboard__title">광고 성과 대시보드</h1>
          <span className="hint-chip icebiscuit-dashboard__period-chip">
            <CalendarDays size={14} />
            {periodLabel}
          </span>
        </div>
        <div className="topbar__actions icebiscuit-dashboard__actions">
          <div className="icebiscuit-dashboard__date-controls">
            <label className="month-selector icebiscuit-dashboard__preset-select-field">
              빠른 선택
              <select value={activePreset ?? ''} onChange={(event) => handlePresetSelect(event.target.value)}>
                <option value="">직접 선택</option>
                {presets.map((preset) => (
                  <option key={preset} value={preset}>
                    {presetLabel(preset)}
                  </option>
                ))}
              </select>
            </label>
            <label className="month-selector icebiscuit-dashboard__date-field">
              시작일
              <input
                type="date"
                min={MIN_SELECTABLE_DATE}
                value={normalizedDraftRange.start}
                onChange={(event) => handleStartDateChange(event.target.value)}
                onKeyDown={(event) => handleDateKeyDown(event.key)}
                onBlur={handleDateBlur}
              />
            </label>
            <label className="month-selector icebiscuit-dashboard__date-field">
              종료일
              <input
                type="date"
                min={MIN_SELECTABLE_DATE}
                value={normalizedDraftRange.end}
                onChange={(event) => handleEndDateChange(event.target.value)}
                onKeyDown={(event) => handleDateKeyDown(event.key)}
                onBlur={handleDateBlur}
              />
            </label>
            <button
              type="button"
              className="icebiscuit-dashboard__preset-button icebiscuit-dashboard__apply-button"
              onClick={handleApplyDateRange}
              disabled={!hasPendingDateChange}
            >
              조회
            </button>
          </div>
          <div className="icebiscuit-dashboard__toolbar-row">
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
          </div>
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
            <div className="icebiscuit-dashboard__summary-switch" role="tablist" aria-label="요약 단위">
              <button
                type="button"
                className={`icebiscuit-dashboard__view-mode${summaryGranularity === 'monthly' ? ' is-active' : ''}`}
                onClick={() => setSummaryGranularity('monthly')}
              >
                월간
              </button>
              <button
                type="button"
                className={`icebiscuit-dashboard__view-mode${summaryGranularity === 'weekly' ? ' is-active' : ''}`}
                onClick={() => setSummaryGranularity('weekly')}
              >
                주간
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="icebiscuit-dashboard__equal-table icebiscuit-dashboard__equal-table--summary">
              <thead>
                <tr>
                  <th>기간</th>
                  <th>노출</th>
                  <th>클릭</th>
                  <th>CTR</th>
                  <th>광고비</th>
                  <th>구매</th>
                  <th>금액</th>
                  <th>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.length ? (
                  summaryRows.map((row) => {
                    const impressionsDelta = formatSummaryDelta(row.deltas.impressions, 'percent')
                    const clicksDelta = formatSummaryDelta(row.deltas.clicks, 'percent')
                    const ctrDelta = formatSummaryDelta(row.deltas.ctr, 'percentPoint')
                    const adSpendDelta = formatSummaryDelta(row.deltas.adSpend, 'percent')
                    const purchaseCountDelta = formatSummaryDelta(row.deltas.purchaseCount, 'percent')
                    const purchaseValueDelta = formatSummaryDelta(row.deltas.purchaseValue, 'percent')
                    const roasDelta = formatSummaryDelta(row.deltas.roas, 'percent')

                    return (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td>{renderSummaryMetric(formatTableNumber(row.impressions), impressionsDelta.text, impressionsDelta.tone)}</td>
                        <td>{renderSummaryMetric(formatTableNumber(row.clicks), clicksDelta.text, clicksDelta.tone)}</td>
                        <td>{renderSummaryMetric(formatTableRatio(row.ctr, 2), ctrDelta.text, ctrDelta.tone)}</td>
                        <td>{renderSummaryMetric(formatTableCurrency(row.adSpend), adSpendDelta.text, adSpendDelta.tone)}</td>
                        <td>{renderSummaryMetric(formatTableNumber(row.purchaseCount), purchaseCountDelta.text, purchaseCountDelta.tone)}</td>
                        <td>{renderSummaryMetric(formatTableCurrency(row.purchaseValue), purchaseValueDelta.text, purchaseValueDelta.tone)}</td>
                        <td>{renderSummaryMetric(formatTableRatio(row.roas, 0), roasDelta.text, roasDelta.tone)}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="icebiscuit-dashboard__empty-cell">
                      {summaryGranularity === 'weekly' ? '선택한 종료일 기준 최근 주간 데이터가 아직 없어.' : '선택한 종료월 기준 최근 월간 데이터가 아직 없어.'}
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
            <div className="icebiscuit-dashboard__panel-actions">
              <button
                type="button"
                className="icebiscuit-dashboard__download-button"
                onClick={handleDownloadExcel}
                aria-label="엑셀 다운로드"
                title="엑셀 다운로드"
              >
                <Download size={18} aria-hidden="true" />
              </button>
              {viewMode === 'campaign' ? (
                <button
                  type="button"
                  className={`icebiscuit-dashboard__preset-button${showCampaignCreatives ? ' is-active' : ''}`}
                  onClick={() => setShowCampaignCreatives((current) => !current)}
                >
                  {showCampaignCreatives ? '소재 전체 접기' : '소재 전체 보기'}
                </button>
              ) : null}
            </div>
          </div>
          <div className="table-wrap">
            {viewMode === 'campaign' ? (
              <table className="icebiscuit-dashboard__equal-table icebiscuit-dashboard__equal-table--campaign icebiscuit-dashboard__equal-table--campaign-metrics">
                <colgroup>
                  <col className="icebiscuit-dashboard__metric-table-col--label" />
                  <col span={8} className="icebiscuit-dashboard__metric-table-col--metric" />
                </colgroup>
                <thead>
                  <tr>
                    <th>캠페인</th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCampaignSort('impressions')}>노출 <span>{sortIndicator(campaignSort, 'impressions')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCampaignSort('clicks')}>클릭 <span>{sortIndicator(campaignSort, 'clicks')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCampaignSort('ctr')}>CTR <span>{sortIndicator(campaignSort, 'ctr')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCampaignSort('ad_spend')}>광고비 <span>{sortIndicator(campaignSort, 'ad_spend')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCampaignSort('purchase_count')}>구매 <span>{sortIndicator(campaignSort, 'purchase_count')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCampaignSort('purchase_value')}>기여매출 <span>{sortIndicator(campaignSort, 'purchase_value')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCampaignSort('purchase_rate')}>구매율 <span>{sortIndicator(campaignSort, 'purchase_rate')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCampaignSort('roas')}>ROAS <span>{sortIndicator(campaignSort, 'roas')}</span></button></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCampaignRows.length ? (
                    sortedCampaignRows.flatMap((row) => {
                      const childRows = creativeRowsByCampaign.get(row.campaign_name) ?? []
                      const parentRow = (
                        <tr key={row.campaign_name}>
                          <td>{row.campaign_name}</td>
                          <td>{formatTableNumber(row.impressions)}</td>
                          <td>{formatTableNumber(row.clicks)}</td>
                          <td>{formatTableRatio(row.ctr, 2)}</td>
                          <td>{formatTableCurrency(row.ad_spend)}</td>
                          <td>{formatTableNumber(row.purchase_count)}</td>
                          <td>{formatTableCurrency(row.purchase_value)}</td>
                          <td>{formatTableRatio(row.purchase_rate, 2)}</td>
                          <td>{formatTableRatio(row.roas, 0)}</td>
                        </tr>
                      )

                      if (!showCampaignCreatives || !childRows.length) {
                        return [parentRow]
                      }

                      return [
                        parentRow,
                        ...childRows.map((child) => (
                          <tr key={`${row.campaign_name}-${child.ad_key}`} className="icebiscuit-dashboard__child-row">
                            <td>
                              <div className="icebiscuit-dashboard__child-label">
                                <span className="icebiscuit-dashboard__child-prefix">소재</span>
                                <span>{child.ad_name}</span>
                              </div>
                            </td>
                            <td>{formatTableNumber(child.impressions)}</td>
                            <td>{formatTableNumber(child.clicks)}</td>
                            <td>{formatTableRatio(child.ctr, 2)}</td>
                            <td>{formatTableCurrency(child.ad_spend)}</td>
                            <td>{formatTableNumber(child.purchase_count)}</td>
                            <td>{formatTableCurrency(child.purchase_value)}</td>
                            <td>{formatTableRatio(child.purchase_rate, 2)}</td>
                            <td>{formatTableRatio(child.roas, 0)}</td>
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
              <table className="icebiscuit-dashboard__equal-table icebiscuit-dashboard__equal-table--campaign icebiscuit-dashboard__equal-table--selectable">
                <colgroup>
                  <col className="icebiscuit-dashboard__select-col" />
                  <col span={8} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="icebiscuit-dashboard__select-cell">
                      <input
                        type="checkbox"
                        aria-label="Daily 전체 선택"
                        checked={areAllVisibleDailyRowsSelected}
                        onChange={toggleAllVisibleDailyRows}
                      />
                    </th>
                    <th>일자</th>
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
                  {dailyRowsByDate.length ? (
                    dailyRowsByDate.map((row) => {
                      const isSelected = selectedDailyDates.has(row.reportDate)
                      return (
                        <tr key={row.reportDate} className={isSelected ? 'is-selected' : ''}>
                          <td className="icebiscuit-dashboard__select-cell">
                            <input
                              type="checkbox"
                              aria-label={`${dayLabel(row.reportDate)} 선택`}
                              checked={isSelected}
                              onChange={() => toggleDailySelection(row.reportDate)}
                            />
                          </td>
                          <td>{dayLabel(row.reportDate)}</td>
                          <td>{formatTableNumber(row.impressions)}</td>
                          <td>{formatTableNumber(row.clicks)}</td>
                          <td>{formatTableRatio(row.impressions > 0 ? row.clicks / row.impressions : null, 2)}</td>
                          <td>{formatTableCurrency(row.adSpend)}</td>
                          <td>{formatTableNumber(row.purchaseCount)}</td>
                          <td>{formatTableCurrency(row.purchaseValue)}</td>
                          <td>{formatTableRatio(row.adSpend > 0 ? row.purchaseValue / row.adSpend : null, 0)}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="icebiscuit-dashboard__empty-cell">선택한 기간의 daily 데이터가 아직 없어.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  {selectedDailyRows.length ? (
                    <tr className="icebiscuit-dashboard__selected-total-row">
                      <td></td>
                      <td>선택 합계 ({selectedDailyRows.length})</td>
                      <td>{formatTableNumber(selectedDailyTotals.impressions)}</td>
                      <td>{formatTableNumber(selectedDailyTotals.clicks)}</td>
                      <td>{formatTableRatio(selectedDailyCtr, 2)}</td>
                      <td>{formatTableCurrency(selectedDailyTotals.adSpend)}</td>
                      <td>{formatTableNumber(selectedDailyTotals.purchaseCount)}</td>
                      <td>{formatTableCurrency(selectedDailyTotals.purchaseValue)}</td>
                      <td>{formatTableRatio(selectedDailyRoas, 0)}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td></td>
                    <td>Total</td>
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
              <table className="icebiscuit-dashboard__equal-table icebiscuit-dashboard__equal-table--campaign icebiscuit-dashboard__equal-table--campaign-metrics icebiscuit-dashboard__equal-table--selectable">
                <colgroup>
                  <col className="icebiscuit-dashboard__select-col" />
                  <col className="icebiscuit-dashboard__metric-table-col--label" />
                  <col span={8} className="icebiscuit-dashboard__metric-table-col--metric" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="icebiscuit-dashboard__select-cell">
                      <input
                        type="checkbox"
                        aria-label="소재 전체 선택"
                        checked={areAllVisibleCreativesSelected}
                        onChange={toggleAllVisibleCreatives}
                      />
                    </th>
                    <th>소재</th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCreativeSort('impressions')}>노출 <span>{sortIndicator(creativeSort, 'impressions')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCreativeSort('clicks')}>클릭 <span>{sortIndicator(creativeSort, 'clicks')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCreativeSort('ctr')}>CTR <span>{sortIndicator(creativeSort, 'ctr')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCreativeSort('ad_spend')}>광고비 <span>{sortIndicator(creativeSort, 'ad_spend')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCreativeSort('purchase_count')}>구매 <span>{sortIndicator(creativeSort, 'purchase_count')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCreativeSort('purchase_value')}>기여매출 <span>{sortIndicator(creativeSort, 'purchase_value')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCreativeSort('purchase_rate')}>구매율 <span>{sortIndicator(creativeSort, 'purchase_rate')}</span></button></th>
                    <th><button type="button" className="icebiscuit-dashboard__sort-button" onClick={() => handleCreativeSort('roas')}>ROAS <span>{sortIndicator(creativeSort, 'roas')}</span></button></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCreativeRows.length ? (
                    sortedCreativeRows.map((row) => {
                      const isSelected = selectedCreativeKeys.has(row.ad_key)
                      return (
                        <tr key={row.ad_key} className={isSelected ? 'is-selected' : ''}>
                          <td className="icebiscuit-dashboard__select-cell">
                            <input
                              type="checkbox"
                              aria-label={`${row.ad_name} 선택`}
                              checked={isSelected}
                              onChange={() => toggleCreativeSelection(row.ad_key)}
                            />
                          </td>
                          <td>{row.ad_name}</td>
                          <td>{formatTableNumber(row.impressions)}</td>
                          <td>{formatTableNumber(row.clicks)}</td>
                          <td>{formatTableRatio(row.ctr, 2)}</td>
                          <td>{formatTableCurrency(row.ad_spend)}</td>
                          <td>{formatTableNumber(row.purchase_count)}</td>
                          <td>{formatTableCurrency(row.purchase_value)}</td>
                          <td>{formatTableRatio(row.purchase_rate, 2)}</td>
                          <td>{formatTableRatio(row.roas, 0)}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="icebiscuit-dashboard__empty-cell">선택한 기간의 소재 데이터가 아직 없어.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  {selectedCreativeRows.length ? (
                    <tr className="icebiscuit-dashboard__selected-total-row">
                      <td></td>
                      <td>선택 합계 ({selectedCreativeRows.length})</td>
                      <td>{formatTableNumber(selectedCreativeTotals.impressions)}</td>
                      <td>{formatTableNumber(selectedCreativeTotals.clicks)}</td>
                      <td>{formatTableRatio(selectedCreativeCtr, 2)}</td>
                      <td>{formatTableCurrency(selectedCreativeTotals.adSpend)}</td>
                      <td>{formatTableNumber(selectedCreativeTotals.purchaseCount)}</td>
                      <td>{formatTableCurrency(selectedCreativeTotals.purchaseValue)}</td>
                      <td>{formatTableRatio(selectedCreativeTotals.clicks > 0 ? selectedCreativeTotals.purchaseCount / selectedCreativeTotals.clicks : null, 2)}</td>
                      <td>{formatTableRatio(selectedCreativeRoas, 0)}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td></td>
                    <td>Total</td>
                    <td>{formatTableNumber(creativeTotals.impressions)}</td>
                    <td>{formatTableNumber(creativeTotals.clicks)}</td>
                    <td>{formatTableRatio(creativeTotals.impressions > 0 ? creativeTotals.clicks / creativeTotals.impressions : null, 2)}</td>
                    <td>{formatTableCurrency(creativeTotals.adSpend)}</td>
                    <td>{formatTableNumber(creativeTotals.purchaseCount)}</td>
                    <td>{formatTableCurrency(creativeTotals.purchaseValue)}</td>
                    <td>{formatTableRatio(creativeTotals.clicks > 0 ? creativeTotals.purchaseCount / creativeTotals.clicks : null, 2)}</td>
                    <td>{formatTableRatio(creativeTotals.adSpend > 0 ? creativeTotals.purchaseValue / creativeTotals.adSpend : null, 0)}</td>
                  </tr>
                </tfoot>
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
            <p>캠페인 단위는 daily 범위가 있으면 선택 기간만 정확히 합산하고, older monthly-only 구간은 월별 집계를 합산해 보여줘. 주간 요약은 종료일 기준 최근 6주를 묶어 보여준다.</p>
            <p>소재 단위는 2026년 이후 ad-level raw 적재 데이터를 기준으로 연결했다. adname 표기는 소재로 통일한다.</p>
            <p>캠페인 표에서 토글을 열면 같은 그룹 아래 소재 행을 펼쳐볼 수 있어.</p>
            <p>현재 총 CTR은 {formatRatio(activeCtr)}, 총 ROAS는 {formatRatio(activeRoas)}로 재계산했다.</p>
          </div>
        </article>
      </section>
    </div>
  )
}
