<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

import {
  kycApi,
  masterDataApi,
  subscriptionApi,
  type CreateKycRequest,
  type Province,
  type Region,
  type Subscription,
} from '@/api'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage, fieldErrors } from '@/utils/errors'
import { formatCurrency } from '@/utils/format'

const router = useRouter()
const { t } = useI18n()
const ui = useUiStore()

const form = ref({
  fullName: '',
  mobileNumber: '',
  email: '',
  nearAddressPoint: '',
  provinceId: '' as string,
  regionId: '' as string,
  internetSubscriptionId: '' as string,
  subscriptionDuration: 12,
  campaignCode: '',
  externalReferenceId: '',
})

const provinces = ref<Province[]>([])
const regions = ref<Region[]>([])
const subscriptions = ref<Subscription[]>([])

const submitting = ref(false)
const serverErrors = ref<Record<string, string>>({})
const localErrors = ref<Record<string, string>>({})

const controller = new AbortController()

/**
 * An idempotency key generated once per form instance.
 *
 * The backend treats a repeat of the same key as the same submission and returns the original
 * record rather than creating a second one - so a double-clicked button or a retried request after
 * a flaky connection cannot produce a duplicate customer. It is regenerated only after a successful
 * submission, because a genuinely new record is a genuinely new submission.
 */
const idempotencyKey = ref(crypto.randomUUID())

onMounted(async () => {
  try {
    const [provinceResult, subscriptionResult] = await Promise.all([
      masterDataApi.getProvinces({ pageSize: 200 }, controller.signal),
      // Only active plans can be sold, so only those are offered.
      subscriptionApi.getSubscriptions({ isActive: true, pageSize: 200 }, controller.signal),
    ])

    provinces.value = provinceResult.items
    subscriptions.value = subscriptionResult.items
  } catch (caught) {
    ui.notify('error', errorMessage(caught, t))
  }
})

onBeforeUnmount(() => controller.abort())

/** Region depends on province, which is the dependency the backend's own data models. */
watch(
  () => form.value.provinceId,
  async (provinceId) => {
    form.value.regionId = ''
    regions.value = []

    if (!provinceId) return

    try {
      const result = await masterDataApi.getRegions(
        { provinceId, pageSize: 200 },
        controller.signal,
      )
      regions.value = result.items
    } catch (caught) {
      ui.notify('error', errorMessage(caught, t))
    }
  },
)

const provinceOptions = computed(() =>
  provinces.value.map((province) => ({ value: province.id, label: province.name })),
)

const regionOptions = computed(() =>
  regions.value.map((region) => ({ value: region.id, label: region.name })),
)

const subscriptionOptions = computed(() =>
  subscriptions.value.map((plan) => ({
    value: plan.id,
    label: `${plan.name} — ${formatCurrency(plan.price, ui.locale)}`,
  })),
)

const selectedPlan = computed(() =>
  subscriptions.value.find((plan) => plan.id === form.value.internetSubscriptionId) ?? null,
)

/** Shown so the operator can confirm the figure with the customer before submitting. */
const estimatedTotal = computed(() => {
  const plan = selectedPlan.value
  if (plan === null) return null

  return plan.price * form.value.subscriptionDuration
})

/** Mirrors the DTO's own constraints, so obvious mistakes are caught before a round trip. */
function validate(): boolean {
  const errors: Record<string, string> = {}

  if (form.value.fullName.trim() === '') errors.fullName = t('validation.required')
  else if (form.value.fullName.length > 150) errors.fullName = t('validation.maxLength', { max: 150 })

  const mobile = form.value.mobileNumber.trim()
  if (mobile === '') errors.mobileNumber = t('validation.required')
  else if (mobile.length < 9 || mobile.length > 20) errors.mobileNumber = t('validation.mobile')

  if (form.value.email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errors.email = t('validation.email')
  }

  if (form.value.provinceId === '') errors.provinceId = t('validation.required')
  if (form.value.regionId === '') errors.regionId = t('validation.required')
  if (form.value.internetSubscriptionId === '') {
    errors.internetSubscriptionId = t('validation.required')
  }

  const duration = Number(form.value.subscriptionDuration)
  if (!Number.isInteger(duration) || duration < 1 || duration > 36) {
    errors.subscriptionDuration = t('validation.min', { min: 1 })
  }

  localErrors.value = errors
  return Object.keys(errors).length === 0
}

const errors = computed(() => ({ ...serverErrors.value, ...localErrors.value }))

