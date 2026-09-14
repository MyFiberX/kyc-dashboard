<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, Ban, Copy, ExternalLink, RotateCcw, Trash2 } from 'lucide-vue-next'

import { kycApi, type KycRecord, type KycStatus, type KycStatusHistoryEntry } from '@/api'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { usePermissions } from '@/stores/permissions'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage, isCanceled, isConflict } from '@/utils/errors'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { KYC_STATUS_STYLES, linkStateStyle, NEUTRAL_BADGE } from '@/utils/status'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const ui = useUiStore()
const can = usePermissions()

const record = ref<KycRecord | null>(null)
const history = ref<KycStatusHistoryEntry[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

const savingStatus = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)

const togglingLink = ref(false)
const confirmRevokeLink = ref(false)

const controller = new AbortController()
const id = computed(() => String(route.params.id))

async function load() {
  loading.value = true
  error.value = null

  try {
    const [recordResult, historyResult] = await Promise.all([
      kycApi.getKycRecord(id.value, controller.signal),
      kycApi.getKycHistory(id.value, controller.signal),
    ])

    record.value = recordResult
    history.value = historyResult
  } catch (caught) {
    if (isCanceled(caught)) return
    error.value = caught
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => controller.abort())
void load()

const statusOptions = computed(() =>
  (Object.keys(KYC_STATUS_STYLES) as KycStatus[]).map((status) => ({
    value: status,
    label: t(KYC_STATUS_STYLES[status].labelKey),
  })),
)

/**
 * Status is the one field the update contract accepts, so the update sends exactly that and
 * nothing else - a full object would be sending fields the operator never touched.
 */
async function changeStatus(next: string | null | undefined) {
  if (next === null || next === undefined || record.value === null || next === record.value.status)
    return

  savingStatus.value = true

  try {
    record.value = await kycApi.updateKyc(id.value, { status: next as KycStatus })
    history.value = await kycApi.getKycHistory(id.value, controller.signal)
    ui.notify('success', t('kyc.updated'))
  } catch (caught) {
    // 409 means someone else changed this record first. Reloading is the honest remedy: it shows
    // what the record actually says now rather than overwriting their change.
    if (isConflict(caught)) {
      ui.notify('error', t('errors.409'))
      await load()
    } else {
      ui.notify('error', errorMessage(caught, t))
    }
  } finally {
    savingStatus.value = false
  }
}

async function remove() {
  deleting.value = true

  try {
    await kycApi.deleteKyc(id.value)
    ui.notify('success', t('kyc.deleted'))
    await router.push({ name: 'kyc' })
  } catch (caught) {
    ui.notify('error', errorMessage(caught, t))
    confirmDelete.value = false
  } finally {
    deleting.value = false
  }
}

/**
 * Revokes or restores the customer's result link.
 *
 * The response carries the link's state and nothing else - no personal data, no URL - so only the
 * link fields on the record are updated from it. The URL already on screen is kept: the token is
 * never discarded, so restoring reopens the same address rather than issuing a new one.
 */
async function setLinkEnabled(isEnabled: boolean) {
  if (record.value === null) return

  togglingLink.value = true

  try {
    const result = isEnabled
      ? await kycApi.enableKycPublicLink(id.value)
      : await kycApi.disableKycPublicLink(id.value)

    record.value = {
      ...record.value,
      publicLinkState: result.publicLinkState,
      publicLinkExpiresAt: result.publicLinkExpiresAt,
    }

    confirmRevokeLink.value = false
    ui.notify('success', t(isEnabled ? 'kyc.linkRestored' : 'kyc.linkRevoked'))
  } catch (caught) {
    ui.notify('error', errorMessage(caught, t))
  } finally {
    togglingLink.value = false
  }
}

/** Pluralised via the message's own "one | other" form, chosen by the count. */
function months(count: number): string {
  return t('kyc.months', { count }, count)
}

/** noopener/noreferrer, so the opened page gets no handle back to this one. */
function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    ui.notify('success', t('actions.copied'))
  } catch {
    ui.notify('error', t('actions.copyFailed'))
  }
}

