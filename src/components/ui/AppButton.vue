<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit'
    disabled?: boolean
    /** Shows a spinner and blocks the click, so a submit cannot be fired twice. */
    loading?: boolean
    block?: boolean
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
    disabled: false,
    loading: false,
    block: false,
  },
)

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-800 text-white hover:bg-brand-700 active:bg-brand-900 disabled:hover:bg-brand-800',
  secondary:
    'bg-white text-ink ring-1 ring-inset ring-line hover:bg-brand-50 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15 dark:hover:bg-white/10',
  ghost:
    'text-ink hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-white/10',
  danger: 'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-50',
  VARIANTS[props.variant],
  SIZES[props.size],
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <svg
      v-if="loading"
      class="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
    <slot />
  </button>
</template>
