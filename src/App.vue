<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import ToastHost from '@/components/ui/ToastHost.vue'
import { useUiStore } from '@/stores/ui.store'

const route = useRoute()
const { t, locale } = useI18n()
const ui = useUiStore()

// Keep vue-i18n and the document in step with the store's locale.
watch(
  () => ui.locale,
  (value) => {
    locale.value = value
  },
  { immediate: true },
)

// The document title names the page, so browser history and open tabs stay legible.
watch(
  [() => route.meta.titleKey, () => ui.locale],
  ([titleKey]) => {
    const name = t('app.name')
    document.title = typeof titleKey === 'string' ? `${t(titleKey)} · ${name}` : `${name} KYC`
  },
  { immediate: true },
)
</script>

<template>
  <RouterView />
  <ToastHost />
</template>
