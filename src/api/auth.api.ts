import { get, post, getPage, queryParams, type Page } from './client'
import type {
  ChangePasswordRequest,
  CreateOperatorRequest,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  OperatorCreated,
  OperatorListItem,
  OperatorListParams,
  OperatorProfile,
  OperatorRoleOption,
  RefreshRequest,
} from './types'

/**
 * Operator authentication and account administration.
 *
 * These live under /api/super-admin, not /api/v1 - they are the platform surface, and the backend
 * maps them outside the versioned business group.
 */
const BASE = '/api/super-admin'

/** POST /api/super-admin/auth/login */
export function login(request: LoginRequest): Promise<LoginResponse> {
  return post<LoginResponse>(`${BASE}/auth/login`, request)
}

/** POST /api/super-admin/auth/refresh - the presented token is revoked as it is exchanged. */
export function refresh(request: RefreshRequest): Promise<LoginResponse> {
  return post<LoginResponse>(`${BASE}/auth/refresh`, request)
}

/**
 * POST /api/super-admin/auth/logout
 *
 * With a refresh token in the body only that token is revoked; with the body omitted every active
 * refresh token of the signed-in operator is. The access token is self-contained and stays valid
 * until it expires, which is why its lifetime is short.
 */
export function logout(request?: LogoutRequest): Promise<null> {
  return post<null>(`${BASE}/auth/logout`, request)
}

/** POST /api/super-admin/auth/change-password - rolls the security stamp; the session ends. */
export function changePassword(request: ChangePasswordRequest): Promise<null> {
  return post<null>(`${BASE}/auth/change-password`, request)
}

/** GET /api/super-admin/me */
export function getProfile(): Promise<OperatorProfile> {
  return get<OperatorProfile>(`${BASE}/me`)
}

/** GET /api/super-admin/roles - SuperAdmin only. */
export function getRoles(): Promise<OperatorRoleOption[]> {
  return get<OperatorRoleOption[]>(`${BASE}/roles`)
}

/** GET /api/super-admin/accounts - SuperAdmin only. */
export function getOperators(
  params: OperatorListParams = {},
  signal?: AbortSignal,
): Promise<Page<OperatorListItem>> {
  return getPage<OperatorListItem>(`${BASE}/accounts`, {
    params: queryParams({ ...params }),
    signal,
  })
}

/** POST /api/super-admin/accounts - SuperAdmin only. The password is never echoed back. */
export function createOperator(request: CreateOperatorRequest): Promise<OperatorCreated> {
  return post<OperatorCreated>(`${BASE}/accounts`, request)
}
