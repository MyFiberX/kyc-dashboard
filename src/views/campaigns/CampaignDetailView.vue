<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

import { campaignApi, type Campaign } from '@/api'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { usePermissions } from '@/stores/permissions'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage, isCanceled } from '@/utils/errors'
import { formatDateTime, formatNumber } from '@/utils/format'
import { ACTIVE_BADGE, INACTIVE_BADGE } from '@/utils/status'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const can = usePermissions()

const campaign = ref<Campaign | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)

const controller = new AbortController()
const id = computed(() => String(route.params.id))

async function load() {
  loading.value = true
  error.value = null

  try {
    campaign.value = await campaignApi.getCampaign(id.value, controller.signal)
  } catch (caught) {
    if (isCanceled(caught)) return
    error.value = caught
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => controller.abort())
void load()
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <AppButton size="sm" variant="ghost" class="mb-3" @click="router.push({ name: 'campaigns' })">
      <ArrowLeft class="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
      {{ $t('actions.back') }}
    </AppButton>

    <ErrorState v-if="error" :message="errorMessage(error, $t)" @retry="load" />

    <div v-else-if="loading" class="card p-6">
      <AppSkeleton :rows="8" />
    </div>

    <template v-else-if="campaign">
      <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-xl font-semibold text-ink dark:text-slate-100">
            {{ campaign.name }}
          </h1>
          <p class="numeric mt-0.5 text-sm text-muted dark:text-slate-400">{{ campaign.code }}</p>
        </div>

        <AppBadge :classes="campaign.isActive ? ACTIVE_BADGE : INACTIVE_BADGE">
          {{ campaign.isActive ? $t('apiClients.active') : $t('apiClients.inactive') }}
        </AppBadge>
      </header>

      <section class="card p-4">
        <dl class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <div v-if="campaign.description" class="sm:col-span-2">
            <dt class="text-xs text-muted dark:text-slate-400">{{ $t('campaigns.description') }}</dt>
            <dd class="text-sm text-ink dark:text-slate-100">{{ campaign.description }}</dd>
          </div>

          <div>
            <dt class="text-xs text-muted dark:text-slate-400">{{ $t('campaigns.startDate') }}</dt>
            <dd class="text-sm text-ink dark:text-slate-100">
              {{ formatDateTime(campaign.startDate, ui.locale) }}
            </dd>
          </div>

          <div>
            <dt class="text-xs text-muted dark:text-slate-400">{{ $t('campaigns.endDate') }}</dt>
            <dd class="text-sm text-ink dark:text-slate-100">
              {{ campaign.endDate ? formatDateTime(campaign.endDate, ui.locale) : '—' }}
            </dd>
          </div>

          <div>
            <dt class="text-xs text-muted dark:text-slate-400">{{ $t('campaigns.kycCount') }}</dt>
            <dd class="numeric text-sm font-semibold text-ink dark:text-slate-100">
              {{ formatNumber(campaign.kycCount, ui.locale) }}
            </dd>
          </div>

          <div>
            <dt class="text-xs text-muted dark:text-slate-400">{{ $t('apiClients.createdAt') }}</dt>
            <dd class="text-sm text-ink dark:text-slate-100">
              {{ formatDateTime(campaign.createdAt, ui.locale) }}
            </dd>
          </div>
        </dl>
      </section>

      <!--
        The campaign's records are not embedded in this response by design; they are listed through
        the KYC screen, which already pages and filters them.
      -->
      <AppButton
        v-if="can.canReadKyc.value"
        class="mt-4"
        @click="router.push({ name: 'kyc', query: { campaignId: campaign.id } })"
      >
        {{ $t('nav.kyc') }} ({{ formatNumber(campaign.kycCount, ui.locale) }})
      </AppButton>
    </template>
  </div>
</template>
