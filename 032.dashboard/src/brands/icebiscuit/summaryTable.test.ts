import { describe, expect, it } from 'vitest'
import {
  buildSummaryRows,
  cycleColumnSort,
  formatSummaryDelta,
  sortMetricRows,
  type SummarySortState,
} from './summaryTable'

describe('summaryTable helpers', () => {
  it('builds monthly summary rows with previous-month deltas', () => {
    const rows = buildSummaryRows({
      granularity: 'monthly',
      endDate: '2026-04-19',
      overviewRows: [
        { report_month: '2026-02-01', impressions: 1000, clicks: 100, ctr: 0.1, ad_spend: 10000, purchase_count: 10, purchase_value: 20000, roas: 2 },
        { report_month: '2026-03-01', impressions: 1200, clicks: 144, ctr: 0.12, ad_spend: 12000, purchase_count: 12, purchase_value: 25200, roas: 2.1 },
        { report_month: '2026-04-01', impressions: 900, clicks: 99, ctr: 0.11, ad_spend: 9000, purchase_count: 11, purchase_value: 19800, roas: 2.2 },
      ],
      dailyRows: [],
    })

    expect(rows.map((row) => row.label)).toEqual(['2026-04', '2026-03', '2026-02'])
    expect(rows[0].deltas.impressions).toEqual({ direction: 'down', value: 25 })
    expect(rows[0].deltas.ctr).toEqual({ direction: 'down', value: 1 })
    expect(rows[1].deltas.purchaseValue).toEqual({ direction: 'up', value: 26 })
  })

  it('builds weekly summary rows from monday-based periods and shortens same-year end labels', () => {
    const rows = buildSummaryRows({
      granularity: 'weekly',
      endDate: '2026-04-16',
      overviewRows: [],
      dailyRows: [
        { report_date: '2026-04-06', impressions: 100, clicks: 10, ad_spend: 1000, purchase_count: 1, purchase_value: 2000 },
        { report_date: '2026-04-08', impressions: 200, clicks: 20, ad_spend: 1500, purchase_count: 2, purchase_value: 4000 },
        { report_date: '2026-04-13', impressions: 300, clicks: 45, ad_spend: 2000, purchase_count: 3, purchase_value: 7000 },
        { report_date: '2026-04-16', impressions: 150, clicks: 18, ad_spend: 800, purchase_count: 2, purchase_value: 2400 },
      ],
    })

    expect(rows.slice(0, 2).map((row) => row.label)).toEqual(['2026-04-13 - 04-16', '2026-04-06 - 04-12'])
    expect(rows[0].impressions).toBe(450)
    expect(rows[0].deltas.clicks).toEqual({ direction: 'up', value: 110 })
  })

  it('keeps full year on end labels when the weekly bucket crosses years', () => {
    const rows = buildSummaryRows({
      granularity: 'weekly',
      endDate: '2026-01-02',
      overviewRows: [],
      dailyRows: [{ report_date: '2026-01-02', impressions: 10, clicks: 1, ad_spend: 100, purchase_count: 1, purchase_value: 300 }],
    })

    expect(rows[0].label).toBe('2025-12-29 - 2026-01-02')
  })

  it('formats summary deltas with requested arrows, units, and colors', () => {
    expect(formatSummaryDelta({ direction: 'up', value: 12.34 }, 'percent')).toEqual({ text: '▲12.3%', tone: 'up' })
    expect(formatSummaryDelta({ direction: 'down', value: 1.04 }, 'percentPoint')).toEqual({ text: '▼1.0%p', tone: 'down' })
    expect(formatSummaryDelta({ direction: 'flat', value: 0 }, 'percent')).toEqual({ text: '-', tone: 'flat' })
    expect(formatSummaryDelta(null, 'percent')).toEqual({ text: '-', tone: 'flat' })
  })

  it('treats previous zero periods as non-comparable for CTR and keeps zero-activity weeks in the window', () => {
    const weeklyRows = buildSummaryRows({
      granularity: 'weekly',
      endDate: '2026-04-16',
      overviewRows: [],
      dailyRows: [
        { report_date: '2026-04-16', impressions: 100, clicks: 5, ad_spend: 500, purchase_count: 1, purchase_value: 1000 },
        { report_date: '2026-04-02', impressions: 80, clicks: 4, ad_spend: 300, purchase_count: 1, purchase_value: 700 },
      ],
    })

    expect(weeklyRows.slice(0, 3).map((row) => row.label)).toEqual([
      '2026-04-13 - 04-16',
      '2026-04-06 - 04-12',
      '2026-03-30 - 04-05',
    ])
    expect(weeklyRows[1].impressions).toBe(0)
    expect(weeklyRows[0].deltas.ctr).toBeNull()
    expect(formatSummaryDelta(weeklyRows[0].deltas.ctr, 'percentPoint')).toEqual({ text: '-', tone: 'flat' })
  })

  it('returns empty weekly summary when the selected end date has no weekly activity in the 6-week window', () => {
    const rows = buildSummaryRows({
      granularity: 'weekly',
      endDate: '2025-02-15',
      overviewRows: [],
      dailyRows: [{ report_date: '2026-04-16', impressions: 100, clicks: 5, ad_spend: 500, purchase_count: 1, purchase_value: 1000 }],
    })

    expect(rows).toEqual([])
  })

  it('cycles sort state desc -> asc -> none', () => {
    let state: SummarySortState = null
    state = cycleColumnSort(state, 'roas')
    expect(state).toEqual({ key: 'roas', direction: 'desc' })
    state = cycleColumnSort(state, 'roas')
    expect(state).toEqual({ key: 'roas', direction: 'asc' })
    state = cycleColumnSort(state, 'roas')
    expect(state).toBeNull()
  })

  it('sorts metric rows by selected metric and restores initial order when sort is cleared', () => {
    const initialRows = [
      { label: 'A', impressions: 100, clicks: 10, ctr: 0.1, ad_spend: 1000, purchase_count: 1, purchase_value: 3000, purchase_rate: 0.1, roas: 3 },
      { label: 'B', impressions: 200, clicks: 5, ctr: 0.025, ad_spend: 2000, purchase_count: 2, purchase_value: 1000, purchase_rate: 0.4, roas: 0.5 },
      { label: 'C', impressions: 150, clicks: 30, ctr: 0.2, ad_spend: 500, purchase_count: 3, purchase_value: 4000, purchase_rate: 0.1, roas: 8 },
    ]

    expect(sortMetricRows(initialRows, { key: 'roas', direction: 'desc' }).map((row) => row.label)).toEqual(['C', 'A', 'B'])
    expect(sortMetricRows(initialRows, { key: 'clicks', direction: 'asc' }).map((row) => row.label)).toEqual(['B', 'A', 'C'])
    expect(sortMetricRows(initialRows, null).map((row) => row.label)).toEqual(['A', 'B', 'C'])
  })
})
