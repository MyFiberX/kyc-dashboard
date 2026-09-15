<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Filter, Plus, RefreshCw } from 'lucide-vue-next'

import {
  campaignApi,
  kycApi,
  masterDataApi,
  subscriptionApi,
  type Campaign,
  type KycStatus,
  type Province,
  type Region,
  type Subscription,
} from '@/api'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import { useListQuery } from '@/composables/useListQuery'
import { usePermissions } from '@/stores/permissions'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage } from '@/utils/errors'
import { formatCurrency, formatDateShort } from '@/utils/format'
import { KYC_STATUS_STYLES } from '@/utils/status'

const { t } = useI18n()
const ui = useUiStore()
const can = usePermissions()

const showFilters = ref(false)

/**
 * Offset paging with a total, which is what a browsable table needs. The backend also offers cursor
 * paging for walking a large set start to finish - that is the right tool for an export, not for a
 * table an operator jumps around in, so this screen uses page numbers.
 */
const query = useListQuery({
  defaults: {
    search: '',
    status: '' as KycStatus | '',
    provinceId: '',
    regionId: '',
    campaignId: '',
    internetSubscriptionId: '',
    createdFrom: '',
    createdTo: '',
  },
  fetcher: (filters, page, pageSize, signal) =>
    kycApi.getKycRecords(
      {
        search: filters.search || undefined,
        status: filters.status || undefined,
        provinceId: filters.provinceId || undefined,
        regionId: filters.regionId || undefined,
        campaignId: filters.campaignId || undefined,
        internetSubscriptionId: filters.internetSubscriptionId || undefined,
        createdFrom: filters.createdFrom ? new Date(filters.createdFrom).toISOString() : undefined,
        createdTo: filters.createdTo
          ? new Date(`${filters.createdTo}T23:59:59.999`).toISOString()
          : undefined,
        page,
        pageSize,
      },
      signal,
    ),
})

// --- Filter option sources -------------------------------------------------

const provinces = ref<Province[]>([])
const regions = ref<Region[]>([])
const campaignOptions = ref<Campaign[]>([])
const subscriptions = ref<Subscription[]>([])

const lookupController = new AbortController()

async function loadLookups() {
  try {
    // pageSize 200 is the backend's cap; these reference lists are far smaller than that in
    // practice, and a selector that silently omitted entries would be worse than a slow one.
    const [provinceResult, campaignResult, subscriptionResult] = await Promise.all([
      masterDataApi.getProvinces({ pageSize: 200 }, lookupController.signal),
      campaignApi.getCampaigns({ pageSize: 200 }, lookupController.signal),
      subscriptionApi.getSubscriptions({ pageSize: 200 }, lookupController.signal),
    ])

    provinces.value = provinceResult.items
    campaignOptions.value = campaignResult.items
    subscriptions.value = subscriptionResult.items
  } catch {
    // The filters degrade to search-only rather than breaking the page.
  }
}

/** Regions depend on the chosen province, exactly as the backend's own filter does. */
watch(
  () => query.filters.value.provinceId,
  async (provinceId) => {
    query.filters.value.regionId = ''
    regions.value = []

    if (!provinceId) return

    try {
      const result = await masterDataApi.getRegions(
        { provinceId, pageSize: 200 },
        lookupController.signal,
      )
      regions.value = result.items
    } catch {
      // Leave the region selector empty; the province filter still applies.
    }
  },
)

void loadLookups()

onBeforeUnmount(() => lookupController.abort())

const statusOptions = computed(() =>
  (Object.keys(KYC_STATUS_STYLES) as KycStatus[]).map((status) => ({
    value: status,
    label: t(KYC_STATUS_STYLES[status].labelKey),
  })),
)

const provinceOptions = computed(() =>
  provinces.value.map((province) => ({ value: province.id, label: province.name })),
)

const regionOptions = computed(() =>
  regions.value.map((region) => ({ value: region.id, label: region.name })),
)

const campaignSelectOptions = computed(() =>
  campaignOptions.value.map((campaign) => ({
    value: campaign.id,
    label: `${campaign.name} (${campaign.code})`,
  })),
)

