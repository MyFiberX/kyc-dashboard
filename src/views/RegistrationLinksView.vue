<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, ExternalLink, Plus, RefreshCw } from 'lucide-vue-next'

import { campaignApi, registrationLinkApi, type Campaign, type RegistrationLink } from '@/api'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { usePermissions } from '@/stores/permissions'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage, fieldErrors, isCanceled } from '@/utils/errors'
import { formatDateShort } from '@/utils/format'
import { ACTIVE_BADGE, INACTIVE_BADGE, linkStateStyle } from '@/utils/status'

const { t } = useI18n()
const ui = useUiStore()
const can = usePermissions()

const links = ref<RegistrationLink[]>([])
const campaigns = ref<Campaign[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

const controller = new AbortController()

/** Not paged: the backend returns them all, because there are few by nature. */
async function load() {
  loading.value = true
  error.value = null

  try {
    links.value = await registrationLinkApi.getRegistrationLinks(controller.signal)
  } catch (caught) {
    if (isCanceled(caught)) return
    error.value = caught
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()

  try {
    // Only active campaigns can usefully back a new link.
    const result = await campaignApi.getCampaigns(
      { isActive: true, pageSize: 200 },
      controller.signal,
    )
    campaigns.value = result.items
  } catch {
    // The campaign selector is optional; a link without one is valid.
  }
})

onBeforeUnmount(() => controller.abort())

// --- Create ----------------------------------------------------------------

const showForm = ref(false)
const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
const form = ref({ name: '', description: '', campaignId: '' })

function openCreate() {
  form.value = { name: '', description: '', campaignId: '' }
  formErrors.value = {}
  showForm.value = true
}

async function save() {
  formErrors.value = {}

  if (form.value.name.trim() === '') {
    formErrors.value = { name: t('validation.required') }
    return
  }

  saving.value = true

  try {
    await registrationLinkApi.createRegistrationLink({
      name: form.value.name.trim(),
      description: form.value.description.trim() === '' ? null : form.value.description.trim(),
      campaignId: form.value.campaignId === '' ? null : form.value.campaignId,
    })

    ui.notify('success', t('registrationLinks.created'))
    showForm.value = false
    await load()
  } catch (caught) {
    formErrors.value = fieldErrors(caught)
    ui.notify('error', errorMessage(caught, t))
  } finally {
    saving.value = false
  }
}

// --- Enable / disable ------------------------------------------------------

const confirmDisable = ref<RegistrationLink | null>(null)
const busyId = ref<string | null>(null)

async function setEnabled(link: RegistrationLink, isEnabled: boolean) {
  busyId.value = link.id

  try {
    await registrationLinkApi.setRegistrationLinkEnabled(link.id, { isEnabled })
    ui.notify('success', t(isEnabled ? 'registrationLinks.enabled' : 'registrationLinks.disabled'))
    confirmDisable.value = null
    await load()
  } catch (caught) {
    ui.notify('error', errorMessage(caught, t))
  } finally {
    busyId.value = null
  }
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    ui.notify('success', t('actions.copied'))
  } catch {
    ui.notify('error', t('actions.copyFailed'))
  }
}

function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const campaignOptions = computed(() =>
  campaigns.value.map((campaign) => ({
    value: campaign.id,
    label: `${campaign.name} (${campaign.code})`,
  })),
)
</script>

