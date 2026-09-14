import { describe, expect, it } from 'vitest'

import ar from '@/locales/ar.json'
import en from '@/locales/en.json'
import { LOCALE_CULTURE, LOCALE_DIRECTION, SUPPORTED_LOCALES } from '@/i18n'
import { formatCurrency, formatDate, formatNumber } from '@/utils/format'

/**
 * Localization has to be complete in both languages, or the console falls back to English mid-page
 * for an Arabic-speaking operator.
 */

type Tree = { [key: string]: string | Tree }

/** Every leaf key, flattened to "a.b.c", so the two files can be compared as sets. */
function keysOf(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return typeof value === 'string' ? [path] : keysOf(value, path)
  })
}

const englishKeys = keysOf(en as Tree).sort()
const arabicKeys = keysOf(ar as Tree).sort()

describe('translations', () => {
  it('covers every English key in Arabic', () => {
    const missing = englishKeys.filter((key) => !arabicKeys.includes(key))
    expect(missing).toEqual([])
  })

  it('has no Arabic key without an English counterpart', () => {
    const extra = arabicKeys.filter((key) => !englishKeys.includes(key))
    expect(extra).toEqual([])
  })

  it('leaves no message empty', () => {
    const values = (tree: Tree): string[] =>
      Object.values(tree).flatMap((value) => (typeof value === 'string' ? [value] : values(value)))

    expect(values(en as Tree).filter((value) => value.trim() === '')).toEqual([])
    expect(values(ar as Tree).filter((value) => value.trim() === '')).toEqual([])
  })

  it('actually translates the Arabic file rather than copying English through', () => {
    // A handful of load-bearing strings, checked for Arabic script.
    const arabic = /[؀-ۿ]/

    expect(ar.nav.dashboard).toMatch(arabic)
    expect(ar.kyc.title).toMatch(arabic)
    expect(ar.status.Completed).toMatch(arabic)
    expect(ar.apiClients.secretWarning).toMatch(arabic)
    expect(ar.errors[403]).toMatch(arabic)
  })

  it('keeps the status keys aligned with the backend enum names', () => {
    // These are wire values; renaming one here would silently break every badge.
    for (const status of ['Pending', 'NoAnswer', 'InProcess', 'Completed']) {
      expect(en.status).toHaveProperty(status)
      expect(ar.status).toHaveProperty(status)
    }
  })
})

describe('direction', () => {
  it('maps each locale to its writing direction', () => {
    expect(LOCALE_DIRECTION.en).toBe('ltr')
    expect(LOCALE_DIRECTION.ar).toBe('rtl')
  })

  it('uses the Iraqi Arabic and US English cultures the customer pages use', () => {
    expect(LOCALE_CULTURE.ar).toBe('ar-IQ')
    expect(LOCALE_CULTURE.en).toBe('en-US')
  })

  it('supports exactly the two locales the console ships', () => {
    expect([...SUPPORTED_LOCALES]).toEqual(['en', 'ar'])
  })
})

describe('formatting', () => {
  it('writes the currency the way each language writes it', () => {
    expect(formatCurrency(1200, 'en')).toContain('IQD')
    expect(formatCurrency(1200, 'ar')).toContain('د.ع')
  })

  it('formats numbers and dates per locale without throwing', () => {
    expect(formatNumber(1234567, 'en')).toBe('1,234,567')
    expect(formatNumber(1234567, 'ar')).not.toBe('')

    expect(formatDate('2026-03-12T10:00:00Z', 'en')).not.toBe('—')
    expect(formatDate('2026-03-12T10:00:00Z', 'ar')).not.toBe('—')
  })

  it('renders a missing or unparseable date as a dash rather than "Invalid Date"', () => {
    expect(formatDate(null, 'en')).toBe('—')
    expect(formatDate('', 'en')).toBe('—')
    expect(formatDate('not-a-date', 'en')).toBe('—')
  })
})
