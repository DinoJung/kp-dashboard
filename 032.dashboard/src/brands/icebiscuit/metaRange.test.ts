import { describe, expect, it } from 'vitest'
import {
  aggregateCampaignRowsForRange,
  aggregateCreativeRowsForRange,
  filterDailyRowsByRange,
  hasBoundaryCoverage,
  pickMetricsForCampaignCards,
  type AggregateMetrics,
  type DailyCampaignRow,
  type DailyCreativeRow,
  type MonthlyOverviewRow,
} from './metaRange'

describe('metaRange', () => {
  const dailyRows: DailyCampaignRow[] = [
    {
      report_date: '2026-04-01',
      campaign_name: 'ASC',
      impressions: 100,
      clicks: 10,
      ad_spend: 1000,
      purchase_count: 1,
      purchase_value: 5000,
    },
    {
      report_date: '2026-04-10',
      campaign_name: '리타겟팅',
      impressions: 50,
      clicks: 5,
      ad_spend: 400,
      purchase_count: 1,
      purchase_value: 2400,
    },
    {
      report_date: '2026-04-20',
      campaign_name: 'ASC',
      impressions: 999,
      clicks: 99,
      ad_spend: 9999,
      purchase_count: 9,
      purchase_value: 99999,
    },
  ]

  const creativeRows: DailyCreativeRow[] = [
    {
      report_date: '2026-04-02',
      campaign_group: 'ASC',
      ad_id: '1',
      ad_name: '0401~0415_ASC 아이스딜1차_슬라이드',
      impressions: 100,
      clicks: 10,
      ad_spend: 1000,
      purchase_count: 1,
      purchase_value: 5000,
    },
    {
      report_date: '2026-04-12',
      campaign_group: '리타겟팅',
      ad_id: '2',
      ad_name: '0401~0415_ASC 아이스딜1차_단일이미지',
      impressions: 50,
      clicks: 5,
      ad_spend: 400,
      purchase_count: 1,
      purchase_value: 2000,
    },
    {
      report_date: '2026-04-20',
      campaign_group: 'ASC',
      ad_id: '3',
      ad_name: '0420~0430_ASC 아이스딜2차_단일이미지',
      impressions: 777,
      clicks: 77,
      ad_spend: 7000,
      purchase_count: 7,
      purchase_value: 70000,
    },
  ]

  const fallbackMonthlyMetrics: AggregateMetrics = {
    impressions: 1000,
    clicks: 100,
    adSpend: 10000,
    purchaseCount: 10,
    purchaseValue: 100000,
  }

  const monthlyOverview: MonthlyOverviewRow[] = [
    {
      report_month: '2025-12-01',
      impressions: 1000,
      clicks: 100,
      ad_spend: 10000,
      purchase_count: 10,
      purchase_value: 100000,
    },
  ]

  it('filters daily campaign rows by exact selected range', () => {
    const filtered = filterDailyRowsByRange(dailyRows, { start: '2026-04-01', end: '2026-04-15' })

    expect(filtered).toHaveLength(2)
    expect(filtered.map((row) => row.report_date)).toEqual(['2026-04-01', '2026-04-10'])
  })

  it('aggregates campaign table rows from exact daily range only', () => {
    const rows = aggregateCampaignRowsForRange(dailyRows, { start: '2026-04-01', end: '2026-04-15' })

    expect(rows).toEqual([
      {
        campaign_name: 'ASC',
        impressions: 100,
        clicks: 10,
        ad_spend: 1000,
        purchase_count: 1,
        purchase_value: 5000,
      },
      {
        campaign_name: '리타겟팅',
        impressions: 50,
        clicks: 5,
        ad_spend: 400,
        purchase_count: 1,
        purchase_value: 2400,
      },
    ])
  })

  it('aggregates creative rows from exact selected range only', () => {
    const rows = aggregateCreativeRowsForRange(creativeRows, { start: '2026-04-01', end: '2026-04-15' })

    expect(rows).toEqual([
      {
        campaign_group: '',
        ad_key: 'ASC 아이스딜1차',
        ad_name: 'ASC 아이스딜1차',
        impressions: 150,
        clicks: 15,
        ad_spend: 1400,
        purchase_count: 2,
        purchase_value: 7000,
      },
    ])
  })

  it('uses exact daily metrics for campaign cards when the full selected range is covered', () => {
    const metrics = pickMetricsForCampaignCards({
      dailyRows,
      monthlyMetrics: fallbackMonthlyMetrics,
      range: { start: '2026-04-01', end: '2026-04-15' },
    })

    expect(metrics).toEqual({
      impressions: 150,
      clicks: 15,
      adSpend: 1400,
      purchaseCount: 2,
      purchaseValue: 7400,
    })
  })

  it('falls back to monthly metrics when daily coverage does not include the full range', () => {
    const metrics = pickMetricsForCampaignCards({
      dailyRows,
      monthlyMetrics: fallbackMonthlyMetrics,
      range: { start: '2025-12-01', end: '2025-12-31' },
    })

    expect(metrics).toEqual(fallbackMonthlyMetrics)
  })

  it('detects usable daily boundary coverage correctly', () => {
    expect(hasBoundaryCoverage(dailyRows, { start: '2026-04-01', end: '2026-04-15' })).toBe(true)
    expect(hasBoundaryCoverage(dailyRows, { start: '2025-12-01', end: '2026-04-15' })).toBe(false)
  })

  it('keeps monthly fallback data available for older ranges', () => {
    expect(monthlyOverview[0].report_month).toBe('2025-12-01')
  })
})
