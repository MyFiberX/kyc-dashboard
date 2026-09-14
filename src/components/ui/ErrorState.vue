<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'

import AppButton from './AppButton.vue'

defineProps<{
  message: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-12 text-center" role="alert">
    <div class="mb-3 rounded-full bg-accent-50 p-3 dark:bg-accent-500/10">
      <AlertTriangle class="h-6 w-6 text-accent-600 dark:text-accent-300" aria-hidden="true" />
    </div>

    <h3 class="text-sm font-semibold text-ink dark:text-slate-100">{{ $t('errors.title') }}</h3>
    <p class="mt-1 max-w-sm text-sm text-muted dark:text-slate-400">{{ message }}</p>

    <AppButton class="mt-5" size="sm" @click="emit('retry')">{{ $t('actions.retry') }}</AppButton>
  </div>
</template>
