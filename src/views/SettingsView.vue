<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { LOCALE_LABEL, SUPPORTED_LOCALES, type AppLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage, fieldErrors } from '@/utils/errors'
import { formatDateTime } from '@/utils/format'
import type { Theme } from '@/stores/ui.store'

const { t } = useI18n()
const ui = useUiStore()
const auth = useAuthStore()
const router = useRouter()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const errors = ref<Record<string, string>>({})
const saving = ref(false)

const THEMES: { value: Theme; labelKey: string }[] = [
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'system', labelKey: 'settings.themeSystem' },
]

async function changePassword() {
  errors.value = {}

  const found: Record<string, string> = {}
  if (currentPassword.value === '') found.currentPassword = t('validation.required')
  if (newPassword.value.length < 12) found.newPassword = t('auth.passwordPolicy')
  if (newPassword.value !== confirmPassword.value) {
    found.confirmPassword = t('auth.passwordMismatch')
  }

  if (Object.keys(found).length > 0) {
    errors.value = found
    return
  }

  saving.value = true

  try {
    await auth.changePassword(currentPassword.value, newPassword.value)

    // The backend rolls the security stamp, invalidating every token already issued - so the
    // session really is over and signing in again is the only honest next step.
    ui.notify('success', t('auth.passwordChanged'))
    await router.push({ name: 'login' })
  } catch (caught) {
    errors.value = fieldErrors(caught)
    ui.notify('error', errorMessage(caught, t))
  } finally {
    saving.value = false
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  }
}

function chooseLocale(locale: AppLocale) {
  ui.setLocale(locale)
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="mb-4 text-xl font-semibold text-ink dark:text-slate-100">{{ $t('settings.title') }}</h1>

    <!-- Account -->
    <section class="card mb-4 p-4">
      <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
        {{ $t('settings.account') }}
      </h2>

      <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div>
          <dt class="text-xs text-muted dark:text-slate-400">{{ $t('auth.username') }}</dt>
          <dd class="text-sm text-ink dark:text-slate-100">{{ auth.profile?.username }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted dark:text-slate-400">{{ $t('operators.email') }}</dt>
          <dd class="truncate text-sm text-ink dark:text-slate-100">{{ auth.profile?.email }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted dark:text-slate-400">{{ $t('auth.role') }}</dt>
          <dd class="text-sm text-ink dark:text-slate-100">
            {{
              auth.profile?.role === 'SuperAdmin'
                ? $t('operators.roleSuperAdmin')
                : $t('operators.roleAdmin')
            }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted dark:text-slate-400">{{ $t('auth.lastLogin') }}</dt>
          <dd class="text-sm text-ink dark:text-slate-100">
            {{
              auth.profile?.lastLoginAt
                ? formatDateTime(auth.profile.lastLoginAt, ui.locale)
                : $t('auth.never')
            }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- Appearance -->
    <section class="card mb-4 p-4">
      <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
        {{ $t('settings.appearance') }}
      </h2>

      <div class="mb-4">
        <span class="field-label">{{ $t('settings.language') }}</span>
        <div class="flex flex-wrap gap-2">
          <AppButton
            v-for="option in SUPPORTED_LOCALES"
            :key="option"
            size="sm"
            :variant="ui.locale === option ? 'primary' : 'secondary'"
            @click="chooseLocale(option)"
          >
            {{ LOCALE_LABEL[option] }}
          </AppButton>
        </div>
      </div>

      <div>
        <span class="field-label">{{ $t('settings.theme') }}</span>
        <div class="flex flex-wrap gap-2">
          <AppButton
            v-for="option in THEMES"
            :key="option.value"
            size="sm"
            :variant="ui.theme === option.value ? 'primary' : 'secondary'"
            @click="ui.setTheme(option.value)"
          >
            {{ $t(option.labelKey) }}
          </AppButton>
        </div>
      </div>
    </section>

    <!-- Security -->
    <section class="card p-4">
      <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
        {{ $t('settings.security') }}
      </h2>

      <form class="space-y-4" novalidate @submit.prevent="changePassword">
        <AppInput
          v-model="currentPassword"
          type="password"
          :label="$t('auth.currentPassword')"
          :error="errors.currentPassword"
          autocomplete="current-password"
          required
        />

        <AppInput
          v-model="newPassword"
          type="password"
          :label="$t('auth.newPassword')"
          :hint="$t('auth.passwordPolicy')"
          :error="errors.newPassword"
          autocomplete="new-password"
          required
        />

        <AppInput
          v-model="confirmPassword"
          type="password"
          :label="$t('auth.confirmPassword')"
          :error="errors.confirmPassword"
          autocomplete="new-password"
          required
        />

        <AppButton type="submit" variant="primary" :loading="saving">
          {{ $t('auth.changePassword') }}
        </AppButton>
      </form>
    </section>
  </div>
</template>
