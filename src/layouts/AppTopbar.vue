<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ChevronDown, Globe, LogOut, Menu, Moon, PanelLeft, Sun, User } from 'lucide-vue-next'
import { onClickOutside } from '@/composables/useClickOutside'

import { LOCALE_LABEL, SUPPORTED_LOCALES, type AppLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const { t } = useI18n()

const languageOpen = ref(false)
const userOpen = ref(false)

const languageMenu = ref<HTMLElement | null>(null)
const userMenu = ref<HTMLElement | null>(null)

onClickOutside(languageMenu, () => (languageOpen.value = false))
onClickOutside(userMenu, () => (userOpen.value = false))

const initials = computed(() => auth.profile?.username.slice(0, 2).toUpperCase() ?? '')

const roleLabel = computed(() =>
  auth.profile?.role === 'SuperAdmin' ? t('operators.roleSuperAdmin') : t('operators.roleAdmin'),
)

function chooseLocale(locale: AppLocale) {
  ui.setLocale(locale)
  languageOpen.value = false
}

async function signOut() {
  userOpen.value = false
  await auth.signOut()
  ui.notify('info', t('auth.signedOut'))
  await router.push({ name: 'login' })
}
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-16 flex-none items-center gap-2 border-b border-line bg-white/90 px-4 backdrop-blur dark:border-white/10 dark:bg-brand-950/90"
  >
    <!-- Mobile: opens the drawer. Desktop: collapses the rail. -->
    <button
      type="button"
      class="rounded-lg p-2 text-muted transition-colors hover:bg-brand-50 hover:text-ink lg:hidden dark:hover:bg-white/10 dark:hover:text-slate-100"
      :aria-label="$t('a11y.openMenu')"
      @click="ui.toggleSidebar()"
    >
      <Menu class="h-5 w-5" />
    </button>

    <button
      type="button"
      class="hidden rounded-lg p-2 text-muted transition-colors hover:bg-brand-50 hover:text-ink lg:block dark:hover:bg-white/10 dark:hover:text-slate-100"
      :aria-label="$t('a11y.toggleSidebar')"
      @click="ui.toggleSidebarCollapsed()"
    >
      <PanelLeft class="h-5 w-5 rtl:-scale-x-100" />
    </button>

    <div class="flex-1" />

    <!-- Theme -->
    <button
      type="button"
      class="rounded-lg p-2 text-muted transition-colors hover:bg-brand-50 hover:text-ink dark:hover:bg-white/10 dark:hover:text-slate-100"
      :aria-label="$t('a11y.themeToggle')"
      @click="ui.setTheme(ui.isDark ? 'light' : 'dark')"
    >
      <Sun v-if="ui.isDark" class="h-5 w-5" />
      <Moon v-else class="h-5 w-5" />
    </button>

    <!-- Language -->
    <div ref="languageMenu" class="relative">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg p-2 text-muted transition-colors hover:bg-brand-50 hover:text-ink dark:hover:bg-white/10 dark:hover:text-slate-100"
        :aria-label="$t('a11y.languageMenu')"
        :aria-expanded="languageOpen"
        aria-haspopup="menu"
        @click="languageOpen = !languageOpen"
      >
        <Globe class="h-5 w-5" />
        <span class="hidden text-sm font-medium sm:inline">{{ LOCALE_LABEL[ui.locale] }}</span>
      </button>

      <div
        v-if="languageOpen"
        role="menu"
        class="absolute end-0 z-40 mt-1 w-40 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-line dark:bg-brand-950 dark:ring-white/10"
      >
        <button
          v-for="option in SUPPORTED_LOCALES"
          :key="option"
          type="button"
          role="menuitemradio"
          :aria-checked="ui.locale === option"
          :class="[
            'block w-full px-3 py-2 text-start text-sm transition-colors',
            ui.locale === option
              ? 'bg-brand-50 font-medium text-brand-800 dark:bg-white/10 dark:text-white'
              : 'text-ink hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-white/10',
          ]"
          @click="chooseLocale(option)"
        >
          {{ LOCALE_LABEL[option] }}
        </button>
      </div>
    </div>

    <!-- Account -->
    <div ref="userMenu" class="relative">
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-brand-50 dark:hover:bg-white/10"
        :aria-label="$t('a11y.userMenu')"
        :aria-expanded="userOpen"
        aria-haspopup="menu"
        @click="userOpen = !userOpen"
      >
        <span
          class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-800 text-xs font-semibold text-white"
          aria-hidden="true"
        >
          {{ initials }}
        </span>
        <span class="hidden text-start sm:block">
          <span class="block text-sm font-medium leading-tight text-ink dark:text-slate-100">
            {{ auth.profile?.username }}
          </span>
          <span class="block text-xs leading-tight text-muted dark:text-slate-400">
            {{ roleLabel }}
          </span>
        </span>
        <ChevronDown class="hidden h-4 w-4 text-muted sm:block" aria-hidden="true" />
      </button>

      <div
        v-if="userOpen"
        role="menu"
        class="absolute end-0 z-40 mt-1 w-56 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-line dark:bg-brand-950 dark:ring-white/10"
      >
        <div class="border-b border-line px-3 py-2 dark:border-white/10">
          <p class="truncate text-sm font-medium text-ink dark:text-slate-100">
            {{ auth.profile?.username }}
          </p>
          <p class="truncate text-xs text-muted dark:text-slate-400">{{ auth.profile?.email }}</p>
        </div>

        <RouterLink
          :to="{ name: 'settings' }"
          role="menuitem"
          class="flex items-center gap-2 px-3 py-2 text-sm text-ink transition-colors hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-white/10"
          @click="userOpen = false"
        >
          <User class="h-4 w-4" aria-hidden="true" />
          {{ $t('auth.profile') }}
        </RouterLink>

        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-accent-700 transition-colors hover:bg-accent-50 dark:text-accent-300 dark:hover:bg-accent-500/10"
          @click="signOut"
        >
          <LogOut class="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          {{ $t('actions.signOut') }}
        </button>
      </div>
    </div>
  </header>
</template>
