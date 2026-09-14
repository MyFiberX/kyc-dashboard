<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center bg-canvas p-6 text-center dark:bg-brand-950">
    <p class="numeric text-5xl font-semibold text-brand-300 dark:text-brand-700">404</p>
    <h1 class="mt-3 text-lg font-semibold text-ink dark:text-slate-100">
      {{ $t('errors.notFoundTitle') }}
    </h1>
    <p class="mt-1 max-w-sm text-sm text-muted dark:text-slate-400">{{ $t('errors.notFoundBody') }}</p>

    <AppButton class="mt-6" variant="primary" @click="$router.push({ name: 'dashboard' })">
      {{ $t('nav.dashboard') }}
    </AppButton>
  </div>
</template>
