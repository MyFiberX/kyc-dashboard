<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChartConfiguration } from 'chart.js'

import {
  kycApi,
  type KycCampaignBreakdown,
  type KycDailyPoint,
  type KycSummary,
} from '@/api'
import BaseChart from '@/components/charts/BaseChart.vue'
import StatCard from '@/components/StatCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage, isCanceled } from '@/utils/errors'
import {
  daysBetween,
  endOfDayIso,
  formatCurrency,
  formatDateShort,
  formatNumber,
  formatPercent,
  startOfDayIso,
  toDateInputValue,
} from '@/utils/format'
import { KYC_STATUS_STYLES, STATUS_CHART_COLORS } from '@/utils/status'

/**
 * The window rules are the backend's, enforced here so an invalid range is never sent:
 *
 *  - summary and by-campaign default to the last 30 days and refuse anything over 366, with a 400
 *    rather than a silently shortened window. The picker therefore cannot select a wider range.
 *  - the daily trend takes a day count clamped to 1..90, so the "last year" preset asks it for 90
 *    rather than 365 - the endpoint would clamp it anyway, and asking for what we can get keeps
 *    the chart's label honest about what it is showing.
 */
const { t } = useI18n()
const ui = useUiStore()

const MAX_DAYS = kycApi.ANALYTICS_MAX_DAYS
const MAX_TREND_DAYS = kycApi.DAILY_MAX_DAYS

const summary = ref<KycSummary | null>(null)
const daily = ref<KycDailyPoint[]>([])
const campaigns = ref<KycCampaignBreakdown[]>([])

const loading = ref(true)
const error = ref<unknown>(null)
const rangeError = ref('')

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toDateInputValue(date)
}

const from = ref(daysAgo(kycApi.ANALYTICS_DEFAULT_DAYS))
const to = ref(toDateInputValue(new Date()))

const PRESETS = [
  { days: 7, labelKey: 'analytics.last7' },
  { days: 30, labelKey: 'analytics.last30' },
  { days: 90, labelKey: 'analytics.last90' },
  { days: 365, labelKey: 'analytics.lastYear' },
] as const

function applyPreset(days: number) {
  from.value = daysAgo(days)
  to.value = toDateInputValue(new Date())
}

let controller: AbortController | null = null

/** Holds the range inside what the backend will accept, before a request is made. */
function validateRange(): boolean {
  rangeError.value = ''

  if (from.value === '' || to.value === '') return false

  if (from.value >= to.value) {
    rangeError.value = t('analytics.invertedRange')
    return false
  }

  if (daysBetween(startOfDayIso(from.value), endOfDayIso(to.value)) > MAX_DAYS) {
    rangeError.value = t('analytics.maxRangeNotice', { days: MAX_DAYS })
    return false
  }

  return true
}

async function load() {
  if (!validateRange()) return

  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal

  loading.value = true
  error.value = null

  const window = { createdFrom: startOfDayIso(from.value), createdTo: endOfDayIso(to.value) }

  // The trend endpoint counts back from today, so it takes the span rather than the two dates.
  const span = Math.min(
    Math.max(Math.round(daysBetween(startOfDayIso(from.value), endOfDayIso(to.value))), 1),
    MAX_TREND_DAYS,
  )

  try {
    const [summaryResult, dailyResult, campaignResult] = await Promise.all([
      kycApi.getKycSummary(window, signal),
      kycApi.getKycDaily(span, signal),
      kycApi.getKycByCampaign({ ...window, top: 20 }, signal),
    ])

    summary.value = summaryResult
    daily.value = dailyResult
    campaigns.value = campaignResult
  } catch (caught) {
    if (isCanceled(caught)) return
    error.value = caught
  } finally {
    loading.value = false
  }
}

watch([from, to], () => void load())
void load()

onBeforeUnmount(() => controller?.abort())

const completionRate = computed(() => {
  const total = summary.value?.total ?? 0
  if (total === 0) return 0
  return (summary.value?.completed ?? 0) / total
})