const actorLabel = (entry: KycStatusHistoryEntry) => {
  const kind =
    entry.actorType === 'ApiClient'
      ? t('kyc.history.actorApiClient')
      : entry.actorType === 'Operator'
        ? t('kyc.history.actorOperator')
        : t('kyc.history.actorSystem')

  return entry.actorName !== null && entry.actorName !== '' ? `${kind} · ${entry.actorName}` : kind
}
</script>

<template>
  <div>
    <AppButton size="sm" variant="ghost" class="mb-3" @click="router.push({ name: 'kyc' })">
      <ArrowLeft class="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
      {{ $t('actions.back') }}
    </AppButton>

    <ErrorState v-if="error" :message="errorMessage(error, $t)" @retry="load" />

    <div v-else-if="loading" class="card p-6">
      <AppSkeleton :rows="10" />
    </div>

    <template v-else-if="record">
      <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-xl font-semibold text-ink dark:text-slate-100">
            {{ record.fullName }}
          </h1>
          <p class="numeric mt-0.5 text-sm text-muted dark:text-slate-400">
            {{ record.referenceNumber }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <AppSelect
            v-if="can.canUpdateKyc.value"
            :model-value="record.status"
            :options="statusOptions"
            :disabled="savingStatus"
            class="min-w-[160px]"
            @update:model-value="changeStatus"
          />
          <AppBadge
            v-else
            :classes="KYC_STATUS_STYLES[record.status].classes"
            :dot="KYC_STATUS_STYLES[record.status].dot"
          >
            {{ $t(KYC_STATUS_STYLES[record.status].labelKey) }}
          </AppBadge>

          <AppButton
            v-if="can.canUpdateKyc.value"
            variant="danger"
            size="sm"
            @click="confirmDelete = true"
          >
            <Trash2 class="h-4 w-4" aria-hidden="true" />
            <span class="hidden sm:inline">{{ $t('actions.delete') }}</span>
          </AppButton>
        </div>
      </header>

      <!-- Advisory flags the backend raised on this record. -->
      <div v-if="record.isDuplicate || record.coordinateWarning" class="mb-4 space-y-2">
        <p
          v-if="record.isDuplicate"
          class="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle class="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          <span>
            {{ $t('kyc.duplicate') }}
            <RouterLink
              v-if="record.duplicateOfKycId"
              :to="{ name: 'kyc-detail', params: { id: record.duplicateOfKycId } }"
              class="font-medium underline"
            >
              {{ $t('kyc.duplicateOf') }}
            </RouterLink>
          </span>
        </p>

        <p
          v-if="record.coordinateWarning"
          class="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle class="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          {{ $t('kyc.coordinateWarning') }}
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-2">
          <!-- Customer -->
          <section class="card p-4">
            <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
              {{ $t('kyc.customerSection') }}
            </h2>

            <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.fullName') }}</dt>
                <dd class="text-sm text-ink dark:text-slate-100">{{ record.fullName }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.mobileNumber') }}</dt>
                <dd class="numeric text-sm text-ink dark:text-slate-100">
                  {{ record.mobileNumber }}
                </dd>
              </div>
              <div v-if="record.email">
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.email') }}</dt>
                <dd class="truncate text-sm text-ink dark:text-slate-100">{{ record.email }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.deviceType') }}</dt>
                <dd class="text-sm text-ink dark:text-slate-100">
                  {{ $t(`deviceType.${record.deviceType}`) }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- Subscription -->
          <section class="card p-4">
            <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
              {{ $t('kyc.subscriptionSection') }}
            </h2>

            <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.subscription') }}</dt>
                <dd class="text-sm text-ink dark:text-slate-100">
                  {{ record.internetSubscriptionName }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.duration') }}</dt>
                <dd class="text-sm text-ink dark:text-slate-100">
                  {{ months(record.subscriptionDuration) }}
                </dd>
              </div>
              <!--
                The price the record was taken at, which is what the customer agreed to. The plan's
                current price may well differ; this is never recomputed from it.
              -->
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">
                  {{ $t('kyc.priceAtSubmission') }}
                </dt>
                <dd class="numeric text-sm text-ink dark:text-slate-100">
                  {{ formatCurrency(record.priceAtSubmission, ui.locale) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.totalPrice') }}</dt>
                <dd class="numeric text-sm font-semibold text-ink dark:text-slate-100">
                  {{ formatCurrency(record.totalPrice, ui.locale) }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- Location -->
          <section class="card p-4">
            <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
              {{ $t('kyc.locationSection') }}
            </h2>

            <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.province') }}</dt>
                <dd class="text-sm text-ink dark:text-slate-100">{{ record.provinceName }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.region') }}</dt>
                <dd class="text-sm text-ink dark:text-slate-100">{{ record.regionName }}</dd>
              </div>
              <div v-if="record.nearAddressPoint" class="sm:col-span-2">
                <dt class="text-xs text-muted dark:text-slate-400">
                  {{ $t('kyc.nearAddressPoint') }}
                </dt>
                <dd class="text-sm text-ink dark:text-slate-100">{{ record.nearAddressPoint }}</dd>
              </div>
              <div v-if="record.locationLat !== null && record.locationLng !== null">
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.coordinates') }}</dt>
                <dd class="numeric text-sm text-ink dark:text-slate-100">
                  {{ record.locationLat }}, {{ record.locationLng }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- Status history -->
          <section class="card p-4">
            <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
              {{ $t('kyc.historySection') }}
            </h2>

            <ol class="space-y-3">
              <li v-for="entry in history" :key="entry.id" class="flex gap-3">
                <span
                  :class="['mt-1.5 h-2 w-2 flex-none rounded-full', KYC_STATUS_STYLES[entry.newStatus].dot]"
                  aria-hidden="true"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-ink dark:text-slate-100">
                    <template v-if="entry.oldStatus === null">
                      {{ $t('kyc.history.submitted') }}
                    </template>
                    <template v-else>
                      {{ $t(KYC_STATUS_STYLES[entry.oldStatus].labelKey) }}
                      →
                      {{ $t(KYC_STATUS_STYLES[entry.newStatus].labelKey) }}
                    </template>
                  </p>
                  <p class="text-xs text-muted dark:text-slate-400">
                    {{ formatDateTime(entry.changedAt, ui.locale) }} ·
                    {{ actorLabel(entry) }}
                  </p>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <!-- Side column -->
        <div class="space-y-4">
          <section v-if="record.campaignId" class="card p-4">
            <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
              {{ $t('kyc.campaignSection') }}
            </h2>

            <RouterLink
              :to="{ name: 'campaign-detail', params: { id: record.campaignId } }"
              class="block rounded text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              {{ record.campaignName }}
            </RouterLink>
            <p v-if="record.campaignCode" class="numeric mt-0.5 text-xs text-muted dark:text-slate-400">
              {{ record.campaignCode }}
            </p>
            <AppBadge v-if="record.isLateAttribution" :classes="NEUTRAL_BADGE" class="mt-2">
              {{ $t('kyc.lateAttribution') }}
            </AppBadge>
          </section>

          <!--
            The customer's result link. It addresses the result page without a credential, so it is
            never persisted here, never put into the URL of this page, and only ever shown on this
            single-record view - the listing deliberately does not carry it.
          -->
          <section v-if="record.publicResultUrl" class="card p-4">
            <h2 class="mb-2 text-sm font-semibold text-ink dark:text-slate-100">
              {{ $t('kyc.publicResultUrl') }}
            </h2>

            <div class="flex items-center gap-2">
              <AppBadge
                :classes="linkStateStyle(record.publicLinkState).classes"
                :dot="linkStateStyle(record.publicLinkState).dot"
              >
                {{ $t(linkStateStyle(record.publicLinkState).labelKey) }}
              </AppBadge>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-1.5">
              <AppButton size="sm" @click="copy(record.publicResultUrl)">
                <Copy class="h-3.5 w-3.5" aria-hidden="true" />
                {{ $t('actions.copy') }}
              </AppButton>
              <AppButton
                size="sm"
                variant="ghost"
                @click="openInNewTab(record.publicResultUrl)"
              >
                <ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
                {{ $t('actions.openLink') }}
              </AppButton>

              <!--
                Revoking is how an exposed link is withdrawn before it expires, so it is offered
                wherever the link is live. An expired link is not offered a restore: reopening does
                not extend its life, so the button would promise something it cannot do.
              -->
              <AppButton
                v-if="can.canUpdateKyc.value && record.publicLinkState === 'Disabled'"
                size="sm"
                variant="ghost"
                :loading="togglingLink"
                @click="setLinkEnabled(true)"
              >
                <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
                {{ $t('kyc.restoreLink') }}
              </AppButton>
              <AppButton
                v-else-if="can.canUpdateKyc.value && record.publicLinkState === 'Active'"
                size="sm"
                variant="danger"
                :loading="togglingLink"
                @click="confirmRevokeLink = true"
              >
                <Ban class="h-3.5 w-3.5" aria-hidden="true" />
                {{ $t('kyc.revokeLink') }}
              </AppButton>
            </div>

            <p v-if="record.publicLinkExpiresAt" class="mt-2 text-xs text-muted dark:text-slate-400">
              {{ $t('kyc.publicLinkExpires') }}:
              {{ formatDateTime(record.publicLinkExpiresAt, ui.locale) }}
            </p>
          </section>

          <section class="card p-4">
            <h2 class="mb-3 text-sm font-semibold text-ink dark:text-slate-100">
              {{ $t('kyc.metadataSection') }}
            </h2>

            <dl class="space-y-3">
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.createdAt') }}</dt>
                <dd class="text-sm text-ink dark:text-slate-100">
                  {{ formatDateTime(record.createdAt, ui.locale) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted dark:text-slate-400">{{ $t('kyc.updatedAt') }}</dt>
                <dd class="text-sm text-ink dark:text-slate-100">
                  {{ formatDateTime(record.updatedAt, ui.locale) }}
                </dd>
              </div>
              <div v-if="record.statusChangedAt">
                <dt class="text-xs text-muted dark:text-slate-400">
                  {{ $t('kyc.statusChangedAt') }}
                </dt>
                <dd class="text-sm text-ink dark:text-slate-100">
                  {{ formatDateTime(record.statusChangedAt, ui.locale) }}
                </dd>
              </div>
              <div v-if="record.externalReferenceId">
                <dt class="text-xs text-muted dark:text-slate-400">
                  {{ $t('kyc.externalReference') }}
                </dt>
                <dd class="numeric truncate text-sm text-ink dark:text-slate-100">
                  {{ record.externalReferenceId }}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </template>

    <ConfirmDialog
      :open="confirmDelete"
      :title="$t('kyc.deleteConfirm')"
      :body="$t('kyc.deleteExplain')"
      :confirm-label="$t('actions.delete')"
      danger
      :loading="deleting"
      @confirm="remove"
      @cancel="confirmDelete = false"
    />

    <ConfirmDialog
      :open="confirmRevokeLink"
      :title="$t('kyc.revokeLinkConfirm')"
      :body="$t('kyc.revokeLinkExplain')"
      :confirm-label="$t('kyc.revokeLink')"
      danger
      :loading="togglingLink"
      @confirm="setLinkEnabled(false)"
      @cancel="confirmRevokeLink = false"
    />
  </div>
</template>
