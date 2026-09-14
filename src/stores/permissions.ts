import { computed } from 'vue'

import { useAuthStore } from './auth.store'

/**
 * What the signed-in operator may do.
 *
 * ## This is UX only
 *
 * Every check here decides whether to render a button, not whether an action is allowed. The
 * backend is the authority and re-checks everything; hiding a control the operator cannot use is a
 * courtesy, and a 403 is still handled wherever one can arrive.
 *
 * ## How the backend actually decides
 *
 * Operators are never issued scope claims - scopes describe what an API *key* may do. An operator
 * is admitted by role instead:
 *
 *  - The business surface (KYC, campaigns, subscriptions, provinces, regions, registration links)
 *    admits both operator roles. SuperAdmin passes every scope requirement outright; Admin passes
 *    the ones that admit operators, which is all of the business surface.
 *  - The administrative surface (API clients, operator accounts) requires the SuperAdmin role.
 *  - The request logs are integration-only: no operator reaches them regardless of role, so the
 *    console does not offer them at all.
 *
 * So the model here is role-shaped, matching the backend, rather than a scope list the frontend
 * would have to invent for an operator who holds none.
 */
export function usePermissions() {
  const auth = useAuthStore()

  const isSignedIn = computed(() => auth.isAuthenticated)
  const isSuperAdmin = computed(() => auth.isSuperAdmin)

  /** The business surface: either operator role reaches it. */
  const canReadKyc = isSignedIn
  const canCreateKyc = isSignedIn
  const canUpdateKyc = isSignedIn
  const canReadAnalytics = isSignedIn

  const canReadCampaigns = isSignedIn
  const canWriteCampaigns = isSignedIn

  const canReadSubscriptions = isSignedIn
  const canWriteSubscriptions = isSignedIn

  const canReadMasterData = isSignedIn
  const canWriteMasterData = isSignedIn

  const canReadRegistrationLinks = isSignedIn
  const canWriteRegistrationLinks = isSignedIn

  /** The administrative surface: SuperAdmin only. */
  const canManageApiClients = isSuperAdmin
  const canManageOperators = isSuperAdmin

  return {
    isSignedIn,
    isSuperAdmin,
    canReadKyc,
    canCreateKyc,
    canUpdateKyc,
    canReadAnalytics,
    canReadCampaigns,
    canWriteCampaigns,
    canReadSubscriptions,
    canWriteSubscriptions,
    canReadMasterData,
    canWriteMasterData,
    canReadRegistrationLinks,
    canWriteRegistrationLinks,
    canManageApiClients,
    canManageOperators,
  }
}

/** The permission a route requires, named so the router and the sidebar agree on one vocabulary. */
export type Permission =
  | 'kyc.read'
  | 'kyc.create'
  | 'kyc.update'
  | 'analytics.read'
  | 'campaigns.read'
  | 'campaigns.write'
  | 'subscriptions.read'
  | 'subscriptions.write'
  | 'masterData.read'
  | 'masterData.write'
  | 'registrationLinks.read'
  | 'registrationLinks.write'
  | 'apiClients.manage'
  | 'operators.manage'

/**
 * Resolves a permission without a component context, for the router's guard. Mirrors the rules
 * above: everything but the two administrative permissions is open to any signed-in operator.
 */
export function hasPermission(
  permission: Permission,
  state: { isAuthenticated: boolean; isSuperAdmin: boolean },
): boolean {
  if (!state.isAuthenticated) return false

  if (permission === 'apiClients.manage' || permission === 'operators.manage') {
    return state.isSuperAdmin
  }

  return true
}
