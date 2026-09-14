<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info, Plus, RefreshCw } from 'lucide-vue-next'

import { authApi, type OperatorRole, type OperatorRoleOption } from '@/api'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import { useListQuery } from '@/composables/useListQuery'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage, fieldErrors } from '@/utils/errors'
import { formatDateShort, formatRelative } from '@/utils/format'
import { ACTIVE_BADGE, INACTIVE_BADGE, NEUTRAL_BADGE } from '@/utils/status'

const { t } = useI18n()
const ui = useUiStore()

const query = useListQuery({
  defaults: { search: '', role: '' as string },
  fetcher: (filters, page, pageSize, signal) =>
    authApi.getOperators(
      {
        search: filters.search || undefined,
        role: filters.role === '' ? undefined : (filters.role as OperatorRole),
        page,
        pageSize,
      },
      signal,
    ),
})

const roles = ref<OperatorRoleOption[]>([])
const controller = new AbortController()

onMounted(async () => {
  try {
    roles.value = await authApi.getRoles()
  } catch {
    // The role picker falls back to the backend's own default of Admin.
  }
})

onBeforeUnmount(() => controller.abort())

const showForm = ref(false)
const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
const form = ref({ username: '', email: '', password: '', role: '' })

function openCreate() {
  form.value = { username: '', email: '', password: '', role: '' }
  formErrors.value = {}
  showForm.value = true
}

async function save() {
  formErrors.value = {}

  const errors: Record<string, string> = {}
  if (form.value.username.trim().length < 3) errors.username = t('validation.minLength', { min: 3 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) errors.email = t('validation.email')
  if (form.value.password.length < 12) errors.password = t('auth.passwordPolicy')

  if (Object.keys(errors).length > 0) {
    formErrors.value = errors
    return
  }

  saving.value = true

  try {
    await authApi.createOperator({
      username: form.value.username.trim(),
      email: form.value.email.trim(),
      password: form.value.password,
      // Omitted means the backend's default, which is Admin - the regular operator role.
      role: form.value.role === '' ? null : (form.value.role as OperatorRole),
    })

    // The password is not echoed back and is not kept here either; it was handed over out of band.
    form.value.password = ''
    showForm.value = false
    ui.notify('success', t('operators.created'))
    await query.load()
  } catch (caught) {
    formErrors.value = fieldErrors(caught)
    ui.notify('error', errorMessage(caught, t))
  } finally {
    saving.value = false
  }
}

const roleOptions = computed(() =>
  roles.value.map((role) => ({ value: role.value, label: role.label })),
)

const roleLabel = (role: OperatorRole) =>
  role === 'SuperAdmin' ? t('operators.roleSuperAdmin') : t('operators.roleAdmin')
</script>

<template>
  <div>
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-ink dark:text-slate-100">{{ $t('operators.title') }}</h1>

      <div class="flex items-center gap-2">
        <AppButton size="sm" :loading="query.loading.value" @click="query.load()">
          <RefreshCw class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('actions.refresh') }}</span>
        </AppButton>
        <AppButton variant="primary" size="sm" @click="openCreate">
          <Plus class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('operators.create') }}</span>
        </AppButton>
      </div>
    </header>

    <div class="card">
      <div class="flex flex-wrap items-center gap-2 p-3">
        <div class="min-w-0 flex-1 sm:max-w-sm">
          <SearchInput v-model="query.filters.value.search" />
        </div>
        <div class="w-44">
          <AppSelect
            v-model="query.filters.value.role"
            :options="roleOptions"
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
                <th scope="col">{{ $t('operators.username') }}</th>
                <th scope="col">{{ $t('operators.email') }}</th>
                <th scope="col">{{ $t('operators.role') }}</th>
                <th scope="col">{{ $t('operators.isActive') }}</th>
                <th scope="col">{{ $t('operators.lastLogin') }}</th>
                <th scope="col">{{ $t('operators.createdAt') }}</th>
              </tr>
            </thead>

            <tbody>
              <AppSkeleton v-if="query.loading.value" :rows="6" :columns="6" />

              <tr v-for="operator in query.items.value" v-else :key="operator.id">
                <td class="font-medium">{{ operator.username }}</td>
                <td class="truncate">{{ operator.email }}</td>
                <td>
                  <AppBadge :classes="NEUTRAL_BADGE">{{ roleLabel(operator.role) }}</AppBadge>
                </td>
                <td>
                  <AppBadge :classes="operator.isActive ? ACTIVE_BADGE : INACTIVE_BADGE">
                    {{ operator.isActive ? $t('apiClients.active') : $t('apiClients.inactive') }}
                  </AppBadge>
                </td>
                <td class="whitespace-nowrap text-muted dark:text-slate-400">
                  {{
                    operator.lastLoginAt
                      ? formatRelative(operator.lastLoginAt, ui.locale)
                      : $t('auth.never')
                  }}
                </td>
                <td class="whitespace-nowrap text-muted dark:text-slate-400">
                  {{ formatDateShort(operator.createdAt, ui.locale) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <EmptyState
          v-if="!query.loading.value && query.items.value.length === 0"
          :title="$t('empty.operators')"
          :hint="$t('empty.operatorsHint')"
        />

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

    <AppModal :open="showForm" :title="$t('operators.create')" @close="showForm = false">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <AppInput
          v-model="form.username"
          :label="$t('operators.username')"
          :error="formErrors.username"
          :maxlength="100"
          autocomplete="off"
          required
        />

        <AppInput
          v-model="form.email"
          type="email"
          :label="$t('operators.email')"
          :error="formErrors.email"
          :maxlength="150"
          autocomplete="off"
          required
        />

        <AppInput
          v-model="form.password"
          type="password"
          :label="$t('operators.password')"
          :hint="$t('auth.passwordPolicy')"
          :error="formErrors.password"
          autocomplete="new-password"
          required
        />

        <AppSelect
          v-model="form.role"
          :options="roleOptions"
          :label="$t('operators.role')"
          :hint="$t('operators.roleHint')"
          :placeholder="$t('operators.roleAdmin')"
          :error="formErrors.role"
        />

        <p
          class="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900 dark:bg-white/5 dark:text-slate-300"
        >
          <Info class="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          {{ $t('operators.passwordNotice') }}
        </p>
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
  </div>
</template>
