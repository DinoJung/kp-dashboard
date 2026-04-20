export type SummaryGranularity = 'monthly' | 'weekly'

export type SummaryOverviewRow = {
  report_month: string
  impressions: number | null
  clicks: number | null
  ctr: number | null
  ad_spend: number | null
  purchase_count: number | null
  purchase_value: number | null
  roas: number | null
}

export type SummaryDailyRow = {
  report_date: string
  impressions: number | null
  clicks: number | null
  ad_spend: number | null
  purchase_count: number | null
  purchase_value: number | null
}

export type SummaryDelta = {
  direction: 'up' | 'down' | 'flat'
  value: number
}

export type SummaryRow = {
  key: string
  label: string
  impressions: number
  clicks: number
  ctr: number | null
  adSpend: number
  purchaseCount: number
  purchaseValue: number
  roas: number | null
  deltas: {
    impressions: SummaryDelta | null
    clicks: SummaryDelta | null
    ctr: SummaryDelta | null
    adSpend: SummaryDelta | null
    purchaseCount: SummaryDelta | null
    purchaseValue: SummaryDelta | null
    roas: SummaryDelta | null
  }
}

export type SortableMetricKey = 'impressions' | 'clicks' | 'ctr' | 'ad_spend' | 'purchase_count' | 'purchase_value' | 'purchase_rate' | 'roas'
export type SummarySortState = { key: SortableMetricKey; direction: 'desc' | 'asc' } | null

export type MetricSortableRow = {
  label: string
  impressions: number
  clicks: number
  ctr: number | null
  ad_spend: number
  purchase_count: number
  purchase_value: number
  purchase_rate: number | null
  roas: number | null
}