<template>
  <div>
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-ink dark:text-slate-100">
        {{ $t('registrationLinks.title') }}
      </h1>

      <div class="flex items-center gap-2">
        <AppButton size="sm" :loading="loading" @click="load">
          <RefreshCw class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('actions.refresh') }}</span>
        </AppButton>
        <AppButton
          v-if="can.canWriteRegistrationLinks.value"
          variant="primary"
          size="sm"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('registrationLinks.create') }}</span>
        </AppButton>
      </div>
    </header>

    <ErrorState v-if="error" :message="errorMessage(error, $t)" @retry="load" />

    <div v-else-if="loading" class="card p-6">
      <AppSkeleton :rows="6" />
    </div>

    <EmptyState
      v-else-if="links.length === 0"
      :title="$t('empty.registrationLinks')"
      :hint="$t('empty.registrationLinksHint')"
    >
      <template #actions>
        <AppButton
          v-if="can.canWriteRegistrationLinks.value"
          variant="primary"
          size="sm"
          @click="openCreate"
        >
          {{ $t('registrationLinks.create') }}
        </AppButton>
      </template>
    </EmptyState>

    <div v-else class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <article v-for="link in links" :key="link.id" class="card p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate font-medium text-ink dark:text-slate-100">{{ link.name }}</h2>
            <p v-if="link.description" class="truncate text-xs text-muted dark:text-slate-400">
              {{ link.description }}
            </p>
          </div>

          <!-- isUsable is the flag to act on; state says which condition is missing. -->
          <AppBadge :classes="link.isUsable ? ACTIVE_BADGE : INACTIVE_BADGE">
            {{ link.isUsable ? $t('registrationLinks.usable') : $t('registrationLinks.notUsable') }}
          </AppBadge>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <AppBadge
            :classes="linkStateStyle(link.state).classes"
            :dot="linkStateStyle(link.state).dot"
          >
            {{ link.stateLabel }}
          </AppBadge>

          <AppBadge v-if="link.campaignName" :classes="INACTIVE_BADGE">
            {{ link.campaignName }}
          </AppBadge>
          <span v-else class="text-xs text-muted dark:text-slate-400">
            {{ $t('registrationLinks.noCampaign') }}
          </span>
        </div>

        <p
          v-if="!link.isUsable && link.campaignId"
          class="mt-2 text-xs text-muted dark:text-slate-400"
        >
          {{ $t('registrationLinks.campaignClosed') }}
        </p>

        <div class="mt-3 flex items-center gap-2 rounded-lg bg-canvas p-2 dark:bg-white/5">
          <p class="numeric min-w-0 flex-1 truncate text-xs text-muted dark:text-slate-400">
            {{ link.publicUrl }}
          </p>
          <AppButton size="sm" variant="ghost" @click="copy(link.publicUrl)">
            <Copy class="h-3.5 w-3.5" aria-hidden="true" />
            <span class="sr-only">{{ $t('actions.copy') }}</span>
          </AppButton>
          <AppButton size="sm" variant="ghost" @click="openInNewTab(link.publicUrl)">
            <ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
            <span class="sr-only">{{ $t('actions.openLink') }}</span>
          </AppButton>
        </div>

        <footer class="mt-3 flex items-center justify-between gap-2">
          <span class="text-xs text-muted dark:text-slate-400">
            {{ formatDateShort(link.createdAt, ui.locale) }}
          </span>

          <AppButton
            v-if="can.canWriteRegistrationLinks.value"
            size="sm"
            :loading="busyId === link.id"
            @click="link.state === 'Disabled' ? setEnabled(link, true) : (confirmDisable = link)"
          >
            {{ link.state === 'Disabled' ? $t('actions.enable') : $t('actions.disable') }}
          </AppButton>
        </footer>
      </article>
    </div>

    <AppModal
      :open="showForm"
      :title="$t('registrationLinks.create')"
      @close="showForm = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <AppInput
          v-model="form.name"
          :label="$t('registrationLinks.name')"
          :hint="$t('registrationLinks.nameHint')"
          :error="formErrors.name"
          :maxlength="200"
          required
        />

        <div>
          <label class="field-label" for="link-description">
            {{ $t('registrationLinks.description') }}
          </label>
          <textarea
            id="link-description"
            v-model="form.description"
            rows="2"
            maxlength="1000"
            class="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
          />
        </div>

        <AppSelect
          v-model="form.campaignId"
          :options="campaignOptions"
          :label="$t('registrationLinks.campaign')"
          :hint="$t('registrationLinks.campaignHint')"
          :placeholder="$t('registrationLinks.noCampaign')"
          :error="formErrors.campaignId"
        />
      </form>

      <template #footer>
        <AppButton variant="ghost" :disabled="saving" @click="showForm = false">
          {{ $t('actions.cancel') }}
        </AppButton>
        <AppButton variant="primary" :loading="saving" @click="save">
          {{ $t('actions.create') }}
        </AppButton>
      </template>
    </AppModal>

    <ConfirmDialog
      :open="confirmDisable !== null"
      :title="$t('registrationLinks.disableConfirm')"
      :body="$t('registrationLinks.disableExplain')"
      :confirm-label="$t('actions.disable')"
      :loading="busyId !== null"
      @confirm="confirmDisable && setEnabled(confirmDisable, false)"
      @cancel="confirmDisable = null"
    />
  </div>
</template>
