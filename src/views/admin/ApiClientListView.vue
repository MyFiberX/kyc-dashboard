<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, RefreshCw } from 'lucide-vue-next'

import { apiClientsApi, type ApiClientListItem, type ApiScopeOption } from '@/api'
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
import SecretRevealDialog from './SecretRevealDialog.vue'
import { useListQuery } from '@/composables/useListQuery'
import { useUiStore } from '@/stores/ui.store'
import { errorMessage, fieldErrors, isConflict } from '@/utils/errors'
import { formatDateShort, formatRelative } from '@/utils/format'
import { ACTIVE_BADGE, DANGER_BADGE, INACTIVE_BADGE, NEUTRAL_BADGE } from '@/utils/status'

const { t } = useI18n()
const ui = useUiStore()

const query = useListQuery({
  defaults: { search: '', state: '' as string },
  fetcher: (filters, page, pageSize, signal) =>
    apiClientsApi.getApiClients(
      {
        search: filters.search || undefined,
        // The three flags are independent on the API; the UI offers them as one state picker,
        // which is how an operator thinks about a key.
        isActive: filters.state === 'active' ? true : undefined,
        isRevoked:
          filters.state === 'revoked' ? true : filters.state === 'active' ? false : undefined,
        isExpired:
          filters.state === 'expired' ? true : filters.state === 'active' ? false : undefined,
        page,
        pageSize,
      },
      signal,
    ),
})

const scopes = ref<ApiScopeOption[]>([])
const controller = new AbortController()

onMounted(async () => {
  try {
    scopes.value = await apiClientsApi.getApiScopes(controller.signal)
  } catch {
    // The scope picker falls back to the default grant if the catalogue cannot be read.
  }
})

onBeforeUnmount(() => controller.abort())

// --- Create ----------------------------------------------------------------

const showForm = ref(false)
const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
/** scopes is a set - the backend takes several, combined into one comma-separated value. */
const form = ref<{
  name: string
  description: string
  scopes: string[]
  expiresAt: string
  ipAllowlist: string
}>({ name: '', description: '', scopes: [], expiresAt: '', ipAllowlist: '' })

/**
 * The one-time secret. Held in a plain ref for the life of the dialog and cleared as it closes -
 * never in a store, never in storage.
 */
const revealed = ref<{ secretKey: string; keyPrefix: string } | null>(null)

function openCreate() {
  form.value = { name: '', description: '', scopes: [], expiresAt: '', ipAllowlist: '' }
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
    const created = await apiClientsApi.createApiClient({
      name: form.value.name.trim(),
      description: form.value.description.trim() === '' ? null : form.value.description.trim(),
      // Comma separated, which is how the backend parses a grant: it splits on commas and combines
      // the named scopes. Omitted entirely rather than sent empty - an omitted scopes field means
      // the default grant, where an empty string would name no scope at all.
      scopes: form.value.scopes.length === 0 ? undefined : form.value.scopes.join(','),
      expiresAt: form.value.expiresAt === '' ? null : new Date(form.value.expiresAt).toISOString(),
      ipAllowlist: form.value.ipAllowlist.trim() === '' ? null : form.value.ipAllowlist.trim(),
    })

    showForm.value = false
    ui.notify('success', t('apiClients.created'))

    revealed.value = { secretKey: created.secretKey, keyPrefix: created.keyPrefix }

    await query.load()
  } catch (caught) {
    formErrors.value = fieldErrors(caught)
    ui.notify('error', errorMessage(caught, t))
  } finally {
    saving.value = false
  }
}

// --- Lifecycle actions -----------------------------------------------------

const confirmRevoke = ref<ApiClientListItem | null>(null)
const confirmDeactivate = ref<ApiClientListItem | null>(null)
const confirmRotate = ref<ApiClientListItem | null>(null)
const busy = ref(false)

async function activate(client: ApiClientListItem) {
  busy.value = true

  try {
    await apiClientsApi.activateApiClient(client.id)
    ui.notify('success', t('apiClients.activated'))
    await query.load()
  } catch (caught) {
    // Revocation is final: a revoked client answers 409 here, and saying so is more use than the
    // generic conflict message.
    ui.notify('error', isConflict(caught) ? t('apiClients.cannotReactivate') : errorMessage(caught, t))
  } finally {
    busy.value = false
  }
}

async function deactivate() {
  const client = confirmDeactivate.value
  if (client === null) return

  busy.value = true

  try {
    await apiClientsApi.deactivateApiClient(client.id)
    ui.notify('success', t('apiClients.deactivated'))
    confirmDeactivate.value = null
    await query.load()
  } catch (caught) {
    ui.notify('error', errorMessage(caught, t))
  } finally {
    busy.value = false
  }
}

async function revoke() {
  const client = confirmRevoke.value
  if (client === null) return

  busy.value = true

  try {
    await apiClientsApi.revokeApiClient(client.id)
    ui.notify('success', t('apiClients.revokedToast'))
    confirmRevoke.value = null
    await query.load()
  } catch (caught) {
    ui.notify('error', errorMessage(caught, t))
  } finally {
    busy.value = false
  }
}