function toIsoDate(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeekMonday(value: Date) {
  const weekday = value.getDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  const next = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  next.setDate(next.getDate() + diff)
  return next
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function monthLabel(value: string) {
  return value.slice(0, 7)
}

function roundDelta(value: number) {
  return Number(value.toFixed(4))
}

function buildDelta(current: number | null, previous: number | null, unit: 'percent' | 'percentPoint'): SummaryDelta | null {
  if (current === null || previous === null) return null
  if (unit === 'percentPoint') {
    if (previous === 0) return null
    const diff = (current - previous) * 100
    if (Math.abs(diff) < 0.000_000_1) return { direction: 'flat', value: 0 }
    return { direction: diff > 0 ? 'up' : 'down', value: roundDelta(Math.abs(diff)) }
  }
  if (previous === 0) return null
  const diff = ((current - previous) / previous) * 100
  if (Math.abs(diff) < 0.000_000_1) return { direction: 'flat', value: 0 }
  return { direction: diff > 0 ? 'up' : 'down', value: roundDelta(Math.abs(diff)) }
}

type SummaryRowBase = Omit<SummaryRow, 'deltas'>

function withDeltas(rows: SummaryRowBase[], resolvePrevious: (row: SummaryRowBase, index: number) => SummaryRowBase | null): SummaryRow[] {
  return rows.map((row, index) => {
    const previous = resolvePrevious(row, index)
    return {
      ...row,
      deltas: {
        impressions: buildDelta(row.impressions, previous?.impressions ?? null, 'percent'),
        clicks: buildDelta(row.clicks, previous?.clicks ?? null, 'percent'),
        ctr: buildDelta(row.ctr, previous?.ctr ?? null, 'percentPoint'),
        adSpend: buildDelta(row.adSpend, previous?.adSpend ?? null, 'percent'),
        purchaseCount: buildDelta(row.purchaseCount, previous?.purchaseCount ?? null, 'percent'),
        purchaseValue: buildDelta(row.purchaseValue, previous?.purchaseValue ?? null, 'percent'),
        roas: buildDelta(row.roas, previous?.roas ?? null, 'percent'),
      },
    }
  })
}

function buildMonthlySummaryRows(endDate: string, overviewRows: SummaryOverviewRow[]) {
  const endMonth = endDate.slice(0, 7)
  const end = new Date(`${endMonth}-01T00:00:00`)
  const visibleMonths = new Set<string>()
  for (let i = 0; i < 6; i += 1) {
    const date = new Date(end.getFullYear(), end.getMonth() - i, 1)
    visibleMonths.add(toIsoDate(date).slice(0, 7))
  }

  const overviewByMonth = new Map(overviewRows.map((row) => [row.report_month.slice(0, 7), row]))

  const rows = overviewRows
    .filter((row) => visibleMonths.has(row.report_month.slice(0, 7)))
    .slice()
    .sort((a, b) => b.report_month.localeCompare(a.report_month))
    .map((row) => ({
      key: row.report_month,
      label: monthLabel(row.report_month),
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      ctr: row.ctr,
      adSpend: row.ad_spend ?? 0,
      purchaseCount: row.purchase_count ?? 0,
      purchaseValue: row.purchase_value ?? 0,
      roas: row.roas,
    }))

  return withDeltas(rows, (row) => {
    const [year, month] = row.label.split('-').map(Number)
    const previousMonthKey = toIsoDate(new Date(year, month - 2, 1)).slice(0, 7)
    const previous = overviewByMonth.get(previousMonthKey)
    if (!previous) return null

    return {
      key: previous.report_month,
      label: monthLabel(previous.report_month),
      impressions: previous.impressions ?? 0,
      clicks: previous.clicks ?? 0,
      ctr: previous.ctr,
      adSpend: previous.ad_spend ?? 0,
      purchaseCount: previous.purchase_count ?? 0,
      purchaseValue: previous.purchase_value ?? 0,
      roas: previous.roas,
    }
  })
}

function formatWeeklyLabel(startIso: string, endIso: string) {
  return startIso.slice(0, 4) === endIso.slice(0, 4) ? `${startIso} - ${endIso.slice(5)}` : `${startIso} - ${endIso}`
}

function buildWeeklySummaryRows(endDate: string, dailyRows: SummaryDailyRow[]) {
  const anchor = new Date(`${endDate}T00:00:00`)
  const currentWeekStart = startOfWeekMonday(anchor)

  const rows = Array.from({ length: 7 }, (_, index) => {
    const weekStart = addDays(currentWeekStart, index * -7)
    const rawWeekEnd = addDays(weekStart, 6)
    const weekEnd = index === 0 && toIsoDate(rawWeekEnd) > endDate ? anchor : rawWeekEnd
    const startIso = toIsoDate(weekStart)
    const endIso = index === 0 ? endDate : toIsoDate(weekEnd)
    const periodRows = dailyRows.filter((row) => row.report_date >= startIso && row.report_date <= endIso)
    const impressions = periodRows.reduce((sum, row) => sum + (row.impressions ?? 0), 0)
    const clicks = periodRows.reduce((sum, row) => sum + (row.clicks ?? 0), 0)
    const adSpend = periodRows.reduce((sum, row) => sum + (row.ad_spend ?? 0), 0)
    const purchaseCount = periodRows.reduce((sum, row) => sum + (row.purchase_count ?? 0), 0)
    const purchaseValue = periodRows.reduce((sum, row) => sum + (row.purchase_value ?? 0), 0)

    return {
      key: `${startIso}:${endIso}`,
      label: formatWeeklyLabel(startIso, endIso),
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : null,
      adSpend,
      purchaseCount,
      purchaseValue,
      roas: adSpend > 0 ? purchaseValue / adSpend : null,
    }
  })

  const visibleRows = rows.slice(0, 6)
  const hasAnyActivity = visibleRows.some((row) => row.impressions || row.clicks || row.adSpend || row.purchaseCount || row.purchaseValue)
  if (!hasAnyActivity) return []

  return withDeltas(visibleRows, (_, index) => rows[index + 1] ?? null)
}

export function buildSummaryRows(args: { granularity: SummaryGranularity; endDate: string; overviewRows: SummaryOverviewRow[]; dailyRows: SummaryDailyRow[] }) {
  if (!args.endDate) return []
  return args.granularity === 'weekly' ? buildWeeklySummaryRows(args.endDate, args.dailyRows) : buildMonthlySummaryRows(args.endDate, args.overviewRows)
}

export function formatSummaryDelta(delta: SummaryDelta | null, unit: 'percent' | 'percentPoint') {
  if (!delta || delta.direction === 'flat') return { text: '-', tone: 'flat' as const }
  const suffix = unit === 'percentPoint' ? '%p' : '%'
  return {
    text: `${delta.direction === 'up' ? '▲' : '▼'}${delta.value.toFixed(1)}${suffix}`,
    tone: delta.direction,
  }
}

export function cycleColumnSort(current: SummarySortState, key: SortableMetricKey): SummarySortState {
  if (!current || current.key !== key) return { key, direction: 'desc' }
  if (current.direction === 'desc') return { key, direction: 'asc' }
  return null
}

function metricValue(row: MetricSortableRow, key: SortableMetricKey) {
  return row[key] ?? Number.NEGATIVE_INFINITY
}

export function sortMetricRows<T extends MetricSortableRow>(rows: T[], sortState: SummarySortState) {
  if (!sortState) return rows.slice()
  const direction = sortState.direction === 'desc' ? -1 : 1
  return rows.slice().sort((a, b) => {
    const diff = metricValue(a, sortState.key) - metricValue(b, sortState.key)
    if (diff !== 0) return diff * direction
    return a.label.localeCompare(b.label, 'ko')
  })
}
