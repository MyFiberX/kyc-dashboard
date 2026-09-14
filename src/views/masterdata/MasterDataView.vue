<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'

import { masterDataApi, type Province, type Region } from '@/api'
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
import { formatNumber } from '@/utils/format'

/**
 * Provinces and regions on one screen, because they are one hierarchy: a region belongs to a
 * province, and the region tab filters by the province chosen here - the same dependency the
 * KYC form and the backend's own filter use.
 */
const { t } = useI18n()
const ui = useUiStore()
const can = usePermissions()

const tab = ref<'provinces' | 'regions'>('provinces')

// --- Provinces -------------------------------------------------------------

const provinceQuery = useListQuery({
  defaults: { search: '' },
  fetcher: (filters, page, pageSize, signal) =>
    masterDataApi.getProvinces(
      { search: filters.search || undefined, page, pageSize },
      signal,
    ),
})

// --- Regions ---------------------------------------------------------------

const regionQuery = useListQuery({
  defaults: { search: '', provinceId: '' },
  fetcher: (filters, page, pageSize, signal) =>
    masterDataApi.getRegions(
      {
        search: filters.search || undefined,
        provinceId: filters.provinceId || undefined,
        page,
        pageSize,
      },
      signal,
    ),
})

/** The province selector for the region filter and form; loaded once. */
const allProvinces = ref<Province[]>([])
const lookupController = new AbortController()

async function loadProvinceOptions() {
  try {
    const result = await masterDataApi.getProvinces({ pageSize: 200 }, lookupController.signal)
    allProvinces.value = result.items
  } catch {
    // The region form still works; the selector is simply empty.
  }
}

void loadProvinceOptions()
onBeforeUnmount(() => lookupController.abort())

// Keep the selector fresh after a province is added or removed.
watch(
  () => provinceQuery.items.value,
  () => void loadProvinceOptions(),
)

const provinceOptions = computed(() =>
  allProvinces.value.map((province) => ({ value: province.id, label: province.name })),
)

// --- Province form ---------------------------------------------------------

const editingProvince = ref<Province | null>(null)
const showProvinceForm = ref(false)
const provinceForm = ref({ name: '' })
const provinceErrors = ref<Record<string, string>>({})
const savingProvince = ref(false)
const confirmDeleteProvince = ref<Province | null>(null)
const deletingProvince = ref(false)

function openProvinceCreate() {
  editingProvince.value = null
  provinceForm.value = { name: '' }
  provinceErrors.value = {}
  showProvinceForm.value = true
}

function openProvinceEdit(province: Province) {
  editingProvince.value = province
  provinceForm.value = { name: province.name }
  provinceErrors.value = {}
  showProvinceForm.value = true
}

async function saveProvince() {
  provinceErrors.value = {}

  if (provinceForm.value.name.trim() === '') {
    provinceErrors.value = { name: t('validation.required') }
    return
  }

  savingProvince.value = true

  try {
    if (editingProvince.value === null) {
      await masterDataApi.createProvince({ name: provinceForm.value.name.trim() })
      ui.notify('success', t('masterData.provinceCreated'))
    } else {
      // An empty patch is rejected with 400, so an unchanged name simply closes the dialog.
      if (provinceForm.value.name.trim() === editingProvince.value.name) {
        showProvinceForm.value = false
        return
      }

      await masterDataApi.updateProvince(editingProvince.value.id, {
        name: provinceForm.value.name.trim(),
      })
      ui.notify('success', t('masterData.provinceUpdated'))
    }

    showProvinceForm.value = false
    await provinceQuery.load()
  } catch (caught) {
    provinceErrors.value = fieldErrors(caught)
    ui.notify('error', errorMessage(caught, t))
  } finally {
    savingProvince.value = false
  }
}

async function removeProvince() {
  const province = confirmDeleteProvince.value
  if (province === null) return

  deletingProvince.value = true

  try {
    await masterDataApi.deleteProvince(province.id)
    ui.notify('success', t('masterData.provinceDeleted'))
    confirmDeleteProvince.value = null
    await provinceQuery.load()
  } catch (caught) {
    ui.notify('error', errorMessage(caught, t))
    confirmDeleteProvince.value = null
  } finally {
    deletingProvince.value = false
  }
}

// --- Region form -----------------------------------------------------------

const editingRegion = ref<Region | null>(null)
const showRegionForm = ref(false)
const regionForm = ref({ name: '', provinceId: '' })
const regionErrors = ref<Record<string, string>>({})
const savingRegion = ref(false)
const confirmDeleteRegion = ref<Region | null>(null)
const deletingRegion = ref(false)

function openRegionCreate() {
  editingRegion.value = null
  regionForm.value = { name: '', provinceId: regionQuery.filters.value.provinceId }
  regionErrors.value = {}
  showRegionForm.value = true
}

function openRegionEdit(region: Region) {
  editingRegion.value = region
  regionForm.value = { name: region.name, provinceId: region.provinceId }
  regionErrors.value = {}
  showRegionForm.value = true
}

