export type DateRange = {
  start: string
  end: string
}

export type AggregateMetrics = {
  impressions: number
  clicks: number
  adSpend: number
  purchaseCount: number
  purchaseValue: number
}

export type MonthlyOverviewRow = {
  report_month: string
  impressions: number | null
  clicks: number | null
  ad_spend: number | null
  purchase_count: number | null
  purchase_value: number | null
}

export type DailyCampaignRow = {
  report_date: string
  campaign_name: string | null
  impressions: number | null
  clicks: number | null
  ad_spend: number | null
  purchase_count: number | null
  purchase_value: number | null
}

export type DailyCreativeRow = {
  report_date: string
  campaign_group: string | null
  ad_id: string | null
  ad_name: string | null
  impressions: number | null
  clicks: number | null
  ad_spend: number | null
  purchase_count: number | null
  purchase_value: number | null
}

export type AggregatedCampaignRow = {
  campaign_name: string
  impressions: number
  clicks: number
  ad_spend: number
  purchase_count: number
  purchase_value: number
}

export type AggregatedCreativeRow = {
  campaign_group: string
  ad_key: string
  ad_name: string
  impressions: number
  clicks: number
  ad_spend: number
  purchase_count: number
  purchase_value: number
}

const campaignDisplayOrder = ['ASC', '리타겟팅', '전환(패션관심)', '참여 캠페인 / 게시물참여'] as const

export function formatCampaignName(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  if (!normalized) return '-'
  if (campaignDisplayOrder.includes(normalized as (typeof campaignDisplayOrder)[number])) return normalized
  if (normalized === 'ASC_전체 라인업 캠페인') return 'ASC'
  if (normalized === '리타겟팅 캠페인') return '리타겟팅'
  if (normalized === '전환 캠페인(패션 관심사)') return '전환(패션관심)'
  return normalized
}

export function campaignSortRank(name: string | null | undefined) {
  const label = formatCampaignName(name)
  const index = campaignDisplayOrder.indexOf(label as (typeof campaignDisplayOrder)[number])
  return index === -1 ? campaignDisplayOrder.length : index
}

export function washCreativeName(rawName: string | null | undefined, reportMonthOrDate: string) {
  const normalized = (rawName ?? '').trim()
  if (!normalized) return '소재명 없음'

  const datePrefixMatch = normalized.match(/^(\d{2})(\d{2})~(\d{2})(\d{2})_(.+)$/)
  if (datePrefixMatch) {
    const startMonth = Number(datePrefixMatch[1])
    const reportMonthNumber = Number(reportMonthOrDate.slice(5, 7))
    const expectedPreviousMonth = reportMonthNumber === 1 ? 12 : reportMonthNumber - 1
    if (startMonth === expectedPreviousMonth && startMonth !== reportMonthNumber) {
      return '전월소재'
    }
  }

  return normalized.replace(/^\d{4}~\d{4}_/, '').replace(/_(슬라이드|단일이미지|단일 이미지)$/, '').trim()
}

export function aggregateMetrics(rows: Array<{ impressions: number | null; clicks: number | null; ad_spend: number | null; purchase_count: number | null; purchase_value: number | null }>): AggregateMetrics {
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

export function filterDailyRowsByRange<T extends { report_date: string }>(rows: T[], range: DateRange) {
  return rows.filter((row) => row.report_date >= range.start && row.report_date <= range.end)
}

export function hasBoundaryCoverage<T extends { report_date: string }>(rows: T[], range: DateRange) {
  if (!rows.length) return false
  const dates = rows.map((row) => row.report_date).sort((a, b) => a.localeCompare(b))
  return dates[0] <= range.start && dates[dates.length - 1] >= range.end
}

export function aggregateCampaignRowsForRange(rows: DailyCampaignRow[], range: DateRange): AggregatedCampaignRow[] {
  const filteredRows = filterDailyRowsByRange(rows, range)
  const grouped = new Map<string, AggregatedCampaignRow>()

  filteredRows.forEach((row) => {
    const key = formatCampaignName(row.campaign_name)
    const current = grouped.get(key) ?? {
      campaign_name: key,
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
}

export function aggregateCampaignCreativeRowsForRange(rows: DailyCreativeRow[], range: DateRange): AggregatedCreativeRow[] {
  const filteredRows = filterDailyRowsByRange(rows, range)
  const grouped = new Map<string, AggregatedCreativeRow>()

  filteredRows.forEach((row) => {
    const adName = washCreativeName(row.ad_name, row.report_date)
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
}

export function aggregateCreativeRowsForRange(rows: DailyCreativeRow[], range: DateRange): AggregatedCreativeRow[] {
  const filteredRows = filterDailyRowsByRange(rows, range)
  const grouped = new Map<string, AggregatedCreativeRow>()

  filteredRows.forEach((row) => {
    const adName = washCreativeName(row.ad_name, row.report_date)
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
}

export function pickMetricsForCampaignCards(args: { dailyRows: DailyCampaignRow[]; monthlyMetrics: AggregateMetrics; range: DateRange }) {
  if (!hasBoundaryCoverage(args.dailyRows, args.range)) return args.monthlyMetrics
  return aggregateMetrics(filterDailyRowsByRange(args.dailyRows, args.range))
}
