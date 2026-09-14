<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search, X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    placeholder?: string
    /** Milliseconds to wait before emitting, so a listing is not re-queried on every keystroke. */
    debounce?: number
  }>(),
  { debounce: 350 },
)

const model = defineModel<string>({ default: '' })

/** The text being typed, kept separate so the debounce does not fight the input. */
const draft = ref(model.value)
let timer: number | undefined

watch(model, (value) => {
  if (value !== draft.value) draft.value = value
})

watch(draft, (value) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    model.value = value
  }, props.debounce)
})

function clear() {
  window.clearTimeout(timer)
  draft.value = ''
  model.value = ''
}
</script>

<template>
  <div class="relative">
    <Search
      class="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      aria-hidden="true"
    />
    <input
      v-model="draft"
      type="search"
      :placeholder="placeholder ?? $t('actions.search')"
      :aria-label="placeholder ?? $t('actions.search')"
      class="block w-full rounded-lg border-0 bg-white py-2 ps-9 pe-9 text-sm text-ink shadow-sm ring-1 ring-inset ring-line placeholder:text-muted focus:ring-2 focus:ring-inset focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
    />
    <button
      v-if="draft"
      type="button"
      class="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:text-ink dark:hover:text-slate-100"
      :aria-label="$t('actions.clearFilters')"
      @click="clear"
    >
      <X class="h-4 w-4" />
    </button>
  </div>
</template>
