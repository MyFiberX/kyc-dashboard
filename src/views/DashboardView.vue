<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckCircle2, Clock, FileText, Loader2, PhoneOff, Plus, Wallet } from 'lucide-vue-next'
import type { ChartConfiguration } from 'chart.js'

import { kycApi, type KycCampaignBreakdown, type KycDailyPoint, type KycRecord, type KycSummary } from '@/api'
import BaseChart from '@/components/charts/BaseChart.vue'
import StatCard from '@/components/StatCard.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { usePermissions } from '@/stores/permissions'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage, isCanceled } from '@/utils/errors'
import { formatCurrency, formatDateShort, formatNumber } from '@/utils/format'
import { KYC_STATUS_STYLES, STATUS_CHART_COLORS } from '@/utils/status'

/**
 * Every number on this page comes from an analytics endpoint. Nothing is estimated, and no tile is
 * rendered for a figure the API does not report.
 *
 * The window is the backend's own default of 30 days - the same default the summary endpoint
 * applies when no dates are sent - so the page opens on the range the API is tuned for.
 */
const { t } = useI18n()
const ui = useUiStore()
const can = usePermissions()

const summary = ref<KycSummary | null>(null)
const daily = ref<KycDailyPoint[]>([])
const campaigns = ref<KycCampaignBreakdown[]>([])
const recent = ref<KycRecord[]>([])

const loading = ref(true)
const error = ref<unknown>(null)

const controller = new AbortController()

const money = (value: number) => formatCurrency(value, ui.locale)
const count = (value: number) => formatNumber(value, ui.locale)

