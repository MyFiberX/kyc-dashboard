import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'

import { http, kycApi, campaignApi, apiClientsApi, queryParams } from '@/api'

/**
 * Pins the requests this dashboard actually makes against the routes the backend actually serves.
 *
 * These would have caught the two contract mistakes that are easy to make here: the collection is
 * `/api/v1/kyc`, not `/kycs`, and cleared filters must be dropped rather than sent as empty
 * strings, which the backend would read as a filter on "".
 */

let mock: MockAdapter

beforeEach(() => {
  mock = new MockAdapter(http)
})

afterEach(() => {
  mock.restore()
})

const envelope = <T>(data: T, meta: unknown = null) => ({
  success: true,
  message: 'ok',
  data,
  meta,
})

describe('KYC endpoints', () => {
  it('lists records from /api/v1/kyc', async () => {
    mock.onGet('/api/v1/kyc').reply(200, envelope([], { page: 1, pageSize: 20, totalCount: 0 }))

    await kycApi.getKycRecords()

    expect(mock.history.get[0]?.url).toBe('/api/v1/kyc')
  })

  it('reads a single record, which is the only route carrying the public result link', async () => {
    const id = '11111111-1111-1111-1111-111111111111'
    mock.onGet(`/api/v1/kyc/${id}`).reply(200, envelope({ id }))

    await kycApi.getKycRecord(id)

    expect(mock.history.get[0]?.url).toBe(`/api/v1/kyc/${id}`)
  })

  it('sends the idempotency key as a header, not in the body', async () => {
    mock.onPost('/api/v1/kyc').reply(201, envelope({ id: 'x' }))

    await kycApi.createKyc(
      {
        fullName: 'Test',
        mobileNumber: '07700000000',
        provinceId: 'p',
        regionId: 'r',
        internetSubscriptionId: 's',
        subscriptionDuration: 12,
      },
      'key-123',
    )

    const request = mock.history.post[0]
    expect(request?.headers?.['Idempotency-Key']).toBe('key-123')
    expect(request?.data).not.toContain('key-123')
  })

  it('updates only the status, which is the whole update contract', async () => {
    const id = '22222222-2222-2222-2222-222222222222'
    mock.onPut(`/api/v1/kyc/${id}`).reply(200, envelope({ id }))

    await kycApi.updateKyc(id, { status: 'Completed' })

    expect(JSON.parse(mock.history.put[0]?.data as string)).toEqual({ status: 'Completed' })
  })

  it('uses the analytics routes the backend publishes', async () => {
    mock.onGet('/api/v1/kyc/summary').reply(200, envelope({}))
    mock.onGet('/api/v1/kyc/daily').reply(200, envelope([]))
    mock.onGet('/api/v1/kyc/by-campaign').reply(200, envelope([]))

    await kycApi.getKycSummary()
    await kycApi.getKycDaily(30)
    await kycApi.getKycByCampaign({ top: 6 })

    expect(mock.history.get.map((request) => request.url)).toEqual([
      '/api/v1/kyc/summary',
      '/api/v1/kyc/daily',
      '/api/v1/kyc/by-campaign',
    ])
  })

  it("mirrors the backend's analytics window limits", () => {
    // A wider range is refused with 400 rather than shortened, so the UI must not offer one.
    expect(kycApi.ANALYTICS_MAX_DAYS).toBe(366)
    expect(kycApi.ANALYTICS_DEFAULT_DAYS).toBe(30)
    expect(kycApi.DAILY_MAX_DAYS).toBe(90)
  })
})

describe('campaign endpoints', () => {
  it('activates and deactivates through POST sub-routes', async () => {
    const id = '33333333-3333-3333-3333-333333333333'
    mock.onPost(`/api/v1/campaigns/${id}/activate`).reply(200, envelope({ id }))
    mock.onPost(`/api/v1/campaigns/${id}/deactivate`).reply(200, envelope({ id }))

    await campaignApi.activateCampaign(id)
    await campaignApi.deactivateCampaign(id)

    expect(mock.history.post.map((request) => request.url)).toEqual([
      `/api/v1/campaigns/${id}/activate`,
      `/api/v1/campaigns/${id}/deactivate`,
    ])
  })
})

describe('API client administration', () => {
  it('is served outside the versioned business group', async () => {
    mock.onGet('/api/admin/api-clients').reply(200, envelope([], { page: 1, pageSize: 20 }))

    await apiClientsApi.getApiClients()

    expect(mock.history.get[0]?.url).toBe('/api/admin/api-clients')
  })

  it('reads the scope catalogue rather than hard-coding it', async () => {
    mock.onGet('/api/v1/enums/scopes').reply(200, envelope([]))

    await apiClientsApi.getApiScopes()

    expect(mock.history.get[0]?.url).toBe('/api/v1/enums/scopes')
  })
})

describe('queryParams', () => {
  it('drops empty values so a cleared filter disappears from the URL', () => {
    expect(
      queryParams({ search: '', status: 'Pending', provinceId: undefined, page: 1, flag: null }),
    ).toEqual({ status: 'Pending', page: 1 })
  })

  it('keeps false, which is a meaningful filter value', () => {
    // isActive=false means "only the inactive ones", not "no filter".
    expect(queryParams({ isActive: false })).toEqual({ isActive: false })
  })
})
