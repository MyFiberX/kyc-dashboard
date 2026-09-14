<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, Copy, ShieldAlert } from 'lucide-vue-next'

import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useUiStore } from '@/stores/ui.store'

/**
 * Shows a freshly issued secret key, once.
 *
 * The value arrives as a prop, is rendered, and is dropped when the dialog closes. It is never
 * written to a store, to localStorage or sessionStorage, to the URL, or to a log - the backend
 * keeps only a hash, so this is genuinely the last time it can be read, and anywhere it were
 * persisted would become a place to steal it from.
 *
 * The dialog is deliberately not dismissible by clicking away or pressing Escape: closing it
 * destroys the only copy, so that has to be a decision rather than an accident.
 */
defineProps<{
  open: boolean
  secretKey: string
  keyPrefix: string
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const ui = useUiStore()
const acknowledged = ref(false)

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    ui.notify('success', t('actions.copied'))
  } catch {
    ui.notify('error', t('actions.copyFailed'))
  }
}

function close() {
  acknowledged.value = false
  emit('close')
}
</script>

<template>
  <AppModal
    :open="open"
    :title="$t('apiClients.secretTitle')"
    size="lg"
    :dismissible="false"
  >
    <div class="space-y-4">
      <p
        class="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <AlertTriangle class="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        {{ $t('apiClients.secretWarning') }}
      </p>

      <div>
        <span class="field-label">{{ $t('apiClients.keyPrefix') }}</span>
        <p class="numeric text-sm text-ink dark:text-slate-100">{{ keyPrefix }}</p>
      </div>

      <div>
        <span class="field-label">{{ $t('apiClients.client') }}</span>
        <div class="flex items-stretch gap-2">
          <code
            class="numeric min-w-0 flex-1 select-all break-all rounded-lg bg-canvas p-3 font-mono text-sm text-ink dark:bg-white/5 dark:text-slate-100"
          >{{ secretKey }}</code>
          <AppButton @click="copy(secretKey)">
            <Copy class="h-4 w-4" aria-hidden="true" />
            {{ $t('actions.copy') }}
          </AppButton>
        </div>
      </div>

      <p
        class="flex items-start gap-2 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-900 dark:bg-accent-500/10 dark:text-accent-200"
      >
        <ShieldAlert class="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        {{ $t('apiClients.secretServerSide') }}
      </p>

      <label class="flex items-start gap-2">
        <input
          v-model="acknowledged"
          type="checkbox"
          class="mt-0.5 h-4 w-4 rounded border-line text-brand-800 focus:ring-brand-600"
        />
        <span class="text-sm text-ink dark:text-slate-200">
          {{ $t('apiClients.secretAcknowledge') }}
        </span>
      </label>
    </div>

    <template #footer>
      <AppButton variant="primary" :disabled="!acknowledged" @click="close">
        {{ $t('actions.close') }}
      </AppButton>
    </template>
  </AppModal>
</template>