async function load() {
  loading.value = true
  error.value = null

  try {
    // Fired together rather than in sequence: they are independent, and four round trips end to end
    // would make the dashboard feel slow for no reason.
    const [summaryResult, dailyResult, campaignResult, recentResult] = await Promise.all([
      kycApi.getKycSummary({}, controller.signal),
      kycApi.getKycDaily(30, controller.signal),
      kycApi.getKycByCampaign({ top: 6 }, controller.signal),
      // includeTotal=false: this panel shows five rows and never pages, so the count query behind
      // totalCount would be paid for nothing.
      kycApi.getKycRecords({ pageSize: 5, includeTotal: false }, controller.signal),
    ])

    summary.value = summaryResult
    daily.value = dailyResult
    campaigns.value = campaignResult
    recent.value = recentResult.items
  } catch (caught) {
    if (isCanceled(caught)) return
    error.value = caught
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => controller.abort())

void load()

const trendChart = computed<ChartConfiguration>(() => ({
  type: 'line',
  data: {
    labels: daily.value.map((point) => formatDateShort(point.date, ui.locale)),
    datasets: [
      {
        label: t('dashboard.totalRecords'),
        data: daily.value.map((point) => point.count),
        borderColor: '#5C2490',
        backgroundColor: 'rgba(92,36,144,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  },
  options: { plugins: { legend: { display: false } } },
}))

const statusChart = computed<ChartConfiguration>(() => ({
  type: 'doughnut',
  data: {
    labels: [
      t('status.Pending'),
      t('status.NoAnswer'),
      t('status.InProcess'),
      t('status.Completed'),
    ],
    datasets: [
      {
        data: [
          summary.value?.pending ?? 0,
          summary.value?.noAnswer ?? 0,
          summary.value?.inProcess ?? 0,
          summary.value?.completed ?? 0,
        ],
        backgroundColor: STATUS_CHART_COLORS,
        borderWidth: 0,
      },
    ],
  },
  options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } },
}))

const hasAnyRecords = computed(() => (summary.value?.total ?? 0) > 0)

const trendSummary = computed(() =>
  t('dashboard.dailyTrend') +
  ': ' +
  daily.value.map((point) => `${point.date} ${point.count}`).join(', '),
)
</script>

<template>
  <div>
    <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink dark:text-slate-100">
          {{ $t('dashboard.title') }}
        </h1>
        <p class="mt-0.5 text-sm text-muted dark:text-slate-400">
          {{ $t('dashboard.subtitle', { days: 30 }) }}
        </p>
      </div>

      <AppButton
        v-if="can.canCreateKyc.value"
        variant="primary"
        size="sm"
        @click="$router.push({ name: 'kyc-create' })"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        {{ $t('kyc.create') }}
      </AppButton>
    </header>

    <ErrorState v-if="error" :message="errorMessage(error, $t)" @retry="load" />

    <template v-else>
      <!-- Totals -->
      <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          :label="$t('dashboard.totalRecords')"
          :value="count(summary?.total ?? 0)"
          :icon="FileText"
          :loading="loading"
        />
        <StatCard
          :label="$t('dashboard.pending')"
          :value="count(summary?.pending ?? 0)"
          :icon="Clock"
          :dot="KYC_STATUS_STYLES.Pending.dot"
          :loading="loading"
        />
        <StatCard
          :label="$t('dashboard.inProcess')"
          :value="count(summary?.inProcess ?? 0)"
          :icon="Loader2"
          :dot="KYC_STATUS_STYLES.InProcess.dot"
          :loading="loading"
        />
        <StatCard
          :label="$t('dashboard.completed')"
          :value="count(summary?.completed ?? 0)"
          :icon="CheckCircle2"
          :dot="KYC_STATUS_STYLES.Completed.dot"
          :loading="loading"
        />
      </div>

      <div class="mt-3 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard
          :label="$t('dashboard.noAnswer')"
          :value="count(summary?.noAnswer ?? 0)"
          :icon="PhoneOff"
          :dot="KYC_STATUS_STYLES.NoAnswer.dot"
          :loading="loading"
        />
        <StatCard
          :label="$t('dashboard.pipelineValue')"
          :value="money(summary?.pipelineValue ?? 0)"
          :icon="Wallet"
          :loading="loading"
        />
        <StatCard
          :label="$t('dashboard.completedValue')"
          :value="money(summary?.completedValue ?? 0)"
          :icon="Wallet"
          :loading="loading"
        />
      </div>

      <!-- Charts -->
      <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section class="card p-4 lg:col-span-2">
          <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
            {{ $t('dashboard.dailyTrend') }}
          </h2>

          <AppSkeleton v-if="loading" :rows="6" />
          <EmptyState
            v-else-if="daily.length === 0"
            :title="$t('empty.analytics')"
            :hint="$t('empty.analyticsHint')"
          />
          <BaseChart v-else :config="trendChart" :summary="trendSummary" />
        </section>

        <section class="card p-4">
          <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
            {{ $t('dashboard.statusDistribution') }}
          </h2>

          <AppSkeleton v-if="loading" :rows="6" />
          <EmptyState
            v-else-if="!hasAnyRecords"
            :title="$t('empty.analytics')"
            :hint="$t('empty.analyticsHint')"
          />
          <BaseChart
            v-else
            :config="statusChart"
            :summary="$t('dashboard.statusDistribution')"
          />
        </section>
      </div>

      <!-- Campaigns and recent records -->
      <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section class="card overflow-hidden">
          <header class="flex items-center justify-between px-4 py-3">
            <h2 class="text-sm font-semibold text-ink dark:text-slate-100">
              {{ $t('dashboard.topCampaigns') }}
            </h2>
            <RouterLink
              v-if="can.canReadCampaigns.value"
              :to="{ name: 'campaigns' }"
              class="rounded text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              {{ $t('dashboard.viewAll') }}
            </RouterLink>
          </header>

          <div class="px-4 pb-4">
            <AppSkeleton v-if="loading" :rows="4" />
            <EmptyState
              v-else-if="campaigns.length === 0"
              :title="$t('empty.analytics')"
              :hint="$t('empty.analyticsHint')"
            />
            <ul v-else class="divide-y divide-line dark:divide-white/10">
              <li
                v-for="row in campaigns"
                :key="row.campaignId ?? 'none'"
                class="flex items-center justify-between gap-3 py-2.5"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-ink dark:text-slate-100">
                    {{ row.campaignName ?? $t('dashboard.noCampaignAttribution') }}
                  </p>
                  <p v-if="row.campaignCode" class="numeric truncate text-xs text-muted dark:text-slate-400">
                    {{ row.campaignCode }}
                  </p>
                </div>

                <div class="flex flex-none items-center gap-4 text-end">
                  <div>
                    <p class="numeric text-sm font-semibold text-ink dark:text-slate-100">
                      {{ count(row.total) }}
                    </p>
                    <p class="text-[11px] text-muted dark:text-slate-400">
                      {{ $t('analytics.records') }}
                    </p>
                  </div>
                  <div class="hidden sm:block">
                    <p class="numeric text-sm font-semibold text-ink dark:text-slate-100">
                      {{ money(row.pipelineValue) }}
                    </p>
                    <p class="text-[11px] text-muted dark:text-slate-400">
                      {{ $t('analytics.pipelineValue') }}
                    </p>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section class="card overflow-hidden">
          <header class="flex items-center justify-between px-4 py-3">
            <h2 class="text-sm font-semibold text-ink dark:text-slate-100">
              {{ $t('dashboard.recentRecords') }}
            </h2>
            <RouterLink
              v-if="can.canReadKyc.value"
              :to="{ name: 'kyc' }"
              class="rounded text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              {{ $t('dashboard.viewAll') }}
            </RouterLink>
          </header>

          <div class="px-4 pb-4">
            <AppSkeleton v-if="loading" :rows="5" />
            <EmptyState
              v-else-if="recent.length === 0"
              :title="$t('empty.kyc')"
              :hint="$t('empty.kycHint')"
            />
            <ul v-else class="divide-y divide-line dark:divide-white/10">
              <li v-for="record in recent" :key="record.id">
                <RouterLink
                  :to="{ name: 'kyc-detail', params: { id: record.id } }"
                  class="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-brand-50/50 dark:hover:bg-white/[0.04]"
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-ink dark:text-slate-100">
                      {{ record.fullName }}
                    </p>
                    <p class="numeric truncate text-xs text-muted dark:text-slate-400">
                      {{ record.referenceNumber }}
                    </p>
                  </div>

                  <div class="flex flex-none items-center gap-3">
                    <AppBadge
                      :classes="KYC_STATUS_STYLES[record.status].classes"
                      :dot="KYC_STATUS_STYLES[record.status].dot"
                    >
                      {{ $t(KYC_STATUS_STYLES[record.status].labelKey) }}
                    </AppBadge>
                    <span class="hidden text-xs text-muted sm:block dark:text-slate-400">
                      {{ formatDateShort(record.createdAt, ui.locale) }}
                    </span>
                  </div>
                </RouterLink>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
