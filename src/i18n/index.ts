import { createI18n } from 'vue-i18n'

import ar from '@/locales/ar.json'
import en from '@/locales/en.json'

export const SUPPORTED_LOCALES = ['en', 'ar'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

/**
 * The culture each locale formats dates, numbers and currency with. These match the customer-facing
 * pages: Iraqi Arabic and US English, with the currency written the way each page already writes it.
 */
export const LOCALE_CULTURE: Record<AppLocale, string> = {
  en: 'en-US',
  ar: 'ar-IQ',
}

export const LOCALE_DIRECTION: Record<AppLocale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
}

export const LOCALE_LABEL: Record<AppLocale, string> = {
  en: 'English',
  ar: 'العربية',
}

const STORAGE_KEY = 'kyc.locale'

export function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * The locale to open with: the operator's last choice if they made one, otherwise whichever
 * supported language their browser asks for, otherwise English.
 *
 * Storage can throw in a locked-down browser, so every access is guarded - a preference that cannot
 * be read is not a reason to fail to start.
 */
export function readStoredLocale(): AppLocale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isSupportedLocale(stored)) return stored
  } catch {
    // Storage unavailable - fall through to the browser's preference.
  }

  for (const language of navigator.languages ?? []) {
    const base = language.split('-')[0]
    if (isSupportedLocale(base)) return base
  }

  return 'en'
}

export function persistLocale(locale: AppLocale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // A preference that cannot be saved is a minor loss, not an error worth surfacing.
  }
}

/** Applies the locale to the document so CSS logical properties resolve in the right direction. */
export function applyDocumentLocale(locale: AppLocale): void {
  document.documentElement.lang = locale
  document.documentElement.dir = LOCALE_DIRECTION[locale]
}

export const i18n = createI18n({
  legacy: false,
  locale: readStoredLocale(),
  fallbackLocale: 'en',
  messages: { en, ar },
  // The console is for staff; a missing key should be visible in development rather than silent.
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
})
