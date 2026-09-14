import { ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { PaginationMeta } from '@/api'
import { isCanceled } from '@/utils/errors'

/**
 * The plumbing every listing screen needs: filters mirrored into the URL, a fetch that cancels the
 * one before it, and loading/error state.
 *
 * ## Why the cancellation matters
 *
 * Typing in a search box starts a request per keystroke-batch. Those can complete out of order, and
 * a slow early response landing after a fast later one would leave the table showing results for a
 * query the operator has already moved on from. Each fetch aborts its predecessor, and a late
 * response is additionally ignored by sequence number - so the table always shows the newest query.
 *
 * ## Why the URL
 *
 * Filters live in the query string, so a filtered view survives a reload, can be shared with a
 * colleague, and responds to the browser's back button. Nothing sensitive is ever put there.
 */

export interface ListQueryOptions<TItem, TFilters extends Record<string, unknown>> {
  /** The filter defaults; also defines which keys are read from and written to the URL. */
  defaults: TFilters
  /** Runs the request. Must pass the signal through to the API call. */
  fetcher: (
    filters: TFilters,
    page: number,
    pageSize: number,
    signal: AbortSignal,
  ) => Promise<{ items: TItem[]; meta: PaginationMeta | null }>
  /** Rows per page before the operator changes it. */
  pageSize?: number
}

export function useListQuery<TItem, TFilters extends Record<string, unknown>>(
  options: ListQueryOptions<TItem, TFilters>,
) {
  const route = useRoute()
  const router = useRouter()

  const items = ref([]) as Ref<TItem[]>
  const meta = ref<PaginationMeta | null>(null)
  const loading = ref(true)
  const error = ref<unknown>(null)

  const filters = ref({ ...options.defaults }) as Ref<TFilters>
  const page = ref(1)
  const pageSize = ref(options.pageSize ?? 20)

  let controller: AbortController | null = null
  let sequence = 0

  /** Reads the filters back out of the URL, so a reload or a shared link restores the view. */
  function readFromRoute(): void {
    const query = route.query
    const next = { ...options.defaults } as Record<string, unknown>

    for (const key of Object.keys(options.defaults)) {
      const value = query[key]
      if (typeof value !== 'string' || value === '') continue

      const fallback = options.defaults[key]

      if (typeof fallback === 'number') {
        const parsed = Number(value)
        if (!Number.isNaN(parsed)) next[key] = parsed
      } else if (typeof fallback === 'boolean') {
        next[key] = value === 'true'
      } else {
        next[key] = value
      }
    }

    filters.value = next as TFilters

    const pageParam = Number(query.page)
    page.value = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

    const sizeParam = Number(query.pageSize)
    if (Number.isFinite(sizeParam) && sizeParam > 0) pageSize.value = sizeParam
  }

  /** Mirrors the current view into the URL without adding a history entry per keystroke. */
  function writeToRoute(): void {
    const query: Record<string, string> = {}

    for (const [key, value] of Object.entries(filters.value)) {
      if (value === undefined || value === null || value === '') continue
      if (value === options.defaults[key]) continue
      query[key] = String(value)
    }

    if (page.value > 1) query.page = String(page.value)
    if (pageSize.value !== (options.pageSize ?? 20)) query.pageSize = String(pageSize.value)

    void router.replace({ query })
  }

  async function load(): Promise<void> {
    controller?.abort()
    controller = new AbortController()

    const current = ++sequence

    loading.value = true
    error.value = null

    try {
      const result = await options.fetcher(
        filters.value,
        page.value,
        pageSize.value,
        controller.signal,
      )

      // A response from a superseded request must never replace newer results.
      if (current !== sequence) return

      items.value = result.items
      meta.value = result.meta
    } catch (caught) {
      if (current !== sequence || isCanceled(caught)) return
      error.value = caught
    } finally {
      if (current === sequence) loading.value = false
    }
  }

  function setPage(value: number): void {
    page.value = value
    writeToRoute()
    void load()
  }

  function setPageSize(value: number): void {
    pageSize.value = value
    page.value = 1
    writeToRoute()
    void load()
  }

  function resetFilters(): void {
    filters.value = { ...options.defaults }
    page.value = 1
    writeToRoute()
    void load()
  }

  // A filter change always returns to the first page: staying on page 7 of a result set that now
  // has two pages shows an empty table for no visible reason.
  watch(
    filters,
    () => {
      page.value = 1
      writeToRoute()
      void load()
    },
    { deep: true },
  )

  readFromRoute()
  void load()

  return {
    items,
    meta,
    loading,
    error,
    filters,
    page,
    pageSize,
    load,
    setPage,
    setPageSize,
    resetFilters,
  }
}
