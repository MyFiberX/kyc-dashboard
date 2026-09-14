<script setup lang="ts">
import AppButton from './AppButton.vue'
import AppModal from './AppModal.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** Says exactly what will happen, per the rule that a destructive action explains itself. */
    body: string
    confirmLabel: string
    danger?: boolean
    loading?: boolean
  }>(),
  { danger: false, loading: false },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <AppModal
    :open="open"
    :title="title"
    size="sm"
    :dismissible="!loading"
    @close="emit('cancel')"
  >
    <p class="text-sm leading-relaxed text-muted dark:text-slate-300">{{ body }}</p>

    <template #footer>
      <AppButton variant="ghost" :disabled="loading" @click="emit('cancel')">
        {{ $t('actions.cancel') }}
      </AppButton>
      <AppButton
        :variant="danger ? 'danger' : 'primary'"
        :loading="loading"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </AppButton>
    </template>
  </AppModal>
</template>