async function rotate() {
  const client = confirmRotate.value
  if (client === null) return

  busy.value = true

  try {
    const rotated = await apiClientsApi.rotateApiClientSecret(client.id)

    confirmRotate.value = null
    ui.notify('success', t('apiClients.rotated'))

    revealed.value = { secretKey: rotated.secretKey, keyPrefix: rotated.keyPrefix }

    await query.load()
  } catch (caught) {
    ui.notify(
      'error',
      isConflict(caught) ? t('apiClients.cannotRotateRevoked') : errorMessage(caught, t),
    )
    confirmRotate.value = null
  } finally {
    busy.value = false
  }
}

function stateOf(client: ApiClientListItem) {
  if (client.isRevoked) return { label: t('apiClients.revoked'), classes: DANGER_BADGE }
  if (client.isExpired) return { label: t('apiClients.expired'), classes: INACTIVE_BADGE }
  if (!client.isActive) return { label: t('apiClients.inactive'), classes: INACTIVE_BADGE }
  return { label: t('apiClients.active'), classes: ACTIVE_BADGE }
}

const stateOptions = computed(() => [
  { value: 'active', label: t('apiClients.active') },
  { value: 'revoked', label: t('apiClients.revoked') },
  { value: 'expired', label: t('apiClients.expired') },
])

/**
 * Scopes are a set, not a choice: a key almost always needs several, and the backend combines them
 * from one comma-separated value. Each is offered with its description, because what a scope permits
 * is the whole decision being made here.
 */
function isScopeSelected(value: string): boolean {
  return form.value.scopes.includes(value)
}

function toggleScope(value: string): void {
  form.value.scopes = isScopeSelected(value)
    ? form.value.scopes.filter((scope) => scope !== value)
    : [...form.value.scopes, value]
}

function selectAllScopes(): void {
  form.value.scopes = scopes.value.map((scope) => scope.value)
}

function clearScopes(): void {
  form.value.scopes = []
}
</script>

