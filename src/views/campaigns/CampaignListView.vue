<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, RefreshCw } from 'lucide-vue-next'

import { campaignApi, type Campaign } from '@/api'
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
import { errorMessage, fieldErrors, isConflict } from '@/utils/errors'
import { formatDateShort, formatNumber, toDateInputValue } from '@/utils/format'
import { ACTIVE_BADGE, INACTIVE_BADGE } from '@/utils/status'

const { t } = useI18n()
const ui = useUiStore()
const can = usePermissions()

const query = useListQuery({
  defaults: { search: '', isActive: '' as string },
  fetcher: (filters, page, pageSize, signal) =>
    campaignApi.getCampaigns(
      {
        search: filters.search || undefined,
        isActive: filters.isActive === '' ? undefined : filters.isActive === 'true',
        page,
        pageSize,
      },
      signal,
    ),
})

// --- Create / edit ---------------------------------------------------------

const editing = ref<Campaign | null>(null)
const showForm = ref(false)
const saving = ref(false)
const formErrors = ref<Record<string, string>>({})

const form = ref({
  name: '',
  description: '',
  startDate: toDateInputValue(new Date()),
  endDate: '',
  isActive: true,
})

function openCreate() {
  editing.value = null
  form.value = {
    name: '',
    description: '',
    startDate: toDateInputValue(new Date()),
    endDate: '',
    isActive: true,
  }
  formErrors.value = {}
  showForm.value = true
}

function openEdit(campaign: Campaign) {
  editing.value = campaign
  form.value = {
    name: campaign.name,
    description: campaign.description ?? '',
    startDate: toDateInputValue(new Date(campaign.startDate)),
    endDate: campaign.endDate !== null ? toDateInputValue(new Date(campaign.endDate)) : '',
    isActive: campaign.isActive,
  }
  formErrors.value = {}
  showForm.value = true
}

