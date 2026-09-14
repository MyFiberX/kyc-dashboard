import { API_V1, get, getPage, post, put, queryParams, remove, type Page } from './client'
import type {
  Campaign,
  CampaignListParams,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from './types'

const BASE = `${API_V1}/campaigns`

/** GET /api/v1/campaigns - newest first; each row carries its live KYC count. */
export function getCampaigns(
  params: CampaignListParams = {},
  signal?: AbortSignal,
): Promise<Page<Campaign>> {
  return getPage<Campaign>(BASE, { params: queryParams({ ...params }), signal })
}

/** GET /api/v1/campaigns/{id} */
export function getCampaign(id: string, signal?: AbortSignal): Promise<Campaign> {
  return get<Campaign>(`${BASE}/${id}`, { signal })
}

/**
 * POST /api/v1/campaigns
 *
 * The code is not part of the request - the backend issues a fresh six-digit one and returns it on
 * the created campaign. Omit endDate for a campaign that runs until it is deactivated.
 */
export function createCampaign(request: CreateCampaignRequest): Promise<Campaign> {
  return post<Campaign>(BASE, request)
}

/**
 * PUT /api/v1/campaigns/{id}
 *
 * Partial: send only what changed. description and endDate may be sent as null to clear them,
 * while omitting them leaves the stored values alone - so the caller must distinguish the two.
 */
export function updateCampaign(id: string, request: UpdateCampaignRequest): Promise<Campaign> {
  return put<Campaign>(`${BASE}/${id}`, request)
}

/** POST /api/v1/campaigns/{id}/activate - idempotent. */
export function activateCampaign(id: string): Promise<Campaign> {
  return post<Campaign>(`${BASE}/${id}/activate`)
}

/** POST /api/v1/campaigns/{id}/deactivate - keeps every attribution intact; reversible. */
export function deactivateCampaign(id: string): Promise<Campaign> {
  return post<Campaign>(`${BASE}/${id}/deactivate`)
}

/**
 * DELETE /api/v1/campaigns/{id}
 *
 * Logical delete, refused with 409 once any KYC record is attributed to the campaign - the UI
 * offers deactivation instead, which is what the backend's own message recommends.
 */
export function deleteCampaign(id: string): Promise<void> {
  return remove(`${BASE}/${id}`)
}
