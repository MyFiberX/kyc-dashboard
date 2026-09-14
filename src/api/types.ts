/**
 * The backend's contracts, transcribed from the C# DTOs rather than guessed at.
 *
 * Every type here corresponds to a record in KYC.backend/Entity/DTOs. Where a field is optional in
 * TypeScript it is because the C# type is nullable; where a field is absent it is because the
 * backend does not send it. Two absences are deliberate and must stay that way:
 *
 *  - `publicToken` is [JsonIgnore] on KycResponse - it is the credential the customer's result page
 *    is addressed by, and it is never serialised.
 *  - `publicResultUrl` is not part of a list row. The listing endpoint documents this: a link per
 *    row would hand out a durable public view of every customer at once. Only GET /kyc/{id} has it.
 */

/** Every response the API sends is wrapped in this envelope. */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
  meta: PaginationMeta | null
}

/**
 * Offset pages carry page/totalCount/totalPages; cursor pages carry nextCursor/hasMore and leave
 * the offset fields null. `includeTotal=false` also nulls totalCount and totalPages on an offset
 * page - null means "not counted", which is not the same as zero.
 */
export interface PaginationMeta {
  page: number | null
  pageSize: number
  totalCount: number | null
  totalPages: number | null
  nextCursor: string | null
  hasMore: boolean | null
}

// ---------------------------------------------------------------------------
// Enums. These serialise as strings, so the string is the wire value.
// ---------------------------------------------------------------------------

/** KYCStatus - numeric ids are 1..4 but the wire format is the name. */
export const KYC_STATUSES = ['Pending', 'NoAnswer', 'InProcess', 'Completed'] as const
export type KycStatus = (typeof KYC_STATUSES)[number]

export const DEVICE_TYPES = ['Unknown', 'Mobile', 'Web'] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

/** PublicLinkState - the state a record's public result link is in. */
export type PublicLinkState = 'Active' | 'Disabled' | 'Expired'

/** StatusActorType - who made a status change. */
export type StatusActorType = 'ApiClient' | 'Operator' | 'System'

export type OperatorRole = 'SuperAdmin' | 'Admin'

/**
 * The scopes an API key can hold. These are the names the Scope enum serialises as - the frontend
 * only ever displays them; the backend decides what they permit.
 */
export const API_SCOPES = [
  'KycRead',
  'KycCreate',
  'KycUpdate',
  'KycAnalytics',
  'CampaignRead',
  'CampaignWrite',
  'RegistrationLinkRead',
  'RegistrationLinkWrite',
  'ProvinceRead',
  'ProvinceWrite',
  'RegionRead',
  'RegionWrite',
  'SubscriptionRead',
  'SubscriptionWrite',
  'RequestLogRead',
] as const
export type ApiScope = (typeof API_SCOPES)[number]

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export interface RefreshRequest {
  refreshToken: string
}