async function save() {
  formErrors.value = {}

  if (form.value.name.trim() === '') {
    formErrors.value = { name: t('validation.required') }
    return
  }

  if (form.value.endDate !== '' && form.value.endDate < form.value.startDate) {
    formErrors.value = { endDate: t('validation.endBeforeStart') }
    return
  }

  saving.value = true

  try {
    if (editing.value === null) {
      // The code is not sent: the backend issues one with the campaign.
      await campaignApi.createCampaign({
        name: form.value.name.trim(),
        description: form.value.description.trim() === '' ? null : form.value.description.trim(),
        startDate: new Date(form.value.startDate).toISOString(),
        endDate: form.value.endDate === '' ? null : new Date(form.value.endDate).toISOString(),
        isActive: form.value.isActive,
      })
      ui.notify('success', t('campaigns.created'))
    } else {
      // A partial update carrying only what actually changed. Sending an unchanged field would be
      // harmless here, but an omitted one is how the backend is told to leave a value alone - and
      // description/endDate use null to mean "clear it", which is a distinction worth respecting.
      const patch: Record<string, unknown> = {}
      const original = editing.value

      if (form.value.name.trim() !== original.name) patch.name = form.value.name.trim()

      const description = form.value.description.trim() === '' ? null : form.value.description.trim()
      if (description !== (original.description ?? null)) patch.description = description

      const startDate = new Date(form.value.startDate).toISOString()
      if (toDateInputValue(new Date(startDate)) !== toDateInputValue(new Date(original.startDate))) {
        patch.startDate = startDate
      }

      const endDate = form.value.endDate === '' ? null : new Date(form.value.endDate).toISOString()
      const originalEnd = original.endDate === null ? null : original.endDate
      if ((endDate === null) !== (originalEnd === null) ||
          (endDate !== null && originalEnd !== null &&
           toDateInputValue(new Date(endDate)) !== toDateInputValue(new Date(originalEnd)))) {
        patch.endDate = endDate
      }

      if (form.value.isActive !== original.isActive) patch.isActive = form.value.isActive

      if (Object.keys(patch).length === 0) {
        showForm.value = false
        return
      }

      await campaignApi.updateCampaign(original.id, patch)
      ui.notify('success', t('campaigns.updated'))
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

// --- Row actions -----------------------------------------------------------

const busyId = ref<string | null>(null)
const confirmDeactivate = ref<Campaign | null>(null)
const confirmDelete = ref<Campaign | null>(null)
const actionPending = ref(false)

async function setActive(campaign: Campaign, active: boolean) {
  busyId.value = campaign.id

  try {
    if (active) {
      await campaignApi.activateCampaign(campaign.id)
      ui.notify('success', t('campaigns.activated'))
    } else {
      await campaignApi.deactivateCampaign(campaign.id)
      ui.notify('success', t('campaigns.deactivated'))
    }

    confirmDeactivate.value = null
    await query.load()
  } catch (caught) {
    ui.notify('error', errorMessage(caught, t))
  } finally {
    busyId.value = null
  }
}

async function remove() {
  const campaign = confirmDelete.value
  if (campaign === null) return

  actionPending.value = true

  try {
    await campaignApi.deleteCampaign(campaign.id)
    ui.notify('success', t('campaigns.deleted'))
    confirmDelete.value = null
    await query.load()
  } catch (caught) {
    // 409 here has one meaning the operator can act on: records are attributed to it, so
    // deactivation is the right move instead.
    ui.notify('error', isConflict(caught) ? t('campaigns.hasRecords') : errorMessage(caught, t))
    confirmDelete.value = null
  } finally {
    actionPending.value = false
  }
}

const activeOptions = computed(() => [
  { value: 'true', label: t('campaigns.isActive') },
  { value: 'false', label: t('apiClients.inactive') },
])
</script>

<template>
  <div>
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-ink dark:text-slate-100">{{ $t('campaigns.title') }}</h1>

      <div class="flex items-center gap-2">
        <AppButton size="sm" :loading="query.loading.value" @click="query.load()">
          <RefreshCw class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('actions.refresh') }}</span>
        </AppButton>
        <AppButton v-if="can.canWriteCampaigns.value" variant="primary" size="sm" @click="openCreate">
          <Plus class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('campaigns.create') }}</span>
        </AppButton>
      </div>
    </header>

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
                <th scope="col">{{ $t('campaigns.name') }}</th>
                <th scope="col">{{ $t('campaigns.code') }}</th>
                <th scope="col">{{ $t('campaigns.startDate') }}</th>
                <th scope="col">{{ $t('campaigns.endDate') }}</th>
                <th scope="col">{{ $t('campaigns.kycCount') }}</th>
                <th scope="col">{{ $t('campaigns.isActive') }}</th>
                <th v-if="can.canWriteCampaigns.value" scope="col">
                  <span class="sr-only">{{ $t('table.actions') }}</span>
                </th>
              </tr>
            </thead>

            <tbody>
              <AppSkeleton v-if="query.loading.value" :rows="6" :columns="7" />

              <tr v-for="campaign in query.items.value" v-else :key="campaign.id">
                <td>
                  <RouterLink
                    :to="{ name: 'campaign-detail', params: { id: campaign.id } }"
                    class="rounded font-medium text-brand-700 hover:underline dark:text-brand-300"
                  >
                    {{ campaign.name }}
                  </RouterLink>
                  <p
                    v-if="campaign.description"
                    class="max-w-[280px] truncate text-xs text-muted dark:text-slate-400"
                  >
                    {{ campaign.description }}
                  </p>
                </td>
                <td class="numeric">{{ campaign.code }}</td>
                <td class="whitespace-nowrap">{{ formatDateShort(campaign.startDate, ui.locale) }}</td>
                <td class="whitespace-nowrap">
                  {{ campaign.endDate ? formatDateShort(campaign.endDate, ui.locale) : '—' }}
                </td>
                <td class="numeric">{{ formatNumber(campaign.kycCount, ui.locale) }}</td>
                <td>
                  <AppBadge :classes="campaign.isActive ? ACTIVE_BADGE : INACTIVE_BADGE">
                    {{ campaign.isActive ? $t('apiClients.active') : $t('apiClients.inactive') }}
                  </AppBadge>
                </td>
                <td v-if="can.canWriteCampaigns.value">
                  <div class="flex items-center justify-end gap-1">
                    <AppButton size="sm" variant="ghost" @click="openEdit(campaign)">
                      {{ $t('actions.edit') }}
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="ghost"
                      :loading="busyId === campaign.id"
                      @click="
                        campaign.isActive
                          ? (confirmDeactivate = campaign)
                          : setActive(campaign, true)
                      "
                    >
                      {{ campaign.isActive ? $t('actions.deactivate') : $t('actions.activate') }}
                    </AppButton>
                    <AppButton size="sm" variant="ghost" @click="confirmDelete = campaign">
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
          :title="$t('empty.campaigns')"
          :hint="$t('empty.campaignsHint')"
        >
          <template #actions>
            <AppButton v-if="can.canWriteCampaigns.value" variant="primary" size="sm" @click="openCreate">
              {{ $t('campaigns.create') }}
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

    <!-- Create / edit -->
    <AppModal
      :open="showForm"
      :title="editing ? $t('campaigns.edit') : $t('campaigns.create')"
      size="lg"
      @close="showForm = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <AppInput
          v-model="form.name"
          :label="$t('campaigns.name')"
          :error="formErrors.name"
          :maxlength="150"
          required
        />

        <div v-if="editing">
          <span class="field-label">{{ $t('campaigns.code') }}</span>
          <p class="numeric text-sm text-ink dark:text-slate-100">{{ editing.code }}</p>
          <p class="field-hint">{{ $t('campaigns.codeHint') }}</p>
        </div>

        <div>
          <label class="field-label" for="campaign-description">
            {{ $t('campaigns.description') }}
          </label>
          <textarea
            id="campaign-description"
            v-model="form.description"
            rows="3"
            maxlength="1000"
            class="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
          />
          <p v-if="formErrors.description" class="field-error">{{ formErrors.description }}</p>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="field-label" for="campaign-start">{{ $t('campaigns.startDate') }}</label>
            <input
              id="campaign-start"
              v-model="form.startDate"
              type="date"
              required
              class="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
            />
            <p v-if="formErrors.startDate" class="field-error">{{ formErrors.startDate }}</p>
          </div>

          <div>
            <label class="field-label" for="campaign-end">{{ $t('campaigns.endDate') }}</label>
            <input
              id="campaign-end"
              v-model="form.endDate"
              type="date"
              class="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
            />
            <p v-if="formErrors.endDate" class="field-error">{{ formErrors.endDate }}</p>
            <p v-else class="field-hint">{{ $t('campaigns.endDateHint') }}</p>
          </div>
        </div>

        <label class="flex items-center gap-2">
          <input
            v-model="form.isActive"
            type="checkbox"
            class="h-4 w-4 rounded border-line text-brand-800 focus:ring-brand-600"
          />
          <span class="text-sm text-ink dark:text-slate-200">{{ $t('campaigns.isActive') }}</span>
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
      :open="confirmDeactivate !== null"
      :title="$t('campaigns.deactivateConfirm')"
      :body="$t('campaigns.deactivateExplain')"
      :confirm-label="$t('actions.deactivate')"
      :loading="busyId !== null"
      @confirm="confirmDeactivate && setActive(confirmDeactivate, false)"
      @cancel="confirmDeactivate = null"
    />

    <ConfirmDialog
      :open="confirmDelete !== null"
      :title="$t('campaigns.deleteConfirm')"
      :body="$t('campaigns.deleteExplain')"
      :confirm-label="$t('actions.delete')"
      danger
      :loading="actionPending"
      @confirm="remove"
      @cancel="confirmDelete = null"
    />
  </div>
</template>
