import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'

import { http, kycApi, type PaginationMeta } from '@/api'

/**
 * Listing behaviour: pagination as the backend actually reports it, filters, and the rule that a
 * superseded request must never overwrite a newer one.
 */

let mock: MockAdapter

beforeEach(() => {
  mock = new MockAdapter(http)
})

afterEach(() => {
  mock.restore()
})

const page = (items: unknown[], meta: Partial<PaginationMeta>) => ({
  success: true,
  message: 'ok',
  data: items,
  meta: {
    page: null,
    pageSize: 20,
    totalCount: null,
    totalPages: null,
    nextCursor: null,
    hasMore: null,
    ...meta,
  },
})

describe('pagination contract', () => {
  it('reads an offset page with its total', async () => {
    mock
      .onGet('/api/v1/kyc')
      .reply(200, page([{ id: '1' }], { page: 2, pageSize: 20, totalCount: 45, totalPages: 3 }))

    const result = await kycApi.getKycRecords({ page: 2 })

    expect(result.items).toHaveLength(1)
    expect(result.meta?.totalCount).toBe(45)
    expect(result.meta?.totalPages).toBe(3)
  })

  it('treats an uncounted total as null rather than zero', async () => {
    // includeTotal=false omits the count query; null means "not counted", which is not "no results".
    mock.onGet('/api/v1/kyc').reply(200, page([{ id: '1' }], { page: 1, pageSize: 20 }))

    const result = await kycApi.getKycRecords({ includeTotal: false })

    expect(result.meta?.totalCount).toBeNull()
    expect(result.items).toHaveLength(1)
  })

  it('reads a cursor page, which carries no page number or total', async () => {
    mock
      .onGet('/api/v1/kyc')
      .reply(200, page([{ id: '1' }], { pageSize: 200, nextCursor: 'MTc4OTQ', hasMore: true }))

    const result = await kycApi.getKycRecords({ cursor: 'start', pageSize: 200 })

    expect(result.meta?.nextCursor).toBe('MTc4OTQ')
    expect(result.meta?.hasMore).toBe(true)
    expect(result.meta?.page).toBeNull()
  })

  it('returns an empty list rather than null when there is no data', async () => {
    mock.onGet('/api/v1/kyc').reply(200, {
      success: true,
      message: 'ok',
      data: null,
      meta: null,
    })

    const result = await kycApi.getKycRecords()

    // A component iterating the result must never have to null-check it.
    expect(result.items).toEqual([])
  })
})

describe('filters', () => {
  it('passes each filter through as a query parameter', async () => {
    mock.onGet('/api/v1/kyc').reply(200, page([], { page: 1, pageSize: 20, totalCount: 0 }))

    await kycApi.getKycRecords({
      search: '0770',
      status: 'Pending',
      provinceId: 'p1',
      regionId: 'r1',
      campaignId: 'c1',
      page: 1,
      pageSize: 50,
    })

    const params = mock.history.get[0]?.params as Record<string, unknown>

    expect(params).toMatchObject({
      search: '0770',
      status: 'Pending',
      provinceId: 'p1',
      regionId: 'r1',
      campaignId: 'c1',
      pageSize: 50,
    })
  })

  it('omits filters that were cleared', async () => {
    mock.onGet('/api/v1/kyc').reply(200, page([], { page: 1, pageSize: 20, totalCount: 0 }))

    await kycApi.getKycRecords({ search: '', status: undefined, provinceId: 'p1' })

    const params = mock.history.get[0]?.params as Record<string, unknown>

    // Sending search='' would filter on the empty string rather than clearing the filter.
    expect(params).not.toHaveProperty('search')
    expect(params).not.toHaveProperty('status')
    expect(params).toHaveProperty('provinceId', 'p1')
  })
})

describe('request cancellation', () => {
  it('rejects an aborted request so a stale response cannot land', async () => {
    mock.onGet('/api/v1/kyc').reply(() => new Promise(() => {}))

    const controller = new AbortController()
    const pending = kycApi.getKycRecords({ search: 'first' }, controller.signal)

    controller.abort()

    // The caller distinguishes this from a failure and ignores it, rather than showing an error
    // for a search the operator has already moved on from.
    await expect(pending).rejects.toThrow()
  })
})
