import { describe, expect, it } from 'vitest'
import { MIN_SELECTABLE_DATE, clampToSelectableDate, shouldApplyDateRangeOnBlur, shouldApplyDateRangeOnKey } from './filterControls'
import { buildPresetRange, presetLabel } from './datePresets'

describe('filterControls', () => {
  it('exposes the minimum selectable date as 2025-01-01', () => {
    expect(MIN_SELECTABLE_DATE).toBe('2025-01-01')
  })

  it('applies date range only when Enter is pressed', () => {
    expect(shouldApplyDateRangeOnKey('Enter')).toBe(true)
    expect(shouldApplyDateRangeOnKey('Tab')).toBe(false)
    expect(shouldApplyDateRangeOnBlur()).toBe(true)
  })

  it('clamps preset-derived ranges to the minimum selectable date', () => {
    const presetRange = buildPresetRange('previous-month-last-year', new Date('2026-01-15T00:00:00'))

    expect(clampToSelectableDate(presetRange.start)).toBe('2025-01-01')
    expect(clampToSelectableDate(presetRange.end)).toBe('2025-01-01')
  })

  it('uses cleaned quick-select labels', () => {
    expect(presetLabel('last-week')).toBe('지난주')
    expect(presetLabel('previous-month-last-year')).toBe('작년 지난달')
  })
})