<template>
  <div>
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-ink dark:text-slate-100">
        {{ $t('apiClients.title') }}
      </h1>

      <div class="flex items-center gap-2">
        <AppButton size="sm" :loading="query.loading.value" @click="query.load()">
          <RefreshCw class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('actions.refresh') }}</span>
        </AppButton>
        <AppButton variant="primary" size="sm" @click="openCreate">
          <Plus class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ $t('apiClients.create') }}</span>
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
            v-model="query.filters.value.state"
            :options="stateOptions"
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
                <th scope="col">{{ $t('apiClients.name') }}</th>
                <th scope="col">{{ $t('apiClients.keyPrefix') }}</th>
                <th scope="col">{{ $t('apiClients.scopes') }}</th>
                <th scope="col">{{ $t('apiClients.state') }}</th>
                <th scope="col">{{ $t('apiClients.lastUsedAt') }}</th>
                <th scope="col">{{ $t('apiClients.expiresAt') }}</th>
                <th scope="col"><span class="sr-only">{{ $t('table.actions') }}</span></th>
              </tr>
            </thead>

            <tbody>
              <AppSkeleton v-if="query.loading.value" :rows="6" :columns="7" />

              <tr v-for="client in query.items.value" v-else :key="client.id">
                <td>
                  <p class="font-medium">{{ client.name }}</p>
                  <p
                    v-if="client.description"
                    class="max-w-[240px] truncate text-xs text-muted dark:text-slate-400"
                  >
                    {{ client.description }}
                  </p>
                </td>
                <!-- The prefix identifies a key without being one; the key itself is unreadable. -->
                <td class="numeric">{{ client.keyPrefix }}</td>
                <td>
                  <AppBadge :classes="NEUTRAL_BADGE">{{ client.scopes }}</AppBadge>
                </td>
                <td>
                  <AppBadge :classes="stateOf(client).classes">{{ stateOf(client).label }}</AppBadge>
                </td>
                <td class="whitespace-nowrap text-muted dark:text-slate-400">
                  {{ client.lastUsedAt ? formatRelative(client.lastUsedAt, ui.locale) : '—' }}
                </td>
                <td class="whitespace-nowrap text-muted dark:text-slate-400">
                  {{
                    client.expiresAt
                      ? formatDateShort(client.expiresAt, ui.locale)
                      : $t('apiClients.neverExpires')
                  }}
                </td>
                <td>
                  <div class="flex items-center justify-end gap-1">
                    <AppButton
                      v-if="!client.isRevoked"
                      size="sm"
                      variant="ghost"
                      :disabled="busy"
                      @click="client.isActive ? (confirmDeactivate = client) : activate(client)"
                    >
                      {{ client.isActive ? $t('actions.deactivate') : $t('actions.activate') }}
                    </AppButton>

                    <AppButton
                      v-if="!client.isRevoked"
                      size="sm"
                      variant="ghost"
                      :disabled="busy"
                      @click="confirmRotate = client"
                    >
                      {{ $t('actions.rotate') }}
                    </AppButton>

                    <AppButton
                      v-if="!client.isRevoked"
                      size="sm"
                      variant="ghost"
                      :disabled="busy"
                      @click="confirmRevoke = client"
                    >
                      {{ $t('actions.revoke') }}
                    </AppButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <EmptyState
          v-if="!query.loading.value && query.items.value.length === 0"
          :title="$t('empty.apiClients')"
          :hint="$t('empty.apiClientsHint')"
        >
          <template #actions>
            <AppButton variant="primary" size="sm" @click="openCreate">
              {{ $t('apiClients.create') }}
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

    <!-- Create -->
    <AppModal :open="showForm" :title="$t('apiClients.create')" size="lg" @close="showForm = false">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <AppInput
          v-model="form.name"
          :label="$t('apiClients.name')"
          :error="formErrors.name"
          :maxlength="200"
          required
        />

        <div>
          <label class="field-label" for="client-description">
            {{ $t('apiClients.description') }}
          </label>
          <textarea
            id="client-description"
            v-model="form.description"
            rows="2"
            maxlength="1000"
            class="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
          />
        </div>

        <fieldset>
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <legend class="field-label">
              {{ $t('apiClients.scopes') }}
              <span class="font-normal text-muted dark:text-slate-400">
                &middot;
                {{
                  form.scopes.length === 0
                    ? $t('apiClients.scopeDefault')
                    : $t('apiClients.scopeSelected', { count: form.scopes.length })
                }}
              </span>
            </legend>

            <div class="flex items-center gap-2 text-xs">
              <button
                type="button"
                class="text-brand-700 hover:underline dark:text-brand-300"
                @click="selectAllScopes"
              >
                {{ $t('apiClients.scopeSelectAll') }}
              </button>
              <button
                type="button"
                class="text-muted hover:underline dark:text-slate-400"
                :disabled="form.scopes.length === 0"
                @click="clearScopes"
              >
                {{ $t('apiClients.scopeClear') }}
              </button>
            </div>
          </div>

          <div
            class="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg p-1 ring-1 ring-inset ring-line dark:ring-white/15"
          >
            <label
              v-for="scope in scopes"
              :key="scope.value"
              class="flex cursor-pointer gap-2 rounded-md p-2 hover:bg-canvas dark:hover:bg-white/5"
            >
              <input
                type="checkbox"
                class="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-brand-600 focus:ring-brand-600 dark:border-white/20 dark:bg-white/5"
                :checked="isScopeSelected(scope.value)"
                @change="toggleScope(scope.value)"
              />
              <span class="min-w-0">
                <span class="block text-sm text-ink dark:text-slate-100">{{ scope.label }}</span>
                <span class="block text-xs text-muted dark:text-slate-400">
                  {{ scope.description }}
                </span>
              </span>
            </label>
          </div>

          <p v-if="formErrors.scopes" class="field-error">{{ formErrors.scopes }}</p>
          <p v-else class="field-hint">{{ $t('apiClients.scopeHint') }}</p>
        </fieldset>

        <div>
          <label class="field-label" for="client-expires">{{ $t('apiClients.expiresAt') }}</label>
          <input
            id="client-expires"
            v-model="form.expiresAt"
            type="date"
            class="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-600 dark:bg-white/5 dark:text-slate-100 dark:ring-white/15"
          />
          <p v-if="formErrors.expiresAt" class="field-error">{{ formErrors.expiresAt }}</p>
          <p v-else class="field-hint">{{ $t('apiClients.expiresHint') }}</p>
        </div>

        <AppInput
          v-model="form.ipAllowlist"
          :label="$t('apiClients.ipAllowlist')"
          :hint="$t('apiClients.ipAllowlistHint')"
          :error="formErrors.ipAllowlist"
          :maxlength="500"
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

    <SecretRevealDialog
      :open="revealed !== null"
      :secret-key="revealed?.secretKey ?? ''"
      :key-prefix="revealed?.keyPrefix ?? ''"
      @close="revealed = null"
    />

    <ConfirmDialog
      :open="confirmDeactivate !== null"
      :title="$t('apiClients.deactivateConfirm')"
      :body="$t('apiClients.deactivateExplain')"
      :confirm-label="$t('actions.deactivate')"
      :loading="busy"
      @confirm="deactivate"
      @cancel="confirmDeactivate = null"
    />

    <ConfirmDialog
      :open="confirmRotate !== null"
      :title="$t('apiClients.rotateConfirm')"
      :body="$t('apiClients.rotateExplain')"
      :confirm-label="$t('actions.rotate')"
      danger
      :loading="busy"
      @confirm="rotate"
      @cancel="confirmRotate = null"
    />

    <ConfirmDialog
      :open="confirmRevoke !== null"
      :title="$t('apiClients.revokeConfirm')"
      :body="$t('apiClients.revokeExplain')"
      :confirm-label="$t('actions.revoke')"
      danger
      :loading="busy"
      @confirm="revoke"
      @cancel="confirmRevoke = null"
    />
  </div>
</template>