export interface LogoutRequest {
  refreshToken?: string | null
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface OperatorProfile {
  id: string
  username: string
  email: string
  lastLoginAt: string | null
  role: OperatorRole
}

export interface OperatorListItem {
  id: string
  username: string
  email: string
  role: OperatorRole
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface CreateOperatorRequest {
  username: string
  email: string
  password: string
  role?: OperatorRole | null
}

export interface OperatorCreated {
  id: string
  username: string
  email: string
  createdAt: string
  role: OperatorRole
}

export interface OperatorRoleOption {
  id: number
  value: OperatorRole
  label: string
}

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

export interface KycRecord {
  id: string
  referenceNumber: string
  fullName: string
  mobileNumber: string
  email: string | null
  nearAddressPoint: string | null
  provinceId: string
  provinceName: string
  regionId: string
  regionName: string
  locationLat: number | null
  locationLng: number | null
  internetSubscriptionId: string
  internetSubscriptionName: string
  internetSubscriptionPrice: number
  subscriptionDuration: number
  totalPrice: number
  createdAt: string
  status: KycStatus
  campaignId: string | null
  campaignName: string | null
  campaignCode: string | null
  deviceType: DeviceType
  /** Only present on a single-record read; never on a list row. */
  publicResultUrl?: string
  publicLinkState: PublicLinkState
  publicLinkExpiresAt: string | null
  /**
   * The plan price as it stood when the record was submitted. Display this for a historical
   * record - never recompute a total from the plan's current price.
   */
  priceAtSubmission: number
  updatedAt: string
  statusChangedAt: string | null
  isLateAttribution: boolean
  apiClientId: string | null
  externalReferenceId: string | null
  coordinateWarning: boolean
  isDuplicate: boolean
  duplicateOfKycId: string | null
}

export interface CreateKycRequest {
  fullName: string
  mobileNumber: string
  email?: string | null
  nearAddressPoint?: string | null
  provinceId: string
  regionId: string
  locationLat?: number | null
  locationLng?: number | null
  internetSubscriptionId: string
  subscriptionDuration: number
  campaignCode?: string | null
  deviceType?: DeviceType | null
  externalReferenceId?: string | null
}

/** The update contract is status-only: it is the single field the backend accepts here. */
export interface UpdateKycRequest {
  status: KycStatus
}

export interface KycStatusOption {
  id: number
  value: KycStatus
  label: string
}

export interface KycStatusHistoryEntry {
  id: string
  oldStatus: KycStatus | null
  newStatus: KycStatus
  changedAt: string
  actorType: StatusActorType
  actorName: string | null
}

export interface KycListParams {
  search?: string
  provinceId?: string
  regionId?: string
  internetSubscriptionId?: string
  campaignId?: string
  status?: KycStatus
  createdFrom?: string
  createdTo?: string
  updatedFrom?: string
  updatedTo?: string
  page?: number
  pageSize?: number
  cursor?: string
  apiClientId?: string
  externalReferenceId?: string
  includeTotal?: boolean
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface KycSummary {
  total: number
  pending: number
  noAnswer: number
  inProcess: number
  completed: number
  pipelineValue: number
  completedValue: number
}

export interface KycDailyPoint {
  date: string
  count: number
  /** Deprecated by the backend - equal to pipelineValue. Read pipelineValue instead. */
  revenue: number
  pipelineValue: number
  completedValue: number
}

export interface KycCampaignBreakdown {
  campaignId: string | null
  campaignName: string | null
  campaignCode: string | null
  total: number
  completed: number
  pipelineValue: number
  completedValue: number
}

export interface AnalyticsWindowParams {
  createdFrom?: string
  createdTo?: string
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export interface Campaign {
  id: string
  name: string
  /** Issued by the backend on creation; never sent by the client. */
  code: string
  description: string | null
  isActive: boolean
  startDate: string
  endDate: string | null
  kycCount: number
  createdAt: string
  updatedAt: string | null
}

export interface CreateCampaignRequest {
  name: string
  description?: string | null
  startDate: string
  endDate?: string | null
  isActive?: boolean
}

/** Partial: only the keys actually present are changed. `null` clears a nullable field. */
export interface UpdateCampaignRequest {
  name?: string
  description?: string | null
  startDate?: string
  endDate?: string | null
  isActive?: boolean
}

export interface CampaignListParams {
  search?: string
  isActive?: boolean
  startingFrom?: string
  startingTo?: string
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export interface Subscription {
  id: string
  name: string
  price: number
  isActive: boolean
}

export interface CreateSubscriptionRequest {
  name: string
  price: number
  isActive?: boolean
}

export interface UpdateSubscriptionRequest {
  name?: string
  price?: number
  isActive?: boolean
}

export interface SubscriptionListParams {
  search?: string
  isActive?: boolean
  minPrice?: number
  maxPrice?: number
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

export interface Province {
  id: string
  name: string
  regionCount: number
}

export interface CreateProvinceRequest {
  name: string
}

export interface UpdateProvinceRequest {
  name?: string
}

export interface Region {
  id: string
  name: string
  provinceId: string
  provinceName: string
}

export interface CreateRegionRequest {
  name: string
  provinceId: string
}

export interface UpdateRegionRequest {
  name?: string
  provinceId?: string
}

// ---------------------------------------------------------------------------
// Registration links
// ---------------------------------------------------------------------------

export interface RegistrationLink {
  id: string
  name: string
  description: string | null
  campaignId: string | null
  campaignName: string | null
  campaignCode: string | null
  /** The customer-facing URL to hand out. */
  publicUrl: string
  state: PublicLinkState
  stateLabel: string
  /** The single flag to act on: the page only works when this is true. */
  isUsable: boolean
  disabledAt: string | null
  createdAt: string
  updatedAt: string | null
}

/**
 * The state of a record's public result link, returned by the enable/disable routes.
 *
 * Deliberately carries no personal data and no result URL: revoking a credential is not an occasion
 * to hand one out, so the dashboard updates the badge from this and leaves the URL it already has.
 */
export interface KycPublicLink {
  id: string
  referenceNumber: string
  publicLinkState: PublicLinkState
  publicLinkStateLabel: string
  /** The single flag to act on: the page only works when this is true. */
  isUsable: boolean
  publicLinkExpiresAt: string | null
  publicLinkDisabledAt: string | null
}

export interface CreateRegistrationLinkRequest {
  name: string
  description?: string | null
  /** Fixed at creation - the backend refuses to re-point an existing link. */
  campaignId?: string | null
}

export interface SetRegistrationLinkEnabledRequest {
  isEnabled: boolean
}

// ---------------------------------------------------------------------------
// API clients
// ---------------------------------------------------------------------------

export interface ApiClientListItem {
  id: string
  name: string
  description: string | null
  keyPrefix: string
  isActive: boolean
  isExpired: boolean
  isRevoked: boolean
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
  scopes: string
}

export interface ApiClientDetails {
  id: string
  name: string
  description: string | null
  keyPrefix: string
  isActive: boolean
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
  scopes: string
  ipAllowlist: string
}

/**
 * The only response in the entire API that carries a plaintext secret. It is shown once and never
 * stored - see the note in api-clients.api.ts.
 */
export interface ApiClientCreated {
  id: string
  name: string
  keyPrefix: string
  secretKey: string
  expiresAt: string | null
  createdAt: string
  scopes: string
  ipAllowlist: string
}

export interface RotatedSecret {
  id: string
  keyPrefix: string
  secretKey: string
}

export interface CreateApiClientRequest {
  name: string
  description?: string | null
  expiresAt?: string | null
  scopes?: string
  ipAllowlist?: string | null
}

export type ApiClientSortField = 'CreatedAt' | 'Name' | 'LastUsedAt' | 'ExpiresAt'

export interface ApiClientListParams {
  search?: string
  isActive?: boolean
  isRevoked?: boolean
  isExpired?: boolean
  sortBy?: ApiClientSortField
  sortDescending?: boolean
  page?: number
  pageSize?: number
}

export interface ApiScopeOption {
  id: number
  value: string
  label: string
  description: string
}

export interface OperatorListParams {
  search?: string
  role?: OperatorRole
  isActive?: boolean
  page?: number
  pageSize?: number
}
