<script setup lang="ts">
import { CheckCircle2, Info, X, XCircle } from 'lucide-vue-next'

import { useUiStore } from '@/stores/ui.store'

const ui = useUiStore()

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const STYLES = {
  success: 'ring-emerald-600/20 text-emerald-700 dark:text-emerald-300',
  error: 'ring-accent-600/20 text-accent-700 dark:text-accent-300',
  info: 'ring-brand-600/20 text-brand-700 dark:text-brand-200',
}
</script>

<template>
  <!-- Announced politely: a toast is useful to a screen reader but must not interrupt typing. -->
  <div
    class="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-full max-w-sm flex-col gap-2"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        :class="[
          'pointer-events-auto flex items-start gap-3 rounded-lg bg-white p-3 shadow-lg ring-1',
          'dark:bg-brand-950 dark:ring-white/10',
          STYLES[toast.kind],
        ]"
      >
        <component :is="ICONS[toast.kind]" class="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
        <p class="flex-1 text-sm text-ink dark:text-slate-100">{{ toast.message }}</p>
        <button
          type="button"
          class="-me-1 -mt-1 rounded p-1 text-muted transition-colors hover:text-ink dark:hover:text-slate-100"
          :aria-label="$t('actions.close')"
          @click="ui.dismiss(toast.id)"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