async function submit() {
  serverErrors.value = {}

  if (!validate()) {
    ui.notify('error', t('errors.validationSummary'))
    return
  }

  submitting.value = true

  // Optional fields are omitted rather than sent empty: the backend treats an absent field as "not
  // supplied", and an empty string is a different thing entirely.
  const payload: CreateKycRequest = {
    fullName: form.value.fullName.trim(),
    mobileNumber: form.value.mobileNumber.trim(),
    provinceId: form.value.provinceId,
    regionId: form.value.regionId,
    internetSubscriptionId: form.value.internetSubscriptionId,
    subscriptionDuration: Number(form.value.subscriptionDuration),
  }

  if (form.value.email.trim() !== '') payload.email = form.value.email.trim()
  if (form.value.nearAddressPoint.trim() !== '') {
    payload.nearAddressPoint = form.value.nearAddressPoint.trim()
  }
  if (form.value.campaignCode.trim() !== '') payload.campaignCode = form.value.campaignCode.trim()
  if (form.value.externalReferenceId.trim() !== '') {
    payload.externalReferenceId = form.value.externalReferenceId.trim()
  }

  try {
    const record = await kycApi.createKyc(payload, idempotencyKey.value)

    idempotencyKey.value = crypto.randomUUID()
    ui.notify('success', t('kyc.created'))
    await router.push({ name: 'kyc-detail', params: { id: record.id } })
  } catch (caught) {
    serverErrors.value = fieldErrors(caught)
    ui.notify('error', errorMessage(caught, t))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <AppButton size="sm" variant="ghost" class="mb-3" @click="router.push({ name: 'kyc' })">
      <ArrowLeft class="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
      {{ $t('actions.back') }}
    </AppButton>

    <h1 class="mb-4 text-xl font-semibold text-ink dark:text-slate-100">{{ $t('kyc.create') }}</h1>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <section class="card space-y-4 p-4">
        <h2 class="text-sm font-semibold text-ink dark:text-slate-100">
          {{ $t('kyc.customerSection') }}
        </h2>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppInput
            v-model="form.fullName"
            :label="$t('kyc.fullName')"
            :error="errors.fullName"
            :maxlength="150"
            required
          />
          <AppInput
            v-model="form.mobileNumber"
            :label="$t('kyc.mobileNumber')"
            :error="errors.mobileNumber"
            type="tel"
            :maxlength="20"
            numeric
            required
          />
          <AppInput
            v-model="form.email"
            :label="$t('kyc.email')"
            :error="errors.email"
            type="email"
            :maxlength="150"
          />
          <AppInput
            v-model="form.nearAddressPoint"
            :label="$t('kyc.nearAddressPoint')"
            :error="errors.nearAddressPoint"
            :maxlength="250"
          />
        </div>
      </section>

      <section class="card space-y-4 p-4">
        <h2 class="text-sm font-semibold text-ink dark:text-slate-100">
          {{ $t('kyc.locationSection') }}
        </h2>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppSelect
            v-model="form.provinceId"
            :options="provinceOptions"
            :label="$t('kyc.province')"
            :placeholder="$t('masterData.allProvinces')"
            :error="errors.provinceId"
            required
          />
          <AppSelect
            v-model="form.regionId"
            :options="regionOptions"
            :label="$t('kyc.region')"
            :placeholder="
              form.provinceId ? $t('table.selectAll') : $t('masterData.selectProvinceFirst')
            "
            :error="errors.regionId"
            :disabled="!form.provinceId"
            required
          />
        </div>
      </section>

      <section class="card space-y-4 p-4">
        <h2 class="text-sm font-semibold text-ink dark:text-slate-100">
          {{ $t('kyc.subscriptionSection') }}
        </h2>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppSelect
            v-model="form.internetSubscriptionId"
            :options="subscriptionOptions"
            :label="$t('kyc.subscription')"
            :placeholder="$t('table.selectAll')"
            :error="errors.internetSubscriptionId"
            required
          />
          <AppInput
            v-model="form.subscriptionDuration"
            :label="$t('kyc.duration')"
            :error="errors.subscriptionDuration"
            type="number"
            :min="1"
            :max="36"
            numeric
            required
          />
        </div>

        <div
          v-if="estimatedTotal !== null"
          class="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 dark:bg-white/5"
        >
          <span class="text-sm text-muted dark:text-slate-300">{{ $t('kyc.totalPrice') }}</span>
          <span class="numeric text-sm font-semibold text-ink dark:text-slate-100">
            {{ formatCurrency(estimatedTotal, ui.locale) }}
          </span>
        </div>
      </section>

      <section class="card space-y-4 p-4">
        <h2 class="text-sm font-semibold text-ink dark:text-slate-100">
          {{ $t('kyc.campaignSection') }}
        </h2>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppInput
            v-model="form.campaignCode"
            :label="$t('kyc.campaignCode')"
            :error="errors.campaignCode"
            :maxlength="50"
            numeric
          />
          <AppInput
            v-model="form.externalReferenceId"
            :label="$t('kyc.externalReference')"
            :error="errors.externalReferenceId"
            :maxlength="100"
          />
        </div>
      </section>

      <div class="flex justify-end gap-2">
        <AppButton variant="ghost" :disabled="submitting" @click="router.push({ name: 'kyc' })">
          {{ $t('actions.cancel') }}
        </AppButton>
        <!-- Disabled while in flight, which together with the idempotency key prevents duplicates. -->
        <AppButton type="submit" variant="primary" :loading="submitting">
          {{ $t('actions.create') }}
        </AppButton>
      </div>
    </form>
  </div>
</template>
