<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info, Plus, RefreshCw } from 'lucide-vue-next'

import { subscriptionApi, type Subscription } from '@/api'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import { useListQuery } from '@/composables/useListQuery'
import { usePermissions } from '@/stores/permissions'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage, fieldErrors } from '@/utils/errors'
import { formatCurrency } from '@/utils/format'
import { ACTIVE_BADGE, INACTIVE_BADGE } from '@/utils/status'

const { t } = useI18n()
const ui = useUiStore()
const can = usePermissions()

const query = useListQuery({
  defaults: { search: '', isActive: '' as string },
  fetcher: (filters, page, pageSize, signal) =>
    subscriptionApi.getSubscriptions(
      {
        search: filters.search || undefined,
        isActive: filters.isActive === '' ? undefined : filters.isActive === 'true',
        page,
        pageSize,
      },
      signal,
    ),
})

const editing = ref<Subscription | null>(null)
const showForm = ref(false)
const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
const form = ref({ name: '', price: 0, isActive: true })

const confirmDelete = ref<Subscription | null>(null)
const deleting = ref(false)

function openCreate() {
  editing.value = null
  form.value = { name: '', price: 0, isActive: true }
  formErrors.value = {}
  showForm.value = true
}

function openEdit(plan: Subscription) {
  editing.value = plan
  form.value = { name: plan.name, price: plan.price, isActive: plan.isActive }
  formErrors.value = {}
  showForm.value = true
}

async function save() {
  formErrors.value = {}

  if (form.value.name.trim() === '') {
    formErrors.value = { name: t('validation.required') }
    return
  }

  const price = Number(form.value.price)
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
    formErrors.value = { price: t('validation.max', { max: 1000000 }) }
    return
  }

  saving.value = true

  try {
    if (editing.value === null) {
      await subscriptionApi.createSubscription({
        name: form.value.name.trim(),
        price,
        isActive: form.value.isActive,
      })
      ui.notify('success', t('subscriptions.created'))
    } else {
      // Partial: only the changed fields. Omitting price must not zero it, and omitting isActive
      // must not retire the plan - which is exactly what the backend documents.
      const patch: Record<string, unknown> = {}
      const original = editing.value

      if (form.value.name.trim() !== original.name) patch.name = form.value.name.trim()
      if (price !== original.price) patch.price = price
      if (form.value.isActive !== original.isActive) patch.isActive = form.value.isActive

      if (Object.keys(patch).length === 0) {
        showForm.value = false
        return
      }

      await subscriptionApi.updateSubscription(original.id, patch)
      ui.notify('success', t('subscriptions.updated'))
    }

    showForm.value = false
    await query.load()
  } catch (caught) {
    formErrors.value = fieldErrors(caught)
    ui.notify('error', errorMessage(caught, t))
  } finally {
    saving.value = false
  }
}

async function remove() {
  const plan = confirmDelete.value
  if (plan === null) return

  deleting.value = true

  try {
    await subscriptionApi.deleteSubscription(plan.id)
    ui.notify('success', t('subscriptions.deleted'))
    confirmDelete.value = null
    await query.load()
  } catch (caught) {
    ui.notify('error', errorMessage(caught, t))
    confirmDelete.value = null
  } finally {
    deleting.value = false
  }
}

const activeOptions = computed(() => [
  { value: 'true', label: t('subscriptions.isActive') },
  { value: 'false', label: t('apiClients.inactive') },
])
</script>

