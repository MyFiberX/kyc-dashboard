<script setup lang="ts">
import { ShieldOff } from 'lucide-vue-next'

import AppButton from '@/components/ui/AppButton.vue'
</script>

<template>
  <div class="flex flex-col items-center justify-center py-20 text-center">
    <div class="mb-4 rounded-full bg-accent-50 p-3 dark:bg-accent-500/10">
      <ShieldOff class="h-6 w-6 text-accent-600 dark:text-accent-300" aria-hidden="true" />
    </div>

    <h1 class="text-lg font-semibold text-ink dark:text-slate-100">
      {{ $t('errors.forbiddenTitle') }}
    </h1>
    <p class="mt-1 max-w-sm text-sm text-muted dark:text-slate-400">
      {{ $t('errors.forbiddenBody') }}
    </p>

    <AppButton class="mt-6" variant="primary" @click="$router.push({ name: 'dashboard' })">
      {{ $t('nav.dashboard') }}
    </AppButton>
  </div>
</template>
