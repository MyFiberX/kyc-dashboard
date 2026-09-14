import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { applyDocumentLocale, isSupportedLocale, persistLocale, type AppLocale } from '@/i18n'

export type Theme = 'light' | 'dark' | 'system'

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
}

const THEME_KEY = 'kyc.theme'

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Storage unavailable; the system default is a fine starting point.
  }

  return 'system'
}

/** Shell state: theme, the mobile drawer, the language, and the toast queue. */
export const useUiStore = defineStore('ui', () => {
  const theme = ref<Theme>(readStoredTheme())
  const sidebarOpen = ref(false)
  const sidebarCollapsed = ref(false)
  const locale = ref<AppLocale>('en')
  const toasts = ref<Toast[]>([])

  let nextToastId = 1

  const isDark = computed(() => {
    if (theme.value === 'dark') return true
    if (theme.value === 'light') return false

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  function applyTheme(): void {
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  function setTheme(value: Theme): void {
    theme.value = value

    try {
      window.localStorage.setItem(THEME_KEY, value)
    } catch {
      // Preference not saved; the session still honours the choice.
    }

    applyTheme()
  }

  function setLocale(value: AppLocale): void {
    locale.value = value
    persistLocale(value)
    applyDocumentLocale(value)
  }

  function initialize(startingLocale: string): void {
    setLocale(isSupportedLocale(startingLocale) ? startingLocale : 'en')
    applyTheme()

    // Follow the system while the operator has not chosen a theme explicitly.
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (theme.value === 'system') applyTheme()
      })
  }

  function toggleSidebar(): void {
    sidebarOpen.value = !sidebarOpen.value
  }

  function closeSidebar(): void {
    sidebarOpen.value = false
  }

  function toggleSidebarCollapsed(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function notify(kind: Toast['kind'], message: string): void {
    const id = nextToastId++
    toasts.value.push({ id, kind, message })

    window.setTimeout(() => dismiss(id), 6000)
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return {
    theme,
    isDark,
    sidebarOpen,
    sidebarCollapsed,
    locale,
    toasts,
    initialize,
    setTheme,
    setLocale,
    toggleSidebar,
    closeSidebar,
    toggleSidebarCollapsed,
    notify,
    dismiss,
  }
})
