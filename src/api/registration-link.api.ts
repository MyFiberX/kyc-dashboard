import { API_V1, get, post, put } from './client'
import type {
  CreateRegistrationLinkRequest,
  RegistrationLink,
  SetRegistrationLinkEnabledRequest,
} from './types'

const BASE = `${API_V1}/registration-links`

/**
 * The public registration links an operator hands out.
 *
 * These accept an operator's bearer token as well as an API key - the backend has always mapped
 * them that way, because administering links is an operator screen.
 */

/** GET /api/v1/registration-links - newest first, not paged: these are few by nature. */
export function getRegistrationLinks(signal?: AbortSignal): Promise<RegistrationLink[]> {
  return get<RegistrationLink[]>(BASE, { signal })
}

/**
 * POST /api/v1/registration-links
 *
 * campaignId is fixed at creation: the URL goes onto printed material, and re-pointing it would
 * re-attribute what that material promised. Issue another link instead.
 */
export function createRegistrationLink(
  request: CreateRegistrationLinkRequest,
): Promise<RegistrationLink> {
  return post<RegistrationLink>(BASE, request)
}

/**
 * PUT /api/v1/registration-links/{id}
 *
 * Switches the page on or off. The token is kept either way, so reopening restores the same URL
 * rather than issuing a new one. Reopening does not override a campaign: a link whose campaign is
 * deactivated or finished still reports itself closed.
 */
export function setRegistrationLinkEnabled(
  id: string,
  request: SetRegistrationLinkEnabledRequest,
): Promise<RegistrationLink> {
  return put<RegistrationLink>(`${BASE}/${id}`, request)
}
