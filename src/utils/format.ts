import { LOCALE_CULTURE, type AppLocale } from '@/i18n'

/**
 * Locale-aware formatting, built on Intl rather than string concatenation.
 *
 * The currency is Iraqi dinar, written as the customer-facing pages write it: "IQD" in English and
 * "د.ع" in Arabic. Intl's own currency display for IQD does not match that house style, so the
 * number is formatted by Intl and the symbol appended - which also keeps the two surfaces
 * consistent with each other.
 */

const CURRENCY_SYMBOL: Record<AppLocale, string> = {
  en: 'IQD',
  ar: 'د.ع',
}

function culture(locale: AppLocale): string {
  return LOCALE_CULTURE[locale]
}

/** A whole number - counts, totals. */
export function formatNumber(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(culture(locale)).format(value)
}

/** Money. Fractional digits appear only when the amount actually has them. */
export function formatCurrency(value: number, locale: AppLocale): string {
  const amount = new Intl.NumberFormat(culture(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)

  return locale === 'ar' ? `${amount} ${CURRENCY_SYMBOL.ar}` : `${amount} ${CURRENCY_SYMBOL.en}`
}

/**
 * A compact figure for dashboard tiles, where a full number would not fit. Falls back to the plain
 * number where the runtime has no compact notation.
 */
export function formatCompact(value: number, locale: AppLocale): string {
  try {
    return new Intl.NumberFormat(culture(locale), {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return formatNumber(value, locale)
  }
}

export function formatPercent(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(culture(locale), {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * The backend sends UTC timestamps. `Date` parses them and the browser renders them in the
 * operator's own timezone, which is what an operator expects to read.
 */
function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

/** Date only - "12 March 2026". */
export function formatDate(value: string | Date | null | undefined, locale: AppLocale): string {
  const date = toDate(value)
  if (date === null) return '—'

  return new Intl.DateTimeFormat(culture(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/** Date and time, for audit trails and record metadata. */
export function formatDateTime(value: string | Date | null | undefined, locale: AppLocale): string {
  const date = toDate(value)
  if (date === null) return '—'

  return new Intl.DateTimeFormat(culture(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Compact date for dense table cells. */
export function formatDateShort(value: string | Date | null | undefined, locale: AppLocale): string {
  const date = toDate(value)
  if (date === null) return '—'

  return new Intl.DateTimeFormat(culture(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

/** "3 days ago" / "منذ ٣ أيام" for a last-used or last-login column. */
export function formatRelative(value: string | Date | null | undefined, locale: AppLocale): string {
  const date = toDate(value)
  if (date === null) return '—'

  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(culture(locale), { numeric: 'auto' })

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ]

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit)
    }
  }

  return formatter.format(seconds, 'second')
}

/**
 * A date for an `<input type="date">`, which requires YYYY-MM-DD in local time regardless of
 * locale. Built from the local parts rather than toISOString, which would shift the day for
 * anyone east or west of UTC.
 */
export function toDateInputValue(value: Date): string {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

/** Turns a date input's value into the UTC instant the API expects for a range's start. */
export function startOfDayIso(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString()
}

/** The same for a range's end, inclusive of the whole day. */
export function endOfDayIso(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString()
}

/** Days between two ISO instants, for holding a range inside the backend's limit. */
export function daysBetween(from: string, to: string): number {
  return Math.abs(new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
}
