import { API_V1, get, getPage, post, queryParams, type Page } from './client'
import type {
  ApiClientCreated,
  ApiClientDetails,
  ApiClientListItem,
  ApiClientListParams,
  ApiScopeOption,
  CreateApiClientRequest,
  RotatedSecret,
} from './types'

/**
 * API client administration. SuperAdmin only, and mapped outside the versioned business group.
 *
 * ## The secret key
 *
 * Creating a client and rotating its secret are the only two responses in the whole API that carry
 * a plaintext key. The backend stores it as a hash, so it genuinely cannot be read back afterwards
 * - if the operator loses it, the only remedy is another rotation.
 *
 * That makes the handling rule absolute, and it is enforced at the call sites rather than trusted
 * to a convention: the returned secret is shown once, in a modal, and is never written to a store,
 * localStorage, sessionStorage, a URL, a log line or an analytics event. It lives in one ref for
 * the lifetime of that dialog and is dropped when it closes.
 */
const BASE = '/api/admin/api-clients'

/** GET /api/admin/api-clients - secret keys are never part of this response. */
export function getApiClients(
  params: ApiClientListParams = {},
  signal?: AbortSignal,
): Promise<Page<ApiClientListItem>> {
  return getPage<ApiClientListItem>(BASE, { params: queryParams({ ...params }), signal })
}

/** GET /api/admin/api-clients/{id} - returns the key's prefix and state, never the key. */
export function getApiClient(id: string, signal?: AbortSignal): Promise<ApiClientDetails> {
  return get<ApiClientDetails>(`${BASE}/${id}`, { signal })
}

/**
 * POST /api/admin/api-clients
 *
 * Returns the plaintext secret exactly once. Show it, let the operator copy it, and discard it.
 */
export function createApiClient(request: CreateApiClientRequest): Promise<ApiClientCreated> {
  return post<ApiClientCreated>(BASE, request)
}

/** POST /api/admin/api-clients/{id}/activate - 409 for a revoked client; revocation is final. */
export function activateApiClient(id: string): Promise<ApiClientDetails> {
  return post<ApiClientDetails>(`${BASE}/${id}/activate`)
}

/** POST /api/admin/api-clients/{id}/deactivate - immediate, and reversible. */
export function deactivateApiClient(id: string): Promise<ApiClientDetails> {
  return post<ApiClientDetails>(`${BASE}/${id}/deactivate`)
}

/** POST /api/admin/api-clients/{id}/revoke - permanent. Idempotent. */
export function revokeApiClient(id: string): Promise<ApiClientDetails> {
  return post<ApiClientDetails>(`${BASE}/${id}/revoke`)
}

/**
 * POST /api/admin/api-clients/{id}/rotate-secret
 *
 * The previous key stops working immediately - there is no overlap window - so the confirmation
 * dialog says so before this is called. A revoked client cannot be rotated and answers 409.
 */
export function rotateApiClientSecret(id: string): Promise<RotatedSecret> {
  return post<RotatedSecret>(`${BASE}/${id}/rotate-secret`)
}

/** GET /api/v1/enums/scopes - the scope catalogue, so the picker is never hard-coded. */
export function getApiScopes(signal?: AbortSignal): Promise<ApiScopeOption[]> {
  return get<ApiScopeOption[]>(`${API_V1}/enums/scopes`, { signal })
}
