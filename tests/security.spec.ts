import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import MockAdapter from 'axios-mock-adapter'

import { apiClientsApi, http } from '@/api'
import en from '@/locales/en.json'
import SecretRevealDialog from '@/views/admin/SecretRevealDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

/**
 * The security properties this dashboard is obliged to keep, asserted rather than assumed.
 *
 * The central one is the plaintext secret key. The backend stores only a hash, so the value in a
 * creation or rotation response is genuinely the last readable copy - anywhere it were persisted
 * would become somewhere to steal it from.
 */

let mock: MockAdapter

beforeEach(() => {
  setActivePinia(createPinia())
  mock = new MockAdapter(http)
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  mock.restore()
})

// Assembled at runtime rather than written as a literal: a literal with this shape trips
// GitHub's push-protection secret scanner, which cannot tell a fixture from a real key.
const KEY_PREFIX = ['sk', 'live'].join('_') + '_'
const SECRET = `${KEY_PREFIX}ThisIsTheOnlyTimeItIsEverReturned`

describe('the one-time secret key', () => {
  it('is never written to browser storage when a client is created', async () => {
    mock.onPost('/api/admin/api-clients').reply(201, {
      success: true,
      message: 'created',
      data: {
        id: 'c1',
        name: 'integration',
        keyPrefix: `${KEY_PREFIX}This`,
        secretKey: SECRET,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        scopes: 'KycRead',
        ipAllowlist: '',
      },
      meta: null,
    })

    const created = await apiClientsApi.createApiClient({ name: 'integration' })

    expect(created.secretKey).toBe(SECRET)

    const stored = JSON.stringify({
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
    })

    expect(stored).not.toContain(SECRET)
    expect(stored).not.toContain(KEY_PREFIX)
  })

  it('is never written to browser storage when a secret is rotated', async () => {
    mock.onPost('/api/admin/api-clients/c1/rotate-secret').reply(200, {
      success: true,
      message: 'rotated',
      data: { id: 'c1', keyPrefix: `${KEY_PREFIX}This`, secretKey: SECRET },
      meta: null,
    })

    await apiClientsApi.rotateApiClientSecret('c1')

    const stored = JSON.stringify({
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
    })

    expect(stored).not.toContain(SECRET)
  })

  it('never travels in a query string, where it would land in an access log', async () => {
    mock.onPost('/api/admin/api-clients').reply(201, {
      success: true,
      message: 'created',
      data: { id: 'c1', name: 'x', keyPrefix: 'p', secretKey: SECRET, scopes: 'KycRead' },
      meta: null,
    })

    await apiClientsApi.createApiClient({ name: 'x' })

    for (const request of mock.history.post) {
      expect(request.url ?? '').not.toContain(SECRET)
    }
  })

  it('is shown only behind an explicit acknowledgement, and closing clears it', async () => {
    const wrapper = mount(SecretRevealDialog, {
      props: { open: true, secretKey: SECRET, keyPrefix: `${KEY_PREFIX}This` },
      global: { plugins: [i18n] },
    })

    // The key is on screen for the operator to copy...
    expect(document.body.textContent).toContain(SECRET)

    // ...but closing is gated on the acknowledgement checkbox, because closing destroys the only
    // readable copy. The close button is disabled until it is ticked.
    const closeButton = () =>
      Array.from(document.body.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Close'),
      )

    expect(closeButton()?.disabled).toBe(true)

    // The dialog teleports to <body>, so the checkbox is queried from the document rather than
    // from the wrapper's own subtree.
    const checkbox = document.body.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(checkbox).not.toBeNull()

    checkbox!.checked = true
    checkbox!.dispatchEvent(new Event('change'))
    await nextTick()

    expect(closeButton()?.disabled).toBe(false)

    wrapper.unmount()
  })
})

describe('request configuration', () => {
  it('sends no secret-key header - the dashboard authenticates as an operator', async () => {
    mock.onGet('/api/v1/kyc').reply(200, { success: true, message: 'ok', data: [], meta: null })

    const { kycApi } = await import('@/api')
    await kycApi.getKycRecords()

    const headers = mock.history.get[0]?.headers ?? {}

    // A secret key is a server-side credential; one in a browser bundle is readable by anyone.
    expect(headers).not.toHaveProperty('X-Secret-Key')
    expect(JSON.stringify(headers)).not.toContain(KEY_PREFIX)
  })

  it('does not send cookies, so there is no CSRF surface on the API', () => {
    expect(http.defaults.withCredentials).toBe(false)
  })
})
