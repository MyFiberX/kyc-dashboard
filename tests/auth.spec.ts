import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as ApiModule from '@/api'
import { useAuthStore } from '@/stores/auth.store'

/**
 * The session's behaviour: signing in, refreshing, signing out, and - the part that matters most -
 * what is left behind in browser storage afterwards.
 */

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('@/api')

  return {
    ...actual,
    configureAuth: vi.fn(),
    authApi: {
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
      getProfile: vi.fn(),
      changePassword: vi.fn(),
    },
  }
})

const { authApi } = await import('@/api')

const TOKENS = {
  accessToken: 'access-token-value',
  refreshToken: 'refresh-token-value',
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
}

const PROFILE = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'operator',
  email: 'operator@example.test',
  lastLoginAt: null,
  role: 'Admin' as const,
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.sessionStorage.clear()
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('establishes a session on sign-in', async () => {
    vi.mocked(authApi.login).mockResolvedValue(TOKENS)
    vi.mocked(authApi.getProfile).mockResolvedValue(PROFILE)

    const auth = useAuthStore()
    await auth.signIn({ username: 'operator', password: 'secret' })

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.profile?.username).toBe('operator')
    expect(auth.role).toBe('Admin')
  })

  it('never writes the access token to storage', async () => {
    vi.mocked(authApi.login).mockResolvedValue(TOKENS)
    vi.mocked(authApi.getProfile).mockResolvedValue(PROFILE)

    const auth = useAuthStore()
    await auth.signIn({ username: 'operator', password: 'secret' })

    const everything = [
      ...Object.entries({ ...window.localStorage }),
      ...Object.entries({ ...window.sessionStorage }),
    ]
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('\n')

    // The access token is a bearer credential and lives only in memory.
    expect(everything).not.toContain(TOKENS.accessToken)
  })

  it('does not persist the password anywhere', async () => {
    vi.mocked(authApi.login).mockResolvedValue(TOKENS)
    vi.mocked(authApi.getProfile).mockResolvedValue(PROFILE)

    const auth = useAuthStore()
    await auth.signIn({ username: 'operator', password: 'super-secret-password' })

    const everything = JSON.stringify({
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
    })

    expect(everything).not.toContain('super-secret-password')
  })

  it('clears the session when a sign-in succeeds but the profile cannot be read', async () => {
    vi.mocked(authApi.login).mockResolvedValue(TOKENS)
    vi.mocked(authApi.getProfile).mockRejectedValue(new Error('unreachable'))

    const auth = useAuthStore()

    await expect(auth.signIn({ username: 'operator', password: 'secret' })).rejects.toThrow()

    // A half-established session would leave the shell rendering with no operator behind it.
    expect(auth.isAuthenticated).toBe(false)
    expect(window.sessionStorage.getItem('kyc.rt')).toBeNull()
  })

  it('clears the local session on sign-out even when the server call fails', async () => {
    vi.mocked(authApi.login).mockResolvedValue(TOKENS)
    vi.mocked(authApi.getProfile).mockResolvedValue(PROFILE)
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network'))

    const auth = useAuthStore()
    await auth.signIn({ username: 'operator', password: 'secret' })
    await auth.signOut()

    // Otherwise a flaky network would leave someone apparently signed in on a shared machine.
    expect(auth.isAuthenticated).toBe(false)
    expect(window.sessionStorage.getItem('kyc.rt')).toBeNull()
  })

  it('ends the session after a password change, because the backend invalidates every token', async () => {
    vi.mocked(authApi.login).mockResolvedValue(TOKENS)
    vi.mocked(authApi.getProfile).mockResolvedValue(PROFILE)
    vi.mocked(authApi.changePassword).mockResolvedValue(null)

    const auth = useAuthStore()
    await auth.signIn({ username: 'operator', password: 'secret' })
    await auth.changePassword('secret', 'NewPassword1!')

    expect(auth.isAuthenticated).toBe(false)
  })

  it('drops the stored refresh token when the exchange is refused', async () => {
    window.sessionStorage.setItem('kyc.rt', 'spent-token')
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('401'))

    const auth = useAuthStore()
    await auth.restore()

    // The backend revokes a refresh token as it is used, so a refusal is terminal.
    expect(auth.isAuthenticated).toBe(false)
    expect(window.sessionStorage.getItem('kyc.rt')).toBeNull()
  })
})
