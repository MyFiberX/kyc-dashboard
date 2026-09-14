<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Number of placeholder rows to draw. */
    rows?: number
    /** Renders as table rows rather than blocks, so a loading table keeps its shape. */
    columns?: number
  }>(),
  { rows: 5, columns: 0 },
)
</script>

<template>
  <template v-if="columns > 0">
    <tr v-for="row in rows" :key="row" class="animate-pulse">
      <td v-for="column in columns" :key="column" class="border-t border-line px-4 py-3 dark:border-white/10">
        <div class="h-4 rounded bg-brand-100 dark:bg-white/10" />
      </td>
    </tr>
  </template>

  <div v-else class="space-y-3" role="status" :aria-label="$t('a11y.loading')">
    <div
      v-for="row in rows"
      :key="row"
      class="h-4 animate-pulse rounded bg-brand-100 dark:bg-white/10"
      :style="{ width: `${100 - row * 6}%` }"
    />
  </div>
</template>
