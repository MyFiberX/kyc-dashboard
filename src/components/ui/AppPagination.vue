<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

import type { PaginationMeta } from '@/api'
import { useUiStore } from '@/stores/ui.store'
import { formatNumber } from '@/utils/format'

const props = defineProps<{
  meta: PaginationMeta | null
  /** Rows actually rendered, for the "showing x-y" line when there is no total. */
  count: number
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:page': [page: number]; 'update:pageSize': [size: number] }>()

const ui = useUiStore()

const page = computed(() => props.meta?.page ?? 1)
const pageSize = computed(() => props.meta?.pageSize ?? 20)
const totalCount = computed(() => props.meta?.totalCount ?? null)
const totalPages = computed(() => props.meta?.totalPages ?? null)

const from = computed(() => (props.count === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
const to = computed(() => (page.value - 1) * pageSize.value + props.count)

/**
 * The backend nulls totalCount when includeTotal=false, and on every cursor page. Null means "not
 * counted" - so the range is shown without a total rather than inventing one.
 */
const summary = computed(() => {
  const n = (value: number) => formatNumber(value, ui.locale)

  return totalCount.value !== null
    ? { key: 'table.showing', args: { from: n(from.value), to: n(to.value), total: n(totalCount.value) } }
    : { key: 'table.showingUnknown', args: { from: n(from.value), to: n(to.value) } }
})

const canGoPrevious = computed(() => page.value > 1 && props.disabled !== true)

/**
 * Without a total there is no last page to compare against, so "next" is offered whenever the page
 * came back full - a short page is the end of the data.
 */
const canGoNext = computed(() => {
  if (props.disabled === true) return false
  if (totalPages.value !== null) return page.value < totalPages.value
  return props.count >= pageSize.value
})

const PAGE_SIZES = [20, 50, 100, 200]
</script>

<template>
  <div
    class="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"
  >
    <p class="text-xs text-muted dark:text-slate-400">
      {{ $t(summary.key, summary.args) }}
    </p>

    <div class="flex items-center justify-between gap-4 sm:justify-end">
      <label class="flex items-center gap-2 text-xs text-muted dark:text-slate-400">
        <span class="hidden sm:inline">{{ $t('table.rowsPerPage') }}</span>
        <select
          :value="pageSize"
          class="rounded-lg border-0 bg-white py-1 ps-2 pe-7 text-xs text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
          :disabled="disabled"
          @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="rounded-lg p-1.5 text-muted transition-colors hover:bg-brand-50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-slate-100"
          :disabled="!canGoPrevious"
          :aria-label="$t('actions.previous')"
          @click="emit('update:page', page - 1)"
        >
          <!-- The chevron follows the writing direction, so "previous" always points backwards. -->
          <ChevronLeft class="h-4 w-4 rtl:hidden" />
          <ChevronRight class="hidden h-4 w-4 rtl:block" />
        </button>

        <span class="min-w-[5rem] text-center text-xs text-muted dark:text-slate-400">
          <template v-if="totalPages !== null">
            {{ formatNumber(page, ui.locale) }} {{ $t('table.of') }}
            {{ formatNumber(totalPages, ui.locale) }}
          </template>
          <template v-else>
            {{ $t('table.page', { page: formatNumber(page, ui.locale) }) }}
          </template>
        </span>

        <button
          type="button"
          class="rounded-lg p-1.5 text-muted transition-colors hover:bg-brand-50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-slate-100"
          :disabled="!canGoNext"
          :aria-label="$t('actions.next')"
          @click="emit('update:page', page + 1)"
        >
          <ChevronRight class="h-4 w-4 rtl:hidden" />
          <ChevronLeft class="hidden h-4 w-4 rtl:block" />
        </button>
      </div>
    </div>
  </div>
</template>
