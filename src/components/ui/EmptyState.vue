<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'

defineProps<{
  title: string
  hint?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div class="mb-4 rounded-full bg-brand-50 p-3 dark:bg-white/5">
      <slot name="icon">
        <Inbox class="h-6 w-6 text-brand-600 dark:text-brand-300" aria-hidden="true" />
      </slot>
    </div>

    <h3 class="text-sm font-semibold text-ink dark:text-slate-100">{{ title }}</h3>
    <p v-if="hint" class="mt-1 max-w-sm text-sm text-muted dark:text-slate-400">{{ hint }}</p>

    <div v-if="$slots.actions" class="mt-5 flex flex-wrap items-center justify-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
