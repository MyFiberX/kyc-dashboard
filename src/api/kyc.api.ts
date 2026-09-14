import { API_V1, get, getPage, post, put, queryParams, remove, type Page } from './client'
import type {
  AnalyticsWindowParams,
  CreateKycRequest,
  KycCampaignBreakdown,
  KycDailyPoint,
  KycListParams,
  KycPublicLink,
  KycRecord,
  KycStatusHistoryEntry,
  KycStatusOption,
  KycSummary,
  UpdateKycRequest,
} from './types'

const BASE = `${API_V1}/kyc`

/**
 * GET /api/v1/kyc
 *
 * Answers either an offset page or a cursor page depending on whether `cursor` is sent; the meta
 * says which came back. List rows deliberately carry no publicResultUrl.
 */
export function getKycRecords(
  params: KycListParams = {},
  signal?: AbortSignal,
): Promise<Page<KycRecord>> {
  return getPage<KycRecord>(BASE, { params: queryParams({ ...params }), signal })
}

/** GET /api/v1/kyc/{id} - the only route that returns the record's public result URL. */
export function getKycRecord(id: string, signal?: AbortSignal): Promise<KycRecord> {
  return get<KycRecord>(`${BASE}/${id}`, { signal })
}

/** GET /api/v1/kyc/{id}/history - oldest first; outlives a logical delete. Not paged. */
export function getKycHistory(
  id: string,
  signal?: AbortSignal,
): Promise<KycStatusHistoryEntry[]> {
  return get<KycStatusHistoryEntry[]>(`${BASE}/${id}/history`, { signal })
}

/** GET /api/v1/kyc/statuses - the status catalogue, so the UI never hard-codes it. */
export function getKycStatuses(signal?: AbortSignal): Promise<KycStatusOption[]> {
  return get<KycStatusOption[]>(`${BASE}/statuses`, { signal })
}

/**
 * POST /api/v1/kyc
 *
 * `idempotencyKey` goes in the Idempotency-Key header: replaying the same key returns the original
 * record instead of creating a second one, which is what makes a double-submitted form safe.
 */
export function createKyc(
  request: CreateKycRequest,
  idempotencyKey?: string,
): Promise<KycRecord> {
  return post<KycRecord>(BASE, request, {
    headers: idempotencyKey !== undefined ? { 'Idempotency-Key': idempotencyKey } : undefined,
  })
}

/** PUT /api/v1/kyc/{id} - partial: the backend accepts status here and nothing else. */
export function updateKyc(id: string, request: UpdateKycRequest): Promise<KycRecord> {
  return put<KycRecord>(`${BASE}/${id}`, request)
}

/**
 * POST /api/v1/kyc/{id}/disable-link
 *
 * Closes the customer's result page. The page is addressed by an unguessable token rather than a
 * credential, so anyone holding the URL can read that customer's details until it expires - this is
 * how a link that has been forwarded or otherwise exposed is withdrawn before then. Afterwards the
 * page answers 410, exactly as an expired one does.
 *
 * The token is kept, so the same URL works again if the link is re-enabled. Idempotent: disabling
 * an already-disabled link succeeds and reports the state.
 */
export function disableKycPublicLink(id: string): Promise<KycPublicLink> {
  return post<KycPublicLink>(`${BASE}/${id}/disable-link`)
}

/**
 * POST /api/v1/kyc/{id}/enable-link
 *
 * Reopens a closed link on the same URL as before - the token is never discarded, so material
 * already sent to the customer keeps working. Re-enabling does not extend the link's life: one
 * whose expiry has passed still reports itself expired, and the returned state shows what it
 * ended up as.
 */
export function enableKycPublicLink(id: string): Promise<KycPublicLink> {
  return post<KycPublicLink>(`${BASE}/${id}/enable-link`)
}

/** DELETE /api/v1/kyc/{id} - logical delete, 204 with no body. */
export function deleteKyc(id: string): Promise<void> {
  return remove(`${BASE}/${id}`)
}

// ---------------------------------------------------------------------------
// Analytics
//
// summary and by-campaign run over a date window: omitted it is the last 30 days, and a range
// wider than 366 days is refused with 400 rather than quietly shortened. The UI must not offer a
// range the backend will reject - see ANALYTICS_MAX_DAYS.
// ---------------------------------------------------------------------------

export const ANALYTICS_DEFAULT_DAYS = 30
export const ANALYTICS_MAX_DAYS = 366

/** The daily trend takes a day count instead of a window: clamped to 1..90, default 7. */
export const DAILY_DEFAULT_DAYS = 7
export const DAILY_MAX_DAYS = 90

/** GET /api/v1/kyc/summary */
export function getKycSummary(
  params: AnalyticsWindowParams & { search?: string; provinceId?: string; regionId?: string } = {},
  signal?: AbortSignal,
): Promise<KycSummary> {
  return get<KycSummary>(`${BASE}/summary`, { params: queryParams({ ...params }), signal })
}

/** GET /api/v1/kyc/daily */
export function getKycDaily(days?: number, signal?: AbortSignal): Promise<KycDailyPoint[]> {
  return get<KycDailyPoint[]>(`${BASE}/daily`, { params: queryParams({ days }), signal })
}

/** GET /api/v1/kyc/by-campaign - busiest first; unattributed records come back with a null id. */
export function getKycByCampaign(
  params: AnalyticsWindowParams & { top?: number } = {},
  signal?: AbortSignal,
): Promise<KycCampaignBreakdown[]> {
  return get<KycCampaignBreakdown[]>(`${BASE}/by-campaign`, {
    params: queryParams({ ...params }),
    signal,
  })
}