const subscriptionOptions = computed(() =>
  subscriptions.value.map((plan) => ({ value: plan.id, label: plan.name })),
)

const activeFilterCount = computed(
  () =>
    Object.entries(query.filters.value).filter(
      ([key, value]) => key !== 'search' && value !== '' && value !== undefined,
    ).length,
)
</script>

<template>
  <div>
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-ink dark:text-slate-100">{{ $t('kyc.title') }}</h1>

      <div class="flex items-center gap-2">
        <AppButton size="sm" :loading="query.loading.value" @click="query.load()">
          <RefreshCw class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('actions.refresh') }}</span>
        </AppButton>

        <AppButton
          v-if="can.canCreateKyc.value"
          variant="primary"
          size="sm"
          @click="$router.push({ name: 'kyc-create' })"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('kyc.create') }}</span>
        </AppButton>
      </div>
    </header>

    <div class="card">
      <!-- Search and filter toggle -->
      <div class="flex flex-wrap items-center gap-2 p-3">
        <div class="min-w-0 flex-1 sm:max-w-sm">
          <SearchInput v-model="query.filters.value.search" />
        </div>

        <AppButton size="sm" @click="showFilters = !showFilters">
          <Filter class="h-4 w-4" aria-hidden="true" />
          {{ $t('actions.filter') }}
          <span
            v-if="activeFilterCount > 0"
            class="ms-1 rounded-full bg-brand-800 px-1.5 text-[11px] font-semibold text-white"
          >
            {{ activeFilterCount }}
          </span>
        </AppButton>

        <AppButton
          v-if="activeFilterCount > 0 || query.filters.value.search"
          size="sm"
          variant="ghost"
          @click="query.resetFilters()"
        >
          {{ $t('actions.clearFilters') }}
        </AppButton>
      </div>

      <!-- Filters -->
      <div
        v-if="showFilters"
        class="grid grid-cols-1 gap-3 border-t border-line p-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/10"
      >
        <AppSelect
          v-model="query.filters.value.status"
          :options="statusOptions"
          :label="$t('kyc.status')"
          :placeholder="$t('table.selectAll')"
        />
        <AppSelect
          v-model="query.filters.value.provinceId"
          :options="provinceOptions"
          :label="$t('kyc.province')"
          :placeholder="$t('masterData.allProvinces')"
        />
        <AppSelect
          v-model="query.filters.value.regionId"
          :options="regionOptions"
          :label="$t('kyc.region')"
          :placeholder="
            query.filters.value.provinceId ? $t('table.selectAll') : $t('masterData.selectProvinceFirst')
          "
          :disabled="!query.filters.value.provinceId"
        />
        <AppSelect
          v-model="query.filters.value.campaignId"
          :options="campaignSelectOptions"
          :label="$t('kyc.campaign')"
          :placeholder="$t('table.selectAll')"
        />
        <AppSelect
          v-model="query.filters.value.internetSubscriptionId"
          :options="subscriptionOptions"
          :label="$t('kyc.subscription')"
          :placeholder="$t('table.selectAll')"
        />
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="field-label">{{ $t('analytics.from') }}</span>
            <input
              v-model="query.filters.value.createdFrom"
              type="date"
              class="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
            />
          </label>
          <label class="block">
            <span class="field-label">{{ $t('analytics.to') }}</span>
            <input
              v-model="query.filters.value.createdTo"
              type="date"
              class="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
            />
          </label>
        </div>
      </div>

      <!-- Results -->
      <ErrorState
        v-if="query.error.value"
        :message="errorMessage(query.error.value, $t)"
        @retry="query.load()"
      />

      <template v-else>
        <!-- Desktop table -->
        <div class="hidden overflow-x-auto md:block">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">{{ $t('kyc.reference') }}</th>
                <th scope="col">{{ $t('kyc.fullName') }}</th>
                <th scope="col">{{ $t('kyc.mobileNumber') }}</th>
                <th scope="col">{{ $t('kyc.province') }}</th>
                <th scope="col">{{ $t('kyc.subscription') }}</th>
                <th scope="col">{{ $t('kyc.totalPrice') }}</th>
                <th scope="col">{{ $t('kyc.discountCouponCode') }}</th>
                <th scope="col">{{ $t('kyc.status') }}</th>
                <th scope="col">{{ $t('kyc.createdAt') }}</th>
              </tr>
            </thead>

            <tbody>
              <AppSkeleton v-if="query.loading.value" :rows="8" :columns="9" />

              <tr
                v-for="record in query.items.value"
                v-else
                :key="record.id"
                class="cursor-pointer"
                @click="$router.push({ name: 'kyc-detail', params: { id: record.id } })"
              >
                <td class="numeric font-medium">{{ record.referenceNumber }}</td>
                <td class="max-w-[200px] truncate">{{ record.fullName }}</td>
                <td class="numeric">{{ record.mobileNumber }}</td>
                <td>
                  <span class="block truncate">{{ record.provinceName }}</span>
                  <span class="block truncate text-xs text-muted dark:text-slate-400">
                    {{ record.regionName }}
                  </span>
                </td>
                <td class="max-w-[160px] truncate">{{ record.internetSubscriptionName }}</td>
                <td class="numeric whitespace-nowrap">
                  {{ formatCurrency(record.totalPrice, ui.locale) }}
                </td>
                <td class="numeric max-w-[140px] truncate">
                  <span v-if="record.discountCouponCode">{{ record.discountCouponCode }}</span>
                  <span v-else class="text-muted dark:text-slate-500">—</span>
                </td>
                <td>
                  <AppBadge
                    :classes="KYC_STATUS_STYLES[record.status].classes"
                    :dot="KYC_STATUS_STYLES[record.status].dot"
                  >
                    {{ $t(KYC_STATUS_STYLES[record.status].labelKey) }}
                  </AppBadge>
                </td>
                <td class="whitespace-nowrap text-muted dark:text-slate-400">
                  {{ formatDateShort(record.createdAt, ui.locale) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile cards: a real layout for small screens, not a table forced to scroll. -->
        <div class="divide-y divide-line md:hidden dark:divide-white/10">
          <div v-if="query.loading.value" class="space-y-3 p-4">
            <AppSkeleton :rows="6" />
          </div>

          <RouterLink
            v-for="record in query.items.value"
            v-else
            :key="record.id"
            :to="{ name: 'kyc-detail', params: { id: record.id } }"
            class="block p-4 transition-colors hover:bg-brand-50/50 dark:hover:bg-white/[0.04]"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium text-ink dark:text-slate-100">
                  {{ record.fullName }}
                </p>
                <p class="numeric truncate text-xs text-muted dark:text-slate-400">
                  {{ record.referenceNumber }} · {{ record.mobileNumber }}
                </p>
              </div>
              <AppBadge
                :classes="KYC_STATUS_STYLES[record.status].classes"
                :dot="KYC_STATUS_STYLES[record.status].dot"
              >
                {{ $t(KYC_STATUS_STYLES[record.status].labelKey) }}
              </AppBadge>
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted dark:text-slate-400">
              <span>{{ record.provinceName }} · {{ record.regionName }}</span>
              <span class="numeric">{{ formatCurrency(record.totalPrice, ui.locale) }}</span>
              <span v-if="record.discountCouponCode" class="numeric">
                {{ record.discountCouponCode }}
              </span>
              <span>{{ formatDateShort(record.createdAt, ui.locale) }}</span>
            </div>
          </RouterLink>
        </div>

        <EmptyState
          v-if="!query.loading.value && query.items.value.length === 0"
          :title="$t('empty.kyc')"
          :hint="$t('empty.kycHint')"
        >
          <template #actions>
            <AppButton size="sm" @click="query.resetFilters()">
              {{ $t('actions.clearFilters') }}
            </AppButton>
            <AppButton
              v-if="can.canCreateKyc.value"
              variant="primary"
              size="sm"
              @click="$router.push({ name: 'kyc-create' })"
            >
              {{ $t('kyc.create') }}
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

    <!-- The listing intentionally carries no customer result link; that is only on a single record. -->
    <p class="mt-3 text-xs text-muted dark:text-slate-500">{{ $t('kyc.linkNotAvailable') }}</p>
  </div>
</template>