<template>
  <div>
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-ink dark:text-slate-100">
        {{ $t('subscriptions.title') }}
      </h1>

      <div class="flex items-center gap-2">
        <AppButton size="sm" :loading="query.loading.value" @click="query.load()">
          <RefreshCw class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('actions.refresh') }}</span>
        </AppButton>
        <AppButton
          v-if="can.canWriteSubscriptions.value"
          variant="primary"
          size="sm"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('subscriptions.create') }}</span>
        </AppButton>
      </div>
    </header>

    <!-- The rule that makes historical records trustworthy, stated where prices are edited. -->
    <p
      class="mb-4 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900 dark:bg-white/5 dark:text-slate-300"
    >
      <Info class="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
      {{ $t('subscriptions.priceHistoryNote') }}
    </p>

    <div class="card">
      <div class="flex flex-wrap items-center gap-2 p-3">
        <div class="min-w-0 flex-1 sm:max-w-sm">
          <SearchInput v-model="query.filters.value.search" />
        </div>
        <div class="w-40">
          <AppSelect
            v-model="query.filters.value.isActive"
            :options="activeOptions"
            :placeholder="$t('table.selectAll')"
          />
        </div>
      </div>

      <ErrorState
        v-if="query.error.value"
        :message="errorMessage(query.error.value, $t)"
        @retry="query.load()"
      />

      <template v-else>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">{{ $t('subscriptions.name') }}</th>
                <th scope="col">{{ $t('subscriptions.price') }}</th>
                <th scope="col">{{ $t('subscriptions.isActive') }}</th>
                <th v-if="can.canWriteSubscriptions.value" scope="col">
                  <span class="sr-only">{{ $t('table.actions') }}</span>
                </th>
              </tr>
            </thead>

            <tbody>
              <AppSkeleton v-if="query.loading.value" :rows="6" :columns="4" />

              <tr v-for="plan in query.items.value" v-else :key="plan.id">
                <td class="font-medium">{{ plan.name }}</td>
                <td class="numeric">{{ formatCurrency(plan.price, ui.locale) }}</td>
                <td>
                  <AppBadge :classes="plan.isActive ? ACTIVE_BADGE : INACTIVE_BADGE">
                    {{ plan.isActive ? $t('apiClients.active') : $t('apiClients.inactive') }}
                  </AppBadge>
                </td>
                <td v-if="can.canWriteSubscriptions.value">
                  <div class="flex items-center justify-end gap-1">
                    <AppButton size="sm" variant="ghost" @click="openEdit(plan)">
                      {{ $t('actions.edit') }}
                    </AppButton>
                    <AppButton size="sm" variant="ghost" @click="confirmDelete = plan">
                      {{ $t('actions.delete') }}
                    </AppButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <EmptyState
          v-if="!query.loading.value && query.items.value.length === 0"
          :title="$t('empty.subscriptions')"
          :hint="$t('empty.subscriptionsHint')"
        >
          <template #actions>
            <AppButton
              v-if="can.canWriteSubscriptions.value"
              variant="primary"
              size="sm"
              @click="openCreate"
            >
              {{ $t('subscriptions.create') }}
            </AppButton>
          </template>
        </EmptyState>

        <AppPagination
          v-if="query.items.value.length > 0"
          :meta="query.meta.value"
          :count="query.items.value.length"
          :disabled="query.loading.value"
          @update:page="query.setPage"
          @update:page-size="query.setPageSize"
        />
      </template>
    </div>

    <AppModal
      :open="showForm"
      :title="editing ? $t('subscriptions.edit') : $t('subscriptions.create')"
      @close="showForm = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <AppInput
          v-model="form.name"
          :label="$t('subscriptions.name')"
          :error="formErrors.name"
          :maxlength="100"
          required
        />

        <AppInput
          v-model="form.price"
          :label="$t('subscriptions.price')"
          :error="formErrors.price"
          type="number"
          :min="0"
          :max="1000000"
          step="0.01"
          numeric
          required
        />

        <label class="flex items-center gap-2">
          <input
            v-model="form.isActive"
            type="checkbox"
            class="h-4 w-4 rounded border-line text-brand-800 focus:ring-brand-600"
          />
          <span class="text-sm text-ink dark:text-slate-200">
            {{ $t('subscriptions.isActive') }}
          </span>
        </label>
      </form>

      <template #footer>
        <AppButton variant="ghost" :disabled="saving" @click="showForm = false">
          {{ $t('actions.cancel') }}
        </AppButton>
        <AppButton variant="primary" :loading="saving" @click="save">
          {{ $t('actions.save') }}
        </AppButton>
      </template>
    </AppModal>

    <ConfirmDialog
      :open="confirmDelete !== null"
      :title="$t('subscriptions.deleteConfirm')"
      :body="$t('subscriptions.deleteExplain')"
      :confirm-label="$t('actions.delete')"
      danger
      :loading="deleting"
      @confirm="remove"
      @cancel="confirmDelete = null"
    />
  </div>
</template>