async function saveRegion() {
  regionErrors.value = {}

  const errors: Record<string, string> = {}
  if (regionForm.value.name.trim() === '') errors.name = t('validation.required')
  if (regionForm.value.provinceId === '') errors.provinceId = t('validation.required')

  if (Object.keys(errors).length > 0) {
    regionErrors.value = errors
    return
  }

  savingRegion.value = true

  try {
    if (editingRegion.value === null) {
      await masterDataApi.createRegion({
        name: regionForm.value.name.trim(),
        provinceId: regionForm.value.provinceId,
      })
      ui.notify('success', t('masterData.regionCreated'))
    } else {
      const patch: Record<string, unknown> = {}
      const original = editingRegion.value

      if (regionForm.value.name.trim() !== original.name) patch.name = regionForm.value.name.trim()
      // Moving a region between provinces is refused once records reference it; the 409 explains it.
      if (regionForm.value.provinceId !== original.provinceId) {
        patch.provinceId = regionForm.value.provinceId
      }

      if (Object.keys(patch).length === 0) {
        showRegionForm.value = false
        return
      }

      await masterDataApi.updateRegion(original.id, patch)
      ui.notify('success', t('masterData.regionUpdated'))
    }

    showRegionForm.value = false
    await regionQuery.load()
  } catch (caught) {
    regionErrors.value = fieldErrors(caught)
    ui.notify('error', errorMessage(caught, t))
  } finally {
    savingRegion.value = false
  }
}

