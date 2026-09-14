import { describe, expect, it } from 'vitest'

import { hasPermission, type Permission } from '@/stores/permissions'

/**
 * The frontend's permission model has to agree with the backend's, or it hides the wrong things.
 *
 * The backend's rules: both operator roles reach the business surface, and the administrative
 * surface (API clients, operator accounts) requires SuperAdmin. These assertions pin that.
 *
 * None of this is a security boundary - the backend re-checks everything. It decides which controls
 * are worth rendering.
 */

const BUSINESS: Permission[] = [
  'kyc.read',
  'kyc.create',
  'kyc.update',
  'analytics.read',
  'campaigns.read',
  'campaigns.write',
  'subscriptions.read',
  'subscriptions.write',
  'masterData.read',
  'masterData.write',
  'registrationLinks.read',
  'registrationLinks.write',
]

const ADMINISTRATIVE: Permission[] = ['apiClients.manage', 'operators.manage']

describe('permissions', () => {
  it.each(BUSINESS)('lets a SuperAdmin reach %s', (permission) => {
    expect(hasPermission(permission, { isAuthenticated: true, isSuperAdmin: true })).toBe(true)
  })

  it.each(BUSINESS)('lets an Admin reach %s', (permission) => {
    expect(hasPermission(permission, { isAuthenticated: true, isSuperAdmin: false })).toBe(true)
  })

  it.each(ADMINISTRATIVE)('lets a SuperAdmin reach %s', (permission) => {
    expect(hasPermission(permission, { isAuthenticated: true, isSuperAdmin: true })).toBe(true)
  })

  it.each(ADMINISTRATIVE)('refuses an Admin %s', (permission) => {
    // The backend answers 403 here, so offering the control would be offering a door that
    // does not open.
    expect(hasPermission(permission, { isAuthenticated: true, isSuperAdmin: false })).toBe(false)
  })

  it.each([...BUSINESS, ...ADMINISTRATIVE])('refuses an anonymous caller %s', (permission) => {
    expect(hasPermission(permission, { isAuthenticated: false, isSuperAdmin: false })).toBe(false)
  })

  it('refuses administrative permissions to a signed-out SuperAdmin', () => {
    // isSuperAdmin can only be read from a profile, but the authentication check must come first.
    expect(hasPermission('apiClients.manage', { isAuthenticated: false, isSuperAdmin: true })).toBe(
      false,
    )
  })
})