const trendChart = computed<ChartConfiguration>(() => ({
  type: 'line',
  data: {
    labels: daily.value.map((point) => formatDateShort(point.date, ui.locale)),
    datasets: [
      {
        label: t('analytics.records'),
        data: daily.value.map((point) => point.count),
        borderColor: '#5C2490',
        backgroundColor: 'rgba(92,36,144,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  },
  options: { plugins: { legend: { display: false } } },
}))

const valueChart = computed<ChartConfiguration>(() => ({
  type: 'bar',
  data: {
    labels: daily.value.map((point) => formatDateShort(point.date, ui.locale)),
    datasets: [
      {
        label: t('analytics.pipelineValue'),
        data: daily.value.map((point) => point.pipelineValue),
        backgroundColor: 'rgba(92,36,144,0.55)',
      },
      {
        label: t('analytics.completedValue'),
        data: daily.value.map((point) => point.completedValue),
        backgroundColor: '#2FAE6A',
      },
    ],
  },
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

const hasData = computed(() => (summary.value?.total ?? 0) > 0)
</script>

<template>
  <div>
    <h1 class="mb-4 text-xl font-semibold text-ink dark:text-slate-100">
      {{ $t('analytics.title') }}
    </h1>

    <!-- Range picker -->
    <div class="card mb-4 p-3">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-1">
          <AppButton
            v-for="preset in PRESETS"
            :key="preset.days"
            size="sm"
            @click="applyPreset(preset.days)"
          >
            {{ $t(preset.labelKey) }}
          </AppButton>
        </div>

        <div class="flex flex-wrap items-end gap-2">
          <label class="block">
            <span class="field-label">{{ $t('analytics.from') }}</span>
            <input
              v-model="from"
              type="date"
              class="block rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
            />
          </label>
          <label class="block">
            <span class="field-label">{{ $t('analytics.to') }}</span>
            <input
              v-model="to"
              type="date"
              class="block rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
            />
          </label>
        </div>
      </div>

      <p v-if="rangeError" class="field-error" role="alert">{{ rangeError }}</p>
      <p v-else class="field-hint">{{ $t('analytics.maxRangeNotice', { days: MAX_DAYS }) }}</p>
    </div>

    <ErrorState v-if="error" :message="errorMessage(error, $t)" @retry="load" />

    <template v-else>
      <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          :label="$t('analytics.records')"
          :value="formatNumber(summary?.total ?? 0, ui.locale)"
          :loading="loading"
        />
        <StatCard
          :label="$t('analytics.completed')"
          :value="formatNumber(summary?.completed ?? 0, ui.locale)"
          :dot="KYC_STATUS_STYLES.Completed.dot"
          :loading="loading"
        />
        <StatCard
          :label="$t('analytics.conversion')"
          :value="formatPercent(completionRate, ui.locale)"
          :loading="loading"
        />
        <StatCard
          :label="$t('analytics.completedValue')"
          :value="formatCurrency(summary?.completedValue ?? 0, ui.locale)"
          :loading="loading"
        />
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section class="card p-4 lg:col-span-2">
          <h2 class="mb-1 text-sm font-semibold text-ink dark:text-slate-100">
            {{ $t('analytics.trend') }}
          </h2>
          <p class="mb-3 text-xs text-muted dark:text-slate-400">
            {{ $t('analytics.trendDaysNotice', { days: MAX_TREND_DAYS }) }}
          </p>

          <AppSkeleton v-if="loading" :rows="6" />
          <EmptyState
            v-else-if="daily.length === 0"
            :title="$t('empty.analytics')"
            :hint="$t('empty.analyticsHint')"
          />
          <BaseChart v-else :config="trendChart" :summary="$t('analytics.trend')" />
        </section>

        <section class="card p-4">
          <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
            {{ $t('dashboard.statusDistribution') }}
          </h2>

          <AppSkeleton v-if="loading" :rows="6" />
          <EmptyState v-else-if="!hasData" :title="$t('empty.analytics')" />
          <BaseChart v-else :config="statusChart" :summary="$t('dashboard.statusDistribution')" />
        </section>
      </div>

      <section class="card mt-4 p-4">
        <h2 class="mb-1 text-sm font-semibold text-ink dark:text-slate-100">
          {{ $t('analytics.pipelineValue') }} / {{ $t('analytics.completedValue') }}
        </h2>
        <p class="mb-3 text-xs text-muted dark:text-slate-400">
          {{ $t('analytics.revenueDeprecated') }}
        </p>

        <AppSkeleton v-if="loading" :rows="6" />
        <EmptyState v-else-if="daily.length === 0" :title="$t('empty.analytics')" />
        <BaseChart v-else :config="valueChart" :summary="$t('analytics.pipelineValue')" />
      </section>

      <section class="card mt-4 overflow-hidden">
        <h2 class="px-4 py-3 text-sm font-semibold text-ink dark:text-slate-100">
          {{ $t('analytics.byCampaign') }}
        </h2>

        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">{{ $t('campaigns.campaign') }}</th>
                <th scope="col">{{ $t('campaigns.code') }}</th>
                <th scope="col">{{ $t('analytics.records') }}</th>
                <th scope="col">{{ $t('analytics.completed') }}</th>
                <th scope="col">{{ $t('analytics.pipelineValue') }}</th>
                <th scope="col">{{ $t('analytics.completedValue') }}</th>
              </tr>
            </thead>

            <tbody>
              <AppSkeleton v-if="loading" :rows="5" :columns="6" />

              <tr v-for="row in campaigns" v-else :key="row.campaignId ?? 'none'">
                <td class="font-medium">
                  {{ row.campaignName ?? $t('dashboard.noCampaignAttribution') }}
                </td>
                <td class="numeric">{{ row.campaignCode ?? '—' }}</td>
                <td class="numeric">{{ formatNumber(row.total, ui.locale) }}</td>
                <td class="numeric">{{ formatNumber(row.completed, ui.locale) }}</td>
                <td class="numeric">{{ formatCurrency(row.pipelineValue, ui.locale) }}</td>
                <td class="numeric">{{ formatCurrency(row.completedValue, ui.locale) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <EmptyState
          v-if="!loading && campaigns.length === 0"
          :title="$t('empty.analytics')"
          :hint="$t('empty.analyticsHint')"
        />
      </section>
    </template>
  </div>
</template>
