import { API_V1, get, getPage, post, put, queryParams, remove, type Page } from './client'
import type {
  CreateProvinceRequest,
  CreateRegionRequest,
  Province,
  Region,
  UpdateProvinceRequest,
  UpdateRegionRequest,
} from './types'

const PROVINCES = `${API_V1}/provinces`
const REGIONS = `${API_V1}/regions`

export interface ProvinceListParams {
  search?: string
  page?: number
  pageSize?: number
}

export interface RegionListParams {
  search?: string
  provinceId?: string
  page?: number
  pageSize?: number
}

// --- Provinces -------------------------------------------------------------

/** GET /api/v1/provinces - by name; each row carries its region count. */
export function getProvinces(
  params: ProvinceListParams = {},
  signal?: AbortSignal,
): Promise<Page<Province>> {
  return getPage<Province>(PROVINCES, { params: queryParams({ ...params }), signal })
}

/** GET /api/v1/provinces/{id} */
export function getProvince(id: string, signal?: AbortSignal): Promise<Province> {
  return get<Province>(`${PROVINCES}/${id}`, { signal })
}

/** POST /api/v1/provinces - the name must be unique among live provinces. */
export function createProvince(request: CreateProvinceRequest): Promise<Province> {
  return post<Province>(PROVINCES, request)
}

/** PUT /api/v1/provinces/{id} - partial; an empty object is rejected with 400. */
export function updateProvince(id: string, request: UpdateProvinceRequest): Promise<Province> {
  return put<Province>(`${PROVINCES}/${id}`, request)
}

/** DELETE /api/v1/provinces/{id} - 409 while it still has regions or KYC records. */
export function deleteProvince(id: string): Promise<void> {
  return remove(`${PROVINCES}/${id}`)
}

// --- Regions ---------------------------------------------------------------

/** GET /api/v1/regions - filter by provinceId for the dependent selector. */
export function getRegions(
  params: RegionListParams = {},
  signal?: AbortSignal,
): Promise<Page<Region>> {
  return getPage<Region>(REGIONS, { params: queryParams({ ...params }), signal })
}

/** GET /api/v1/regions/{id} */
export function getRegion(id: string, signal?: AbortSignal): Promise<Region> {
  return get<Region>(`${REGIONS}/${id}`, { signal })
}

/** POST /api/v1/regions - the province must exist and the name be unique within it. */
export function createRegion(request: CreateRegionRequest): Promise<Region> {
  return post<Region>(REGIONS, request)
}

/**
 * PUT /api/v1/regions/{id}
 *
 * Partial. Moving a region to another province is refused once KYC records reference it, which
 * surfaces as a 409.
 */
export function updateRegion(id: string, request: UpdateRegionRequest): Promise<Region> {
  return put<Region>(`${REGIONS}/${id}`, request)
}

/** DELETE /api/v1/regions/{id} - 409 while KYC records reference it. */
export function deleteRegion(id: string): Promise<void> {
  return remove(`${REGIONS}/${id}`)
}
