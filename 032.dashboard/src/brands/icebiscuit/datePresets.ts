export type DateRangePreset = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'same-month-last-year' | 'previous-month-last-year'

export type DateRange = {
  start: string
  end: string
}

function toIsoDate(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0)
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeekMonday(value: Date) {
  const weekday = value.getDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  return addDays(new Date(value.getFullYear(), value.getMonth(), value.getDate()), diff)
}

export function clampDateRange(start: string, end: string): DateRange {
  if (!start || !end) {
    return { start, end }
  }

  return start <= end ? { start, end } : { start: end, end: start }
}

export function buildPresetRange(preset: DateRangePreset, anchor = new Date()): DateRange {
  const today = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())

  switch (preset) {
    case 'this-week': {
      const start = startOfWeekMonday(today)
      return { start: toIsoDate(start), end: toIsoDate(today) }
    }
    case 'last-week': {
      const thisWeekStart = startOfWeekMonday(today)
      const start = addDays(thisWeekStart, -7)
      const end = addDays(thisWeekStart, -1)
      return { start: toIsoDate(start), end: toIsoDate(end) }
    }
    case 'this-month': {
      const start = startOfMonth(today)
      return { start: toIsoDate(start), end: toIsoDate(today) }
    }
    case 'last-month': {
      const target = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return { start: toIsoDate(startOfMonth(target)), end: toIsoDate(endOfMonth(target)) }
    }
    case 'same-month-last-year': {
      const target = new Date(today.getFullYear() - 1, today.getMonth(), 1)
      return { start: toIsoDate(startOfMonth(target)), end: toIsoDate(endOfMonth(target)) }
    }
    case 'previous-month-last-year': {
      const target = new Date(today.getFullYear() - 1, today.getMonth() - 1, 1)
      return { start: toIsoDate(startOfMonth(target)), end: toIsoDate(endOfMonth(target)) }
    }
  }
}

export function presetLabel(preset: DateRangePreset) {
  switch (preset) {
    case 'this-week':
      return '이번주'
    case 'last-week':
      return '지난주'
    case 'this-month':
      return '이번달'
    case 'last-month':
      return '지난달'
    case 'same-month-last-year':
      return '작년 이번달'
    case 'previous-month-last-year':
      return '작년 지난달'
  }
}
