export const MIN_SELECTABLE_DATE = '2025-01-01'

export function clampToSelectableDate(value: string) {
  if (!value) return value
  return value < MIN_SELECTABLE_DATE ? MIN_SELECTABLE_DATE : value
}

export function shouldApplyDateRangeOnKey(key: string) {
  return key === 'Enter'
}

export function shouldApplyDateRangeOnBlur() {
  return true
}
