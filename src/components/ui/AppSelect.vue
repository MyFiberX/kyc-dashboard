<script setup lang="ts">
import { computed, useId } from 'vue'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    options: SelectOption[]
    label?: string
    hint?: string
    error?: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
  }>(),
  { required: false, disabled: false },
)

const model = defineModel<string | null>()

const id = useId()
const describedBy = computed(() => {
  const ids: string[] = []
  if (props.hint !== undefined && props.hint !== '') ids.push(`${id}-hint`)
  if (props.error !== undefined && props.error !== '') ids.push(`${id}-error`)
  return ids.length > 0 ? ids.join(' ') : undefined
})
</script>

<template>
  <div>
    <label v-if="label" :for="id" class="field-label">
      {{ label }}
      <span v-if="required" class="text-accent-600" :aria-label="$t('a11y.required')">*</span>
    </label>

    <select
      :id="id"
      v-model="model"
      :required="required"
      :disabled="disabled"
      :aria-invalid="error !== undefined && error !== ''"
      :aria-describedby="describedBy"
      :class="[
        'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink shadow-sm ring-1 ring-inset',
        'focus:ring-2 focus:ring-inset disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted',
        'dark:bg-white/5 dark:text-slate-100 dark:disabled:bg-white/[0.02]',
        error ? 'ring-accent-500 focus:ring-accent-600' : 'ring-line focus:ring-brand-600 dark:ring-white/15',
      ]"
    >
      <option v-if="placeholder" :value="null">{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>

    <p v-if="hint && !error" :id="`${id}-hint`" class="field-hint">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="field-error">{{ error }}</p>
  </div>
</template>
