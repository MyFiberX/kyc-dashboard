import { API_V1, get, getPage, post, put, queryParams, remove, type Page } from './client'
import type {
  CreateSubscriptionRequest,
  Subscription,
  SubscriptionListParams,
  UpdateSubscriptionRequest,
} from './types'

const BASE = `${API_V1}/subscriptions`

/** GET /api/v1/subscriptions - cheapest first. */
export function getSubscriptions(
  params: SubscriptionListParams = {},
  signal?: AbortSignal,
): Promise<Page<Subscription>> {
  return getPage<Subscription>(BASE, { params: queryParams({ ...params }), signal })
}

/** GET /api/v1/subscriptions/{id} */
export function getSubscription(id: string, signal?: AbortSignal): Promise<Subscription> {
  return get<Subscription>(`${BASE}/${id}`, { signal })
}

/** POST /api/v1/subscriptions */
export function createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
  return post<Subscription>(BASE, request)
}

/**
 * PUT /api/v1/subscriptions/{id}
 *
 * Partial: omitting isActive will not deactivate the plan, and omitting price will not zero it.
 *
 * Changing a price here does not rewrite history - every KYC record keeps the priceAtSubmission it
 * was taken with, which is why a record's total must never be recomputed from this value.
 */
export function updateSubscription(
  id: string,
  request: UpdateSubscriptionRequest,
): Promise<Subscription> {
  return put<Subscription>(`${BASE}/${id}`, request)
}

/** DELETE /api/v1/subscriptions/{id} - logical delete; 409 while KYC records reference it. */
export function deleteSubscription(id: string): Promise<void> {
  return remove(`${BASE}/${id}`)
}
