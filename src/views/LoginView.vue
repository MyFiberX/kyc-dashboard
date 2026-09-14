<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Globe } from 'lucide-vue-next'

import { ApiError } from '@/api'
import BrandLogo from '@/components/BrandLogo.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { LOCALE_LABEL, SUPPORTED_LOCALES, type AppLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage } from '@/utils/errors'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const username = ref('')
const password = ref('')
const error = ref('')

async function submit() {
  error.value = ''

  try {
    await auth.signIn({ username: username.value, password: password.value })

    // Land where they were headed before the guard intercepted them, if that was anywhere.
    const redirect = route.query.redirect
    await router.replace(typeof redirect === 'string' ? redirect : { name: 'dashboard' })
  } catch (caught) {
    // Every failure - unknown account, wrong password, deactivated, locked out - answers 401 with
    // one message, deliberately, so this endpoint cannot be used to discover which accounts exist.
    // The UI keeps that property by showing one message too.
    if (caught instanceof ApiError && caught.status === 401) {
      error.value = t('auth.invalidCredentials')
    } else if (caught instanceof ApiError && caught.status === 429) {
      error.value = t('auth.lockedOut')
    } else {
      error.value = errorMessage(caught, t)
    }

    password.value = ''
  }
}

function chooseLocale(locale: AppLocale) {
  ui.setLocale(locale)
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-canvas dark:bg-brand-950">
    <div class="flex flex-1 items-center justify-center p-4">
      <div class="w-full max-w-sm">
        <div class="mb-8 flex flex-col items-center gap-5">
          <!-- The brand mark on the purple ground it is designed for. -->
          <div class="rounded-2xl bg-brand-800 px-7 py-5 shadow-sm ring-1 ring-black/5">
            <BrandLogo class="!h-9 !max-w-[200px]" />
          </div>
          <div class="text-center">
            <h1 class="text-2xl font-semibold tracking-tight text-ink dark:text-slate-100">
              {{ $t('auth.signInTitle') }}
            </h1>
            <p class="mt-1.5 text-sm text-muted dark:text-slate-400">
              {{ $t('auth.signInSubtitle') }}
            </p>
          </div>
        </div>

        <form class="card space-y-5 p-6 sm:p-7" novalidate @submit.prevent="submit">
          <p
            v-if="error"
            class="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-300"
            role="alert"
          >
            {{ error }}
          </p>

          <AppInput
            v-model="username"
            :label="$t('auth.username')"
            autocomplete="username"
            required
          />

          <AppInput
            v-model="password"
            type="password"
            :label="$t('auth.password')"
            autocomplete="current-password"
            required
          />

          <AppButton type="submit" variant="primary" block :loading="auth.signingIn">
            {{ auth.signingIn ? $t('auth.signingIn') : $t('actions.signIn') }}
          </AppButton>
        </form>

        <div class="mt-6 flex items-center justify-center gap-1.5">
          <Globe class="h-4 w-4 text-muted dark:text-slate-400" aria-hidden="true" />
          <button
            v-for="option in SUPPORTED_LOCALES"
            :key="option"
            type="button"
            :class="[
              'rounded-lg px-3 py-1 text-sm transition-colors',
              ui.locale === option
                ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-white/10 dark:text-brand-200'
                : 'text-muted hover:bg-black/[0.03] hover:text-ink dark:hover:bg-white/5 dark:hover:text-slate-200',
            ]"
            :aria-current="ui.locale === option ? 'true' : undefined"
            @click="chooseLocale(option)"
          >
            {{ LOCALE_LABEL[option] }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
