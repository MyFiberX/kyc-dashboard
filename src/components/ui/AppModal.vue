<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** Wider dialogs for forms; the default suits a confirmation. */
    size?: 'sm' | 'md' | 'lg'
    /** A destructive confirmation should not be dismissible by a stray click outside. */
    dismissible?: boolean
  }>(),
  { size: 'md', dismissible: true },
)

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
/** The element focus came from, so it can be handed back when the dialog closes. */
let previouslyFocused: HTMLElement | null = null

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
}

function close() {
  if (props.dismissible) emit('close')
}

/** Keeps Tab inside the dialog, which is what makes it a dialog rather than a floating div. */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()
    return
  }

  if (event.key !== 'Tab' || panel.value === null) return

  const focusable = panel.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )

  if (focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (first === undefined || last === undefined) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKeydown)

      // Move focus into the dialog once it exists, so a screen reader announces it and the
      // keyboard is already inside.
      await Promise.resolve()
      panel.value?.querySelector<HTMLElement>('[autofocus], button, input, select')?.focus()
    } else {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeydown)
      previouslyFocused?.focus()
      previouslyFocused = null
    }
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div class="fixed inset-0 bg-brand-950/50 backdrop-blur-sm" @click="close" />

        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          :class="[
            'relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-card',
            'dark:bg-brand-950 dark:ring-1 dark:ring-white/10',
            SIZES[size],
          ]"
        >
          <header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4 dark:border-white/10">
            <h2 class="text-base font-semibold text-ink dark:text-slate-100">{{ title }}</h2>
            <button
              v-if="dismissible"
              type="button"
              class="-me-1 rounded-lg p-1 text-muted transition-colors hover:bg-brand-50 hover:text-ink dark:hover:bg-white/10 dark:hover:text-slate-100"
              :aria-label="$t('actions.close')"
              @click="close"
            >
              <X class="h-5 w-5" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto px-5 py-4">
            <slot />
          </div>

          <footer
            v-if="$slots.footer"
            class="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas px-5 py-3 dark:border-white/10 dark:bg-white/[0.02]"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
