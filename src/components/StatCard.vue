<script setup lang="ts">
import type { FunctionalComponent } from 'vue'

defineProps<{
  label: string
  value: string
  icon?: FunctionalComponent
  /** A dot colour matching the status this tile counts, so it is not colour-coded by hue alone. */
  dot?: string
  loading?: boolean
}>()
</script>

<template>
  <div class="card p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="flex items-center gap-1.5 text-xs font-medium text-muted dark:text-slate-400">
          <span v-if="dot" :class="['h-1.5 w-1.5 flex-none rounded-full', dot]" aria-hidden="true" />
          <span class="truncate">{{ label }}</span>
        </p>

        <p
          v-if="loading"
          class="mt-2 h-7 w-20 animate-pulse rounded bg-brand-100 dark:bg-white/10"
        />
        <p v-else class="numeric mt-1 truncate text-2xl font-semibold text-ink dark:text-slate-100">
          {{ value }}
        </p>
      </div>

      <component
        :is="icon"
        v-if="icon"
        class="h-5 w-5 flex-none text-brand-400 dark:text-brand-300"
        aria-hidden="true"
      />
    </div>
  </div>
</template>
