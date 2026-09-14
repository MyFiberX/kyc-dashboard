import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'

import type { ApiResponse, PaginationMeta } from './types'

/**
 * The canonical prefix. The backend also answers on a bare `/api` alias for integrations written
 * before versioning, but everything it generates names `/api/v1`, so that is what the dashboard
 * speaks.
 */
export const API_V1 = '/api/v1'

/**
 * Base URL for the API. Empty by default, which makes requests same-origin - the dev server
 * proxies them and production serves both together. A deployment that splits the two sets
 * VITE_API_BASE_URL.
 *
 * Note this is public configuration, not a secret: everything in a VITE_ variable is compiled into
 * the bundle and readable by anyone who opens the page. No credential belongs here.
 */
export const baseURL = import.meta.env.VITE_API_BASE_URL ?? ''

/** A parsed API failure. Carries enough for the UI to react without re-reading the response. */
export class ApiError extends Error {
  readonly status: number
  /** Field-level validation messages, keyed by camelCase field name. */
  readonly fieldErrors: Record<string, string[]>
  /** Seconds to wait, from a 429's Retry-After. */
  readonly retryAfter: number | null

  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string[]> = {},
    retryAfter: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.retryAfter = retryAfter
  }

  get isValidation(): boolean {
    return this.status === 400 || this.status === 422
  }

  get isConflict(): boolean {
    return this.status === 409
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

/** A request that was deliberately cancelled - a superseded search, or a page left early. */
export class CanceledError extends Error {
  constructor() {
    super('canceled')
    this.name = 'CanceledError'
  }
}

export const http: AxiosInstance = axios.create({
  baseURL,
  headers: { Accept: 'application/json' },
  // Nothing here uses cookies; the bearer token is attached per request.
  withCredentials: false,
})

// ---------------------------------------------------------------------------
// Token handling
//
// The access token lives in memory only. A refresh token has to outlive a page reload for a session
// to survive one, so it is the single value kept in storage - see auth.store.ts, which owns that
// decision and explains it. Nothing else about a session is persisted, and no token is ever logged.
// ---------------------------------------------------------------------------

type TokenSource = () => string | null
type RefreshHandler = () => Promise<string | null>
type UnauthorizedHandler = () => void

let readAccessToken: TokenSource = () => null
let refreshSession: RefreshHandler = async () => null
let onUnauthorized: UnauthorizedHandler = () => {}

export function configureAuth(options: {
  accessToken: TokenSource
  refresh: RefreshHandler
  onUnauthorized: UnauthorizedHandler
}): void {
  readAccessToken = options.accessToken
  refreshSession = options.refresh
  onUnauthorized = options.onUnauthorized
}

/** Requests that authenticate the caller rather than carry a session. */
const AUTH_ROUTES = ['/auth/login', '/auth/refresh']

function isAuthRoute(url: string | undefined): boolean {
  return AUTH_ROUTES.some((route) => url?.includes(route) === true)
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = readAccessToken()

  if (token !== null && !isAuthRoute(config.url)) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }

  return config
})

/**
 * One refresh at a time. Several requests can hit a just-expired token together; without this each
 * would start its own refresh, and every one but the first would present a refresh token that the
 * first had already consumed - the backend revokes each on use - logging the operator out.
 */
let inFlightRefresh: Promise<string | null> | null = null

function refreshOnce(): Promise<string | null> {
  inFlightRefresh ??= refreshSession().finally(() => {
    inFlightRefresh = null
  })

  return inFlightRefresh
}

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retried?: boolean
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    if (axios.isCancel(error)) {
      return Promise.reject(new CanceledError())
    }

    const request = error.config as RetryableRequest | undefined
    const status = error.response?.status ?? 0

    // A 401 on a normal request means the access token expired. Refresh once and replay it; if the
    // refresh fails the session is genuinely over. Login and refresh themselves are excluded - a
    // 401 there is a wrong password or a spent token, not something to retry.
    if (
      status === 401 &&
      request !== undefined &&
      request._retried !== true &&
      !isAuthRoute(request.url)
    ) {
      request._retried = true

      const token = await refreshOnce()

      if (token !== null) {
        request.headers.set('Authorization', `Bearer ${token}`)
        return http(request)
      }

      onUnauthorized()
    }

    return Promise.reject(toApiError(error))
  },
)

/** Validation payloads arrive in a couple of shapes; this reads them all without inventing one. */
function readFieldErrors(payload: unknown): Record<string, string[]> {
  if (typeof payload !== 'object' || payload === null) return {}

  const source = payload as Record<string, unknown>
  const errors = source.errors

  if (typeof errors !== 'object' || errors === null) return {}

  const result: Record<string, string[]> = {}

  for (const [field, value] of Object.entries(errors as Record<string, unknown>)) {
    // The key arrives PascalCase from data annotations; the form fields are camelCase.
    const key = field.charAt(0).toLowerCase() + field.slice(1)

    if (Array.isArray(value)) {
      result[key] = value.filter((entry): entry is string => typeof entry === 'string')
    } else if (typeof value === 'string') {
      result[key] = [value]
    }
  }

  return result
}

function toApiError(error: AxiosError<ApiResponse<unknown>>): ApiError {
  const status = error.response?.status ?? 0
  const payload = error.response?.data

  // The envelope's own message is written for a caller to read. Anything else - a proxy's HTML
  // error page, a stack trace - is not shown: the UI maps the status to a localized message
  // instead, so no backend internals reach the screen.
  const message = typeof payload?.message === 'string' ? payload.message : ''

  const header = error.response?.headers?.['retry-after']
  const retryAfter = typeof header === 'string' ? Number.parseInt(header, 10) : Number.NaN

  return new ApiError(
    status,
    message,
    readFieldErrors(payload),
    Number.isFinite(retryAfter) ? retryAfter : null,
  )
}

// ---------------------------------------------------------------------------
// Envelope helpers. Parsing lives here so no component ever unwraps a response itself.
// ---------------------------------------------------------------------------

/** A list plus the pagination the backend reported for it. */
export interface Page<T> {
  items: T[]
  meta: PaginationMeta | null
}

/** Unwraps a single-object response. */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await http.get<ApiResponse<T>>(url, config)
  return unwrap(response.data)
}

/** Unwraps a list response, keeping its pagination meta. */
export async function getPage<T>(url: string, config?: AxiosRequestConfig): Promise<Page<T>> {
  const response = await http.get<ApiResponse<T[]>>(url, config)

  return {
    items: response.data.data ?? [],
    meta: response.data.meta,
  }
}

export async function post<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await http.post<ApiResponse<T>>(url, body, config)
  return unwrap(response.data)
}

export async function put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await http.put<ApiResponse<T>>(url, body, config)
  return unwrap(response.data)
}

/** Deletes answer 204 with no body, so there is nothing to unwrap. */
export async function remove(url: string, config?: AxiosRequestConfig): Promise<void> {
  await http.delete(url, config)
}

function unwrap<T>(envelope: ApiResponse<T>): T {
  if (envelope.data === null || envelope.data === undefined) {
    // A success envelope with no data is legitimate on routes like logout, whose contract is
    // ApiResponse<object> carrying null. Callers there use `post<null>`.
    return null as T
  }

  return envelope.data
}

/**
 * Drops empty query parameters so a cleared filter disappears from the URL instead of being sent
 * as `?search=`, which the backend would read as a filter on the empty string.
 */
export function queryParams(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    result[key] = value
  }

  return result
}
