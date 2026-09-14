<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Tailwind classes from the central status map - never styled ad hoc at the call site. */
    classes?: string
    /** A dot colour, so the badge does not rely on its background colour alone. */
    dot?: string
  }>(),
  { classes: '', dot: '' },
)
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
      classes,
    ]"
  >
    <span v-if="dot" :class="['h-1.5 w-1.5 rounded-full', dot]" aria-hidden="true" />
    <slot />
  </span>
</template>