async function removeRegion() {
  const region = confirmDeleteRegion.value
  if (region === null) return

  deletingRegion.value = true

  try {
    await masterDataApi.deleteRegion(region.id)
    ui.notify('success', t('masterData.regionDeleted'))
    confirmDeleteRegion.value = null
    await regionQuery.load()
  } catch (caught) {
    ui.notify('error', errorMessage(caught, t))
    confirmDeleteRegion.value = null
  } finally {
    deletingRegion.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="mb-4 text-xl font-semibold text-ink dark:text-slate-100">
      {{ $t('masterData.title') }}
    </h1>

    <!-- Tabs -->
    <div class="mb-4 flex gap-1 border-b border-line dark:border-white/10" role="tablist">
      <button
        v-for="option in (['provinces', 'regions'] as const)"
        :key="option"
        type="button"
        role="tab"
        :aria-selected="tab === option"
        :class="[
          '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
          tab === option
            ? 'border-brand-800 text-brand-800 dark:border-brand-300 dark:text-brand-200'
            : 'border-transparent text-muted hover:text-ink dark:hover:text-slate-200',
        ]"
        @click="tab = option"
      >
        {{ $t(`masterData.${option}`) }}
      </button>
    </div>

    <!-- Provinces -->
    <div v-if="tab === 'provinces'" class="card">
      <div class="flex flex-wrap items-center gap-2 p-3">
        <div class="min-w-0 flex-1 sm:max-w-sm">
          <SearchInput v-model="provinceQuery.filters.value.search" />
        </div>
        <AppButton
          v-if="can.canWriteMasterData.value"
          variant="primary"
          size="sm"
          @click="openProvinceCreate"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          {{ $t('masterData.createProvince') }}
        </AppButton>
      </div>

      <ErrorState
        v-if="provinceQuery.error.value"
        :message="errorMessage(provinceQuery.error.value, $t)"
        @retry="provinceQuery.load()"
      />

      <template v-else>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">{{ $t('masterData.name') }}</th>
                <th scope="col">{{ $t('masterData.regionCount') }}</th>
                <th v-if="can.canWriteMasterData.value" scope="col">
                  <span class="sr-only">{{ $t('table.actions') }}</span>
                </th>
              </tr>
            </thead>

            <tbody>
              <AppSkeleton v-if="provinceQuery.loading.value" :rows="6" :columns="3" />

              <tr v-for="province in provinceQuery.items.value" v-else :key="province.id">
                <td class="font-medium">{{ province.name }}</td>
                <td class="numeric">{{ formatNumber(province.regionCount, ui.locale) }}</td>
                <td v-if="can.canWriteMasterData.value">
                  <div class="flex items-center justify-end gap-1">
                    <AppButton size="sm" variant="ghost" @click="openProvinceEdit(province)">
                      {{ $t('actions.edit') }}
                    </AppButton>
                    <AppButton size="sm" variant="ghost" @click="confirmDeleteProvince = province">
                      {{ $t('actions.delete') }}
                    </AppButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <EmptyState
          v-if="!provinceQuery.loading.value && provinceQuery.items.value.length === 0"
          :title="$t('empty.provinces')"
          :hint="$t('empty.provincesHint')"
        />

        <AppPagination
          v-if="provinceQuery.items.value.length > 0"
          :meta="provinceQuery.meta.value"
          :count="provinceQuery.items.value.length"
          :disabled="provinceQuery.loading.value"
          @update:page="provinceQuery.setPage"
          @update:page-size="provinceQuery.setPageSize"
        />
      </template>
    </div>

    <!-- Regions -->
    <div v-else class="card">
      <div class="flex flex-wrap items-center gap-2 p-3">
        <div class="min-w-0 flex-1 sm:max-w-sm">
          <SearchInput v-model="regionQuery.filters.value.search" />
        </div>
        <div class="w-48">
          <AppSelect
            v-model="regionQuery.filters.value.provinceId"
            :options="provinceOptions"
            :placeholder="$t('masterData.allProvinces')"
          />
        </div>
        <AppButton
          v-if="can.canWriteMasterData.value"
          variant="primary"
          size="sm"
          @click="openRegionCreate"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          {{ $t('masterData.createRegion') }}
        </AppButton>
      </div>

      <ErrorState
        v-if="regionQuery.error.value"
        :message="errorMessage(regionQuery.error.value, $t)"
        @retry="regionQuery.load()"
      />

      <template v-else>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">{{ $t('masterData.name') }}</th>
                <th scope="col">{{ $t('masterData.province') }}</th>
                <th v-if="can.canWriteMasterData.value" scope="col">
                  <span class="sr-only">{{ $t('table.actions') }}</span>
                </th>
              </tr>
            </thead>

            <tbody>
              <AppSkeleton v-if="regionQuery.loading.value" :rows="6" :columns="3" />

              <tr v-for="region in regionQuery.items.value" v-else :key="region.id">
                <td class="font-medium">{{ region.name }}</td>
                <td>{{ region.provinceName }}</td>
                <td v-if="can.canWriteMasterData.value">
                  <div class="flex items-center justify-end gap-1">
                    <AppButton size="sm" variant="ghost" @click="openRegionEdit(region)">
                      {{ $t('actions.edit') }}
                    </AppButton>
                    <AppButton size="sm" variant="ghost" @click="confirmDeleteRegion = region">
                      {{ $t('actions.delete') }}
                    </AppButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <EmptyState
          v-if="!regionQuery.loading.value && regionQuery.items.value.length === 0"
          :title="$t('empty.regions')"
          :hint="$t('empty.regionsHint')"
        />

        <AppPagination
          v-if="regionQuery.items.value.length > 0"
          :meta="regionQuery.meta.value"
          :count="regionQuery.items.value.length"
          :disabled="regionQuery.loading.value"
          @update:page="regionQuery.setPage"
          @update:page-size="regionQuery.setPageSize"
        />
      </template>
    </div>

    <!-- Province dialog -->
    <AppModal
      :open="showProvinceForm"
      :title="editingProvince ? $t('masterData.editProvince') : $t('masterData.createProvince')"
      size="sm"
      @close="showProvinceForm = false"
    >
      <form novalidate @submit.prevent="saveProvince">
        <AppInput
          v-model="provinceForm.name"
          :label="$t('masterData.name')"
          :error="provinceErrors.name"
          :maxlength="100"
          required
        />
      </form>

      <template #footer>
        <AppButton variant="ghost" :disabled="savingProvince" @click="showProvinceForm = false">
          {{ $t('actions.cancel') }}
        </AppButton>
        <AppButton variant="primary" :loading="savingProvince" @click="saveProvince">
          {{ $t('actions.save') }}
        </AppButton>
      </template>
    </AppModal>

    <!-- Region dialog -->
    <AppModal
      :open="showRegionForm"
      :title="editingRegion ? $t('masterData.editRegion') : $t('masterData.createRegion')"
      size="sm"
      @close="showRegionForm = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="saveRegion">
        <AppInput
          v-model="regionForm.name"
          :label="$t('masterData.name')"
          :error="regionErrors.name"
          :maxlength="100"
          required
        />
        <AppSelect
          v-model="regionForm.provinceId"
          :options="provinceOptions"
          :label="$t('masterData.province')"
          :placeholder="$t('masterData.allProvinces')"
          :error="regionErrors.provinceId"
          required
        />
      </form>

      <template #footer>
        <AppButton variant="ghost" :disabled="savingRegion" @click="showRegionForm = false">
          {{ $t('actions.cancel') }}
        </AppButton>
        <AppButton variant="primary" :loading="savingRegion" @click="saveRegion">
          {{ $t('actions.save') }}
        </AppButton>
      </template>
    </AppModal>

    <ConfirmDialog
      :open="confirmDeleteProvince !== null"
      :title="$t('masterData.deleteProvinceConfirm')"
      :body="$t('masterData.deleteProvinceExplain')"
      :confirm-label="$t('actions.delete')"
      danger
      :loading="deletingProvince"
      @confirm="removeProvince"
      @cancel="confirmDeleteProvince = null"
    />

    <ConfirmDialog
      :open="confirmDeleteRegion !== null"
      :title="$t('masterData.deleteRegionConfirm')"
      :body="$t('masterData.deleteRegionExplain')"
      :confirm-label="$t('actions.delete')"
      danger
      :loading="deletingRegion"
      @confirm="removeRegion"
      @cancel="confirmDeleteRegion = null"
    />
  </div>
</template>
